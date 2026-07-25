"""Aggregate simulation events into story-goodness metrics.

All metrics operate on the JSONL event stream from `sim.py`, but the
same schema works for real production events too, so any query here can
run against post-launch data unchanged.
"""

from __future__ import annotations
import json
from collections import defaultdict
from pathlib import Path

from .schemas import Persona


def load_events(path: Path) -> list[dict]:
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def retention_curve(events: list[dict]) -> dict[str, float]:
    """Fraction of runs that entered each node."""
    at_node = defaultdict(set)
    all_runs = set()
    for e in events:
        all_runs.add(e["run_id"])
        if e["event_type"] == "node_entered":
            at_node[e["node_id"]].add(e["run_id"])
    n = len(all_runs) or 1
    return {node: len(runs) / n for node, runs in at_node.items()}


def dropoff_by_node(events: list[dict]) -> dict[str, int]:
    """Count of drop-offs that happened at each node."""
    counts: dict[str, int] = defaultdict(int)
    for e in events:
        if (e["event_type"] == "session_ended"
                and e["payload"].get("reason") == "dropoff"):
            counts[e["node_id"]] += 1
    return dict(counts)


def completion_rate(events: list[dict]) -> float:
    total = complete = 0
    for e in events:
        if e["event_type"] == "session_ended":
            total += 1
            if e["payload"].get("reason") == "complete":
                complete += 1
    return complete / total if total else 0.0


def choice_distribution(events: list[dict]) -> dict[str, dict[str, int]]:
    """For each decision node, count of each choice id."""
    dist: dict = defaultdict(lambda: defaultdict(int))
    for e in events:
        if e["event_type"] == "decision_made":
            dist[e["node_id"]][e["payload"]["choice_id"]] += 1
    return {n: dict(c) for n, c in dist.items()}


def callback_label_distribution(events: list[dict]) -> dict[str, dict[str, int]]:
    """For each callback node, count of classified labels the users landed on."""
    dist: dict = defaultdict(lambda: defaultdict(int))
    for e in events:
        if e["event_type"] == "callback_answered":
            dist[e["node_id"]][e["payload"]["classified_label"]] += 1
    return {n: dict(c) for n, c in dist.items()}


def trait_fit_by_dropoff(events: list[dict],
                         personas: list[Persona]) -> dict:
    """For each drop-off node, the average Big5 and top nature tags of
    personas who dropped there. Reveals *who* is bouncing."""
    pmap = {p.persona_id: p for p in personas}
    by_node: dict[str, list[Persona]] = defaultdict(list)
    for e in events:
        if (e["event_type"] == "session_ended"
                and e["payload"].get("reason") == "dropoff"):
            p = pmap.get(e["user_id"])
            if p:
                by_node[e["node_id"]].append(p)

    out = {}
    for node, ps in by_node.items():
        if not ps:
            continue
        out[node] = {
            "n": len(ps),
            "big5_avg": {
                "o": sum(p.big5_o for p in ps) / len(ps),
                "c": sum(p.big5_c for p in ps) / len(ps),
                "e": sum(p.big5_e for p in ps) / len(ps),
                "a": sum(p.big5_a for p in ps) / len(ps),
                "n": sum(p.big5_n for p in ps) / len(ps),
            },
            "top_nature_tags": _top_tags(ps),
        }
    return out


def _top_tags(personas: list[Persona], k: int = 3) -> list[list]:
    counts: dict[str, int] = defaultdict(int)
    for p in personas:
        for t in p.nature_tags:
            counts[t] += 1
    return [[t, c] for t, c in
            sorted(counts.items(), key=lambda x: -x[1])[:k]]


def summarize(events: list[dict], personas: list[Persona]) -> dict:
    """One-shot report combining every metric."""
    return {
        "total_runs": len({e["run_id"] for e in events}),
        "completion_rate": completion_rate(events),
        "retention_curve": retention_curve(events),
        "dropoff_by_node": dropoff_by_node(events),
        "choice_distribution": choice_distribution(events),
        "callback_label_distribution": callback_label_distribution(events),
        "trait_fit_by_dropoff": trait_fit_by_dropoff(events, personas),
    }


def print_report(report: dict) -> None:
    """Human-readable text version of the summarize() output."""
    print(f"\n=== Simulation Report ===")
    print(f"Total runs:      {report['total_runs']}")
    print(f"Completion rate: {report['completion_rate']:.1%}\n")

    print("Retention (fraction of runs reaching each node):")
    for node, r in sorted(report["retention_curve"].items(),
                          key=lambda x: -x[1]):
        bar = "█" * int(r * 30)
        print(f"  {node:8s} {r:.2f} {bar}")

    if report["dropoff_by_node"]:
        print("\nDrop-off hotspots:")
        for node, count in sorted(report["dropoff_by_node"].items(),
                                  key=lambda x: -x[1]):
            print(f"  {node:8s} {count} drop-offs")

    if report["choice_distribution"]:
        print("\nDecision choices:")
        for node, dist in report["choice_distribution"].items():
            print(f"  {node}: {dist}")

    if report["callback_label_distribution"]:
        print("\nCallback labels:")
        for node, dist in report["callback_label_distribution"].items():
            print(f"  {node}: {dist}")

    if report["trait_fit_by_dropoff"]:
        print("\nWho drops off where (trait fit):")
        for node, info in report["trait_fit_by_dropoff"].items():
            b = info["big5_avg"]
            tags = ", ".join(f"{t}({c})" for t, c in info["top_nature_tags"])
            print(f"  {node} (n={info['n']}): "
                  f"O={b['o']:.2f} C={b['c']:.2f} E={b['e']:.2f} "
                  f"A={b['a']:.2f} N={b['n']:.2f} | tags: {tags}")
    print()
