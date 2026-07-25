"""Agent track vs human track. This IS the M7 acceptance test.

    python compare.py ../content/event_track.json /tmp/agent_track.json

The claim on stage is "the AI directed this episode and the app plays it
unchanged". The honest version of that claim needs a number, so this computes one:
for each human-placed effect, did the agent place the same effect type within
TOLERANCE_S? That ratio is the "human agrees >=80% of the time" line in the PRD.

Also prints what the agent placed that the human did not - which is the
interesting half. Twice during rehearsal you will find the agent's placement is
better than yours.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import validate

TOLERANCE_S = 5.0  # a cue is a beat, not a sample - 5s is the same story moment


def load(path: Path) -> dict:
    return validate.normalize(json.loads(path.read_text()))


def compare(human: dict, agent: dict) -> dict:
    h_events = sorted(human["events"], key=lambda e: e["t"])
    a_events = sorted(agent["events"], key=lambda e: e["t"])

    unmatched_agent = list(a_events)
    matches, misses = [], []

    for h in h_events:
        hit = next(
            (
                a
                for a in unmatched_agent
                if a["type"] == h["type"] and abs(float(a["t"]) - float(h["t"])) <= TOLERANCE_S
            ),
            None,
        )
        if hit:
            unmatched_agent.remove(hit)
            matches.append((h, hit))
        else:
            misses.append(h)

    return {
        "matches": matches,
        "misses": misses,
        "extra": unmatched_agent,
        "agreement": len(matches) / len(h_events) if h_events else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("human", type=Path)
    parser.add_argument("agent", type=Path)
    parser.add_argument("--threshold", type=float, default=0.80)
    args = parser.parse_args()

    human, agent = load(args.human), load(args.agent)

    errors = validate.validate(agent)
    print(f"agent track validity: {'PLAYABLE UNCHANGED' if not errors else f'{len(errors)} ERRORS'}")
    for err in errors:
        print(f"  x {err}")

    result = compare(human, agent)

    print(f"\nmatched {len(result['matches'])}/{len(human['events'])} human effects "
          f"(+/-{TOLERANCE_S:.0f}s, same type)")
    for h, a in result["matches"]:
        drift = float(a["t"]) - float(h["t"])
        print(f"  = {h['type']:<16} human {h['t']:>6.1f}s  agent {a['t']:>6.1f}s  ({drift:+.1f}s)")

    if result["misses"]:
        print("\nthe agent missed:")
        for h in result["misses"]:
            print(f"  - {h['type']:<16} @{h['t']:>6.1f}s  cue: {h.get('cue', '')[:60]}")

    if result["extra"]:
        print("\nthe agent added (read these - sometimes it is right and you were not):")
        for a in result["extra"]:
            print(f"  + {a['type']:<16} @{a['t']:>6.1f}s  why: {a.get('why', '')[:70]}")

    agreement = result["agreement"]
    ok = agreement >= args.threshold and not errors
    print(f"\nagreement {agreement:.0%} vs threshold {args.threshold:.0%} -> {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
