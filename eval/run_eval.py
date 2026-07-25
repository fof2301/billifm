"""CLI: run a Sutradhar sim on a directed_story + persona CSV, then report.

Usage:
    # 1. Generate a persona corpus (defaults to 200 across two cohorts)
    python -m eval.generate_personas -n 200

    # 2. Simulate against the manual v0 directed story
    python -m eval.run_eval simulate \\
        --story content/directed_story_v0.json \\
        --personas eval/out/personas.csv \\
        --cohort-map eval/out/cohort_map.json \\
        --model gpt-4o-mini \\
        --out eval/out/events.jsonl

    # 3. Aggregate to a text report
    python -m eval.run_eval report \\
        --events eval/out/events.jsonl \\
        --personas eval/out/personas.csv

Env: OPENAI_API_KEY must be set locally; on Databricks the client reads
it from the `sutradhar/OPENAI_API_KEY` secret automatically.
"""

from __future__ import annotations
import argparse
import csv
import json
import sys
from pathlib import Path

from .schemas import Persona
from .sim import simulate, write_events, load_story
from .aggregate import load_events, summarize, print_report


def load_personas(path: Path) -> list[Persona]:
    personas: list[Persona] = []
    with path.open() as f:
        for row in csv.DictReader(f):
            for k in ("big5_o", "big5_c", "big5_e", "big5_a", "big5_n"):
                row[k] = float(row[k])
            row["nature_tags"] = [
                t.strip() for t in row.get("nature_tags", "").split("|")
                if t.strip()
            ]
            row["past_watches"] = [
                t.strip() for t in row.get("past_watches", "").split("|")
                if t.strip()
            ]
            row["content_pref_vec"] = (
                json.loads(row["content_pref_vec"])
                if row.get("content_pref_vec") else []
            )
            for k in ("watch_completion_rate", "avg_session_min"):
                row[k] = float(row[k]) if row.get(k) else None
            for k in ("preferred_mode", "call_response_style"):
                row[k] = row[k] or None
            personas.append(Persona(**row))
    return personas


def _cmd_simulate(args) -> None:
    story = load_story(args.story)
    personas = load_personas(args.personas)
    cohort_hints = (
        json.loads(args.cohort_map.read_text()) if args.cohort_map else None
    )
    print(
        f"Simulating {len(personas)} personas × {args.rollouts} rollouts "
        f"on '{story.get('title', story['story_id'])}' with model {args.model}...",
        file=sys.stderr,
    )
    events = simulate(
        story, personas,
        model=args.model,
        rollouts=args.rollouts,
        dropoff_threshold=args.dropoff_threshold,
        cohort_hints=cohort_hints,
    )
    write_events(events, args.out)
    print(f"Wrote {len(events)} events to {args.out}", file=sys.stderr)


def _cmd_report(args) -> None:
    events = load_events(args.events)
    personas = load_personas(args.personas)
    report = summarize(events, personas)
    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print_report(report)


def main() -> None:
    ap = argparse.ArgumentParser(prog="eval")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sim = sub.add_parser("simulate", help="Run persona sims on a directed_story")
    sim.add_argument("--story", required=True, type=Path,
                     help="Path to a directed_story.json")
    sim.add_argument("--personas", required=True, type=Path)
    sim.add_argument("--cohort-map", type=Path,
                     help="Optional persona_id -> cohort JSON")
    sim.add_argument("--model", default="gpt-4o-mini")
    sim.add_argument("--rollouts", type=int, default=1,
                     help="Runs per persona (1 is fine; noise averages out at scale)")
    sim.add_argument("--dropoff-threshold", type=float, default=0.30,
                     help="Persona drops off if engagement < this")
    sim.add_argument("--out", default=Path("eval/out/events.jsonl"),
                     type=Path)
    sim.set_defaults(func=_cmd_simulate)

    rep = sub.add_parser("report", help="Aggregate an event log")
    rep.add_argument("--events", required=True, type=Path)
    rep.add_argument("--personas", required=True, type=Path)
    rep.add_argument("--json", action="store_true")
    rep.set_defaults(func=_cmd_report)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
