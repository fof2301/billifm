"""M7 — the AI Sutradhar. Raw transcript in, playable Event Track out.

This is the headline AI feature and it is never cut (D11). It is also the piece
that is completely independent of the phone, so it can be built in parallel from
hour zero without waiting on anyone.

    # the live stage demo: paste a transcript, watch direction stream out
    python annotate.py transcripts/ep8.txt

    # prove the platform claim: agent output == what the app plays
    python annotate.py transcripts/ep8.txt --out /tmp/agent_track.json
    python -c "import json;print(len(json.load(open('/tmp/agent_track.json'))['events']))"

    # the honesty check: does it hold up on episodes it has never seen?
    python annotate.py transcripts/unseen_1.txt --quiet
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

import validate
from schema import EVENT_TRACK_SCHEMA

HERE = Path(__file__).parent
MODEL = os.environ.get("OPENAI_DIRECTOR_MODEL", "gpt-4.1")
URL = "https://api.openai.com/v1/chat/completions"


def annotate(transcript: str, episode: int, duration_s: float) -> dict:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY not set")

    system = (HERE / "prompts" / "annotator.md").read_text()
    user = (
        f"Episode number: {episode}\n"
        f"Audio duration: {duration_s:.0f} seconds\n"
        f"Audio filename: ep{episode}.mp3\n\n"
        f"TRANSCRIPT:\n{transcript}"
    )

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "event_track",
                "strict": False,
                "schema": EVENT_TRACK_SCHEMA,
            },
        },
    }

    with httpx.Client(timeout=120) as client:
        res = client.post(URL, headers={"Authorization": f"Bearer {key}"}, json=payload)
        res.raise_for_status()
        return json.loads(res.json()["choices"][0]["message"]["content"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcript -> playable Event Track")
    parser.add_argument("transcript", type=Path)
    parser.add_argument("--episode", type=int, default=8)
    parser.add_argument("--duration", type=float, default=360.0)
    parser.add_argument("--out", type=Path, help="write the validated track here")
    parser.add_argument("--quiet", action="store_true", help="only print the verdict")
    args = parser.parse_args()

    raw = annotate(args.transcript.read_text(), args.episode, args.duration)
    track = validate.normalize(raw)
    errors = validate.validate(track)

    if not args.quiet:
        print(json.dumps(track, indent=2, ensure_ascii=False))
        print("\n--- direction ---", file=sys.stderr)
        for event in track["events"]:
            print(f"  {event['t']:>6.1f}s  {event['type']:<16} {event.get('why', '')}", file=sys.stderr)

    moments = validate.count_sensory_moments(track["events"])
    print(
        f"\n{len(track['events'])} events · {moments} sensory moments · "
        f"{'PLAYABLE UNCHANGED' if not errors else f'{len(errors)} VALIDATION ERRORS'}",
        file=sys.stderr,
    )
    for err in errors:
        print(f"  ✗ {err}", file=sys.stderr)

    if args.out and not errors:
        args.out.write_text(json.dumps(track, indent=2, ensure_ascii=False))
        print(f"  → {args.out}", file=sys.stderr)

    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
