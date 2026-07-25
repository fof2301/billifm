"""Synthetic persona generator for two declared cohorts.

The Genome Agent needs a corpus to cluster over. We generate one from
declared distributions so the pipeline is real and the users are
simulated — disclosed per memory.md D18.

Two cohorts (aligned with agents.md §1's example genome and Design.md):
  1. thriller_binger_IN_night — high O, high E, mid-high N, thrill/curious tags
  2. slow_burn_drama_IN_evening — mid O, high C, low-mid N, patient/empath tags

Distributions here are NOT ground truth — they're plausible cohort priors.
The Genome Agent will discover the real cohort structure from behavior.
"""

from __future__ import annotations
import argparse
import csv
import json
import random
from pathlib import Path
from typing import Iterator


COHORTS: dict[str, dict] = {
    "thriller_binger_IN_night": {
        "share": 0.5,
        "age_bands": ["18-24", "25-34", "25-34", "35-44"],
        "regions": ["IN-MH", "IN-KA", "IN-DL", "IN-TN", "IN-WB"],
        "big5": {  # (mean, std) — sampled and clamped to [0,1]
            "o": (0.75, 0.10), "c": (0.50, 0.12), "e": (0.65, 0.13),
            "a": (0.55, 0.12), "n": (0.60, 0.15),
        },
        "nature_pool": [
            "thrill-seeker", "night-owl", "curious", "impatient",
            "horror-fan", "binger", "drama-lover", "extravert",
        ],
        "tags_min": 2, "tags_max": 4,
        "content_pref_prior": [0.85, 0.35, 0.25, 0.55, 0.85, 0.35, 0.65, 0.2],
        "watch_completion_rate": (0.72, 0.15),
        "avg_session_min": (25, 10),
        "preferred_mode": "interactive",
        "call_response_style": "voice",
    },
    "slow_burn_drama_IN_evening": {
        "share": 0.5,
        "age_bands": ["25-34", "35-44", "45-54", "55-64"],
        "regions": ["IN-MH", "IN-GJ", "IN-KA", "IN-DL", "IN-WB", "IN-UP"],
        "big5": {
            "o": (0.55, 0.10), "c": (0.72, 0.10), "e": (0.42, 0.13),
            "a": (0.68, 0.10), "n": (0.42, 0.13),
        },
        "nature_pool": [
            "patient", "empath", "analytical", "introvert", "storyteller-lover",
            "documentary-buff", "perfectionist", "creative",
        ],
        "tags_min": 2, "tags_max": 3,
        "content_pref_prior": [0.35, 0.7, 0.4, 0.8, 0.5, 0.3, 0.15, 0.75],
        "watch_completion_rate": (0.82, 0.10),
        "avg_session_min": (35, 12),
        "preferred_mode": "standard",
        "call_response_style": "text",
    },
}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _sample_big5(spec: dict, rng: random.Random) -> tuple[float, ...]:
    def s(k):
        m, sd = spec["big5"][k]
        return round(_clamp01(rng.gauss(m, sd)), 2)
    return (s("o"), s("c"), s("e"), s("a"), s("n"))


def _sample_tags(spec: dict, rng: random.Random) -> list[str]:
    n = rng.randint(spec["tags_min"], spec["tags_max"])
    return rng.sample(spec["nature_pool"], k=min(n, len(spec["nature_pool"])))


def _sample_vec(spec: dict, rng: random.Random) -> list[float]:
    prior = spec["content_pref_prior"]
    return [round(_clamp01(v + rng.gauss(0, 0.10)), 2) for v in prior]


def _sample_persona(cohort: str, spec: dict, i: int, rng: random.Random) -> dict:
    o, c, e, a, n = _sample_big5(spec, rng)
    wcr_m, wcr_s = spec["watch_completion_rate"]
    ses_m, ses_s = spec["avg_session_min"]
    return {
        "persona_id": f"{cohort[:6]}_{i:05d}",
        "cohort": cohort,
        "age_band": rng.choice(spec["age_bands"]),
        "gender": rng.choices(["F", "M", "NB"], weights=[0.48, 0.48, 0.04])[0],
        "region": rng.choice(spec["regions"]),
        "big5_o": o, "big5_c": c, "big5_e": e, "big5_a": a, "big5_n": n,
        "nature_tags": _sample_tags(spec, rng),
        "content_pref_vec": _sample_vec(spec, rng),
        "past_watches": [] if rng.random() > 0.2 else
            [f"s{rng.randint(1, 99):03d}" for _ in range(rng.randint(1, 3))],
        "watch_completion_rate": round(_clamp01(rng.gauss(wcr_m, wcr_s)), 2),
        "avg_session_min": round(max(1.0, rng.gauss(ses_m, ses_s)), 1),
        "preferred_mode": spec["preferred_mode"],
        "call_response_style": spec["call_response_style"],
    }


def generate(n: int, seed: int = 42) -> Iterator[dict]:
    """Yield n personas, mixed across cohorts by declared shares."""
    rng = random.Random(seed)
    cohort_names = list(COHORTS.keys())
    shares = [COHORTS[c]["share"] for c in cohort_names]
    for i in range(n):
        cohort = rng.choices(cohort_names, weights=shares)[0]
        yield _sample_persona(cohort, COHORTS[cohort], i, rng)


def to_csv(personas: list[dict], path: Path) -> None:
    """Write in the same CSV shape run_eval.py already knows how to read."""
    path.parent.mkdir(parents=True, exist_ok=True)
    header = [
        "persona_id", "age_band", "gender", "region",
        "big5_o", "big5_c", "big5_e", "big5_a", "big5_n",
        "nature_tags", "content_pref_vec", "past_watches",
        "watch_completion_rate", "avg_session_min",
        "preferred_mode", "call_response_style",
    ]
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for p in personas:
            w.writerow([
                p["persona_id"], p["age_band"], p["gender"], p["region"],
                p["big5_o"], p["big5_c"], p["big5_e"], p["big5_a"], p["big5_n"],
                "|".join(p["nature_tags"]),
                json.dumps(p["content_pref_vec"]),
                "|".join(p["past_watches"]),
                p["watch_completion_rate"], p["avg_session_min"],
                p["preferred_mode"], p["call_response_style"],
            ])


def to_cohort_map(personas: list[dict]) -> dict[str, str]:
    """Return {persona_id: cohort_name} for the sim's cohort_hints."""
    return {p["persona_id"]: p["cohort"] for p in personas}


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=200,
                    help="How many personas to generate")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--csv", type=Path, default=Path("eval/out/personas.csv"))
    ap.add_argument("--cohort-map", type=Path,
                    default=Path("eval/out/cohort_map.json"))
    args = ap.parse_args()

    ps = list(generate(args.n, seed=args.seed))
    to_csv(ps, args.csv)
    args.cohort_map.parent.mkdir(parents=True, exist_ok=True)
    args.cohort_map.write_text(json.dumps(to_cohort_map(ps), indent=2))

    counts: dict[str, int] = {}
    for p in ps:
        counts[p["cohort"]] = counts.get(p["cohort"], 0) + 1
    print(f"Generated {len(ps)} personas → {args.csv}")
    for c, n in counts.items():
        print(f"  {c}: {n}")


if __name__ == "__main__":
    _main()
