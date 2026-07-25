"""Genome Agent — cohort discovery from persona-behavior events.

Per agents.md §1:
  events  →  per-persona behavior vector  →  k-means (k=2 by default)
                                          →  Genome Profile JSON per cohort

The Profile JSON matches the shape spec'd in agents.md §1:

  {"cohort": "...",
   "attention_curve": {"safe_zone_s": ..., "risk_after_s": ...},
   "responds_to": ["silence_tension", "haptic_sync", ...],
   "numb_to": ["long_exposition", ...],
   "cliffhanger_efficacy": {"return_promise": 0.81, "threat_to_listener": 0.63},
   "decision_point_tolerance": 1,
   "best_break_pattern": "5min_segments_hard_out"}

Outputs are written to `billifm.eval.genome_profiles` via delta_sync (or
directly from a Databricks notebook as `spark.createDataFrame(...)`).
"""

from __future__ import annotations
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.cluster import KMeans

from .schemas import Persona


# ---------- 1. Behavior vector per persona ----------

BEHAVIOR_DIMS = [
    "attention_holding_s",       # mean t at which sensory_reaction engagement drops
    "sensory_lean_in_p",         # p(reaction == "lean_in") over sensory segs
    "call_answered_p",           # p(call_answered)
    "call_resisted_p",           # p(response_class == "resisted")
    "call_revealed_p",           # p(response_class == "revealed")
    "silence_quiet_p",           # p(silence outcome == "quiet")
    "cliffhanger_return_p",      # p(cliffhanger_hooked.returned)
    "hook_strength_mean",        # mean hook_strength
    "completion_p",              # p(session ended with reason == "complete")
]


def _events_by_persona(events: Iterable[dict]) -> dict[str, list[dict]]:
    by: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        by[e["user_id"]].append(e)
    return by


def behavior_vector(events: list[dict]) -> np.ndarray:
    """Compute the 9-dim behavior vector for one persona's events."""
    v = np.zeros(len(BEHAVIOR_DIMS), dtype=float)

    sensory = [e for e in events if e["event_type"] == "sensory_reaction"]
    calls_answered = [e for e in events if e["event_type"] == "call_answered"]
    calls_declined = [e for e in events if e["event_type"] == "call_declined"]
    silence = [e for e in events if e["event_type"] == "silence_test_result"]
    cliffs = [e for e in events if e["event_type"] == "cliffhanger_hooked"]
    ended = [e for e in events if e["event_type"] == "session_ended"]

    if sensory:
        engs = [float(e["payload"].get("engagement", 0.5)) for e in sensory]
        # attention_holding_s = seg t_start of the first low-engagement moment
        low = [e for e, eng in zip(sensory, engs) if eng < 0.4]
        if low:
            v[0] = float(low[0].get("payload", {}).get("t_start", 60))
        else:
            v[0] = 300.0
        v[1] = sum(1 for e in sensory if e["payload"].get("reaction") == "lean_in") / len(sensory)

    n_calls_total = len(calls_answered) + len(calls_declined)
    if n_calls_total:
        v[2] = len(calls_answered) / n_calls_total
    if calls_answered:
        rc = [str(e["payload"].get("response_class", "")).lower() for e in calls_answered]
        v[3] = rc.count("resisted") / len(rc)
        v[4] = rc.count("revealed") / len(rc)

    if silence:
        v[5] = sum(1 for e in silence if e["payload"].get("outcome") == "quiet") / len(silence)

    if cliffs:
        v[6] = sum(1 for e in cliffs if e["payload"].get("returned")) / len(cliffs)
        v[7] = float(np.mean([float(e["payload"].get("hook_strength", 0.5)) for e in cliffs]))

    if ended:
        v[8] = sum(1 for e in ended if e["payload"].get("reason") == "complete") / len(ended)

    return v


def all_behavior_vectors(events: list[dict]) -> tuple[list[str], np.ndarray]:
    by = _events_by_persona(events)
    ids = sorted(by.keys())
    X = np.vstack([behavior_vector(by[pid]) for pid in ids])
    return ids, X


# ---------- 2. Cluster ----------

def cluster_personas(X: np.ndarray, k: int = 2, seed: int = 0
                     ) -> tuple[np.ndarray, KMeans]:
    """k-means. Returns (labels, model)."""
    if len(X) < k:
        raise ValueError(f"need at least k={k} personas, got {len(X)}")
    km = KMeans(n_clusters=k, n_init=10, random_state=seed)
    labels = km.fit_predict(X)
    return labels, km


# ---------- 3. Genome Profile JSON per cluster ----------

RESPONDS_TO_MAP = [
    # (behavior_dim_index, threshold, label)
    (1, 0.55, "haptic_sync"),
    (1, 0.65, "silence_tension"),
    (2, 0.55, "direct_address"),
    (3, 0.35, "loyalty_beats"),
    (5, 0.75, "physical_participation"),
    (6, 0.65, "return_promise_cliffhangers"),
]
NUMB_TO_MAP = [
    (1, 0.25, "long_exposition"),
    (2, 0.30, "jump_scares"),
    (5, 0.30, "physical_participation"),
]


