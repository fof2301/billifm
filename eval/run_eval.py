"""CLI: load a story + persona CSV, simulate, then report.

Usage:
    python -m eval.run_eval simulate \\
        --story eval/examples/story.json \\
        --personas eval/examples/personas.csv \\
        --model qwen3:4b \\
        --rollouts 3 \\
        --out eval/out/events.jsonl

    python -m eval.run_eval report \\
        --events eval/out/events.jsonl \\
        --personas eval/examples/personas.csv
"""

from __future__ import annotations
import argparse
import csv
import json
import sys
from pathlib import Path

from .schemas import Story, Persona
from .sim import simulate, write_events
from .aggregate import load_events, summarize, print_report


def load_story(path: Path) -> Story:
    return Story.model_validate_json(path.read_text())


def load_personas(path: Path) -> list[Persona]:
    """Parse a persona CSV. Pipe-separated for list fields (nature_tags,
    past_watches); content_pref_vec is a JSON array (quote the field)."""
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
    print(
        f"Simulating {len(personas)} personas × {args.rollouts} rollouts "
        f"on '{story.title}' with model {args.model}...",
        file=sys.stderr,
    )
    events = simulate(
        story, personas,
        model=args.model,
        rollouts=args.rollouts,
        dropoff_threshold=args.dropoff_threshold,
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

    sim = sub.add_parser("simulate", help="Run persona sims on a story")
    sim.add_argument("--story", required=True, type=Path)
    sim.add_argument("--personas", required=True, type=Path)
    sim.add_argument("--model", default="qwen3:4b",
                     help="Ollama model tag (local or :cloud)")
    sim.add_argument("--rollouts", type=int, default=3,
                     help="Runs per persona (majority vote for stability)")
    sim.add_argument("--dropoff-threshold", type=float, default=0.35,
                     help="Persona drops off if engagement < this")
    sim.add_argument("--out", default=Path("eval/out/events.jsonl"),
                     type=Path)
    sim.set_defaults(func=_cmd_simulate)

    rep = sub.add_parser("report", help="Aggregate an event log")
    rep.add_argument("--events", required=True, type=Path)
    rep.add_argument("--personas", required=True, type=Path)
    rep.add_argument("--json", action="store_true",
                     help="Emit machine-readable JSON instead of text")
    rep.set_defaults(func=_cmd_report)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