def _cluster_summary(X: np.ndarray, labels: np.ndarray, cluster_id: int
                     ) -> dict[str, float]:
    mask = labels == cluster_id
    means = X[mask].mean(axis=0)
    return {dim: float(means[i]) for i, dim in enumerate(BEHAVIOR_DIMS)}


def _label_cohort(summary: dict[str, float], persona_meta: dict) -> str:
    """Give the cohort a legible name based on its dominant behavior."""
    if summary["sensory_lean_in_p"] > 0.55 and summary["silence_quiet_p"] > 0.6:
        return "thriller_binger_active_listener"
    if summary["silence_quiet_p"] > 0.7 and summary["cliffhanger_return_p"] > 0.65:
        return "slow_burn_patient_returner"
    if summary["call_answered_p"] > 0.75:
        return "confrontational_engager"
    if summary["completion_p"] < 0.4:
        return "early_dropoff_cohort"
    return f"cohort_{persona_meta.get('cluster_id',0)}"


def genome_profile(cluster_id: int, X: np.ndarray, labels: np.ndarray,
                   persona_meta: dict | None = None) -> dict:
    """Produce one Genome Profile JSON for the given cluster."""
    summary = _cluster_summary(X, labels, cluster_id)
    meta = {"cluster_id": cluster_id, **(persona_meta or {})}
    cohort = _label_cohort(summary, meta)

    attention_s = summary["attention_holding_s"]
    safe_zone = max(30.0, round(attention_s * 0.5, 0))
    risk_after = max(60.0, round(attention_s, 0))

    responds_to = []
    for idx, thr, label in RESPONDS_TO_MAP:
        val = summary[BEHAVIOR_DIMS[idx]]
        if val >= thr and label not in responds_to:
            responds_to.append(label)
    numb_to = []
    for idx, thr, label in NUMB_TO_MAP:
        val = summary[BEHAVIOR_DIMS[idx]]
        if val <= thr and label not in numb_to:
            numb_to.append(label)

    return_promise_eff = round(summary["cliffhanger_return_p"], 2)
    hook_strength = round(summary["hook_strength_mean"], 2)

    # decision_point_tolerance: 1 for MVP (rules.md §4: one on-tap decision)
    decision_tol = 1 if summary["call_answered_p"] < 0.85 else 2

    # break pattern: hard 5-min for high-attention cohorts; longer for patient
    if attention_s <= 200:
        best_break = "5min_segments_hard_out"
    else:
        best_break = "8min_segments_narrative_bridge"

    return {
        "cohort": cohort,
        "cluster_id": cluster_id,
        "n_personas": int((labels == cluster_id).sum()),
        "attention_curve": {
            "safe_zone_s": safe_zone,
            "risk_after_s": risk_after,
        },
        "responds_to": responds_to,
        "numb_to": numb_to,
        "cliffhanger_efficacy": {
            "return_promise": return_promise_eff,
            "threat_to_listener": round(hook_strength * 0.9, 2),
        },
        "decision_point_tolerance": decision_tol,
        "best_break_pattern": best_break,
        "_debug_summary": {k: round(v, 3) for k, v in summary.items()},
    }


# ---------- 4. End-to-end ----------

def build_profiles(events: list[dict], k: int = 2, seed: int = 0
                   ) -> tuple[list[dict], dict[str, int]]:
    """Full pipeline: events → k profile JSONs + persona→cluster map."""
    ids, X = all_behavior_vectors(events)
    labels, _ = cluster_personas(X, k=k, seed=seed)
    profiles = [genome_profile(c, X, labels) for c in range(k)]
    persona_cluster_map = dict(zip(ids, labels.tolist()))
    return profiles, persona_cluster_map


# ---------- CLI ----------

def _main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", required=True, type=Path)
    ap.add_argument("-k", type=int, default=2)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, default=Path("eval/out/genome_profiles.json"))
    ap.add_argument("--map-out", type=Path,
                    default=Path("eval/out/persona_cluster_map.json"))
    args = ap.parse_args()

    events = [json.loads(l) for l in args.events.open() if l.strip()]
    profiles, pmap = build_profiles(events, k=args.k, seed=args.seed)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(profiles, indent=2))
    args.map_out.write_text(json.dumps(pmap, indent=2))

    for prof in profiles:
        print(f"Cohort {prof['cohort']} (n={prof['n_personas']})")
        print(f"  attention_curve: {prof['attention_curve']}")
        print(f"  responds_to:     {prof['responds_to']}")
        print(f"  numb_to:         {prof['numb_to']}")
        print(f"  cliffhanger:     {prof['cliffhanger_efficacy']}")
        print(f"  break_pattern:   {prof['best_break_pattern']}")


if __name__ == "__main__":
    _main()
