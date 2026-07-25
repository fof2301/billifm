"""Audition ElevenLabs voices on the two hardest lines in the episode.

    python audition_voices.py              # render auditions, print quota spend
    python audition_voices.py --quota      # just show remaining characters

Why an audition step: nobody can pick a voice from a name. "Lily - Velvety
Actress" tells you nothing about whether she can whisper Hinglish at 15% gain in a
dark room. So render the two lines that actually decide it and listen.

Free tier is 10,000 characters total and there is no Indian-accented premade
voice, so this is a compromise from the start - the point is to find the least-bad
option before spending the budget on a full render. Auditions cost ~410
characters; the full 22-line episode costs 2,629.

The two audition lines are chosen deliberately:
  006 - Meera's whisper under the volume duck. If this is not intelligible at low
        gain it fails M1, which is the first thing a judge experiences.
  011 - The Voice through a door. Must sound genuinely kind. If it reads as
        sinister, the whole character is wrong.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).parent
LINES = json.loads((HERE / "lines" / "ep8.json").read_text())
BY_ID = {l["id"]: l for l in LINES}

MEERA_CANDIDATES = {
    "sarah": "EXAVITQu4vr4xnSDxMaL",    # female american young - closest to 28
    "lily": "pFZP5JQG7iQjIQuC4Bku",     # velvety actress - performance range
    "alice": "Xb7hH8MSUJpSbSDYk0k2",    # clear - intelligibility under the duck
    "jessica": "cgSgspJ2msm6clMCkdW9",  # bright, warm
}
VOICE_CANDIDATES = {
    "george": "JBFqnCBsd6RMkjVDRZzb",   # warm captivating storyteller
    "bill": "pqHfZKP75CvOlQylNhV4",     # wise, mature - the uncle register
    "brian": "nPczCjzI2devNBz1zQrb",    # deep, resonant
    "daniel": "onwK4e9ZLuTAKqWW03F9",   # steady broadcaster
}

# Low stability keeps the breath and the shake. High stability flattens exactly
# the performance this episode lives on.
SETTINGS = {"stability": 0.30, "similarity_boost": 0.85, "style": 0.45, "use_speaker_boost": True}


def quota(key: str) -> tuple[int, int]:
    r = httpx.get("https://api.elevenlabs.io/v1/user/subscription",
                  headers={"xi-api-key": key}, timeout=30)
    d = r.json()
    return d.get("character_count", 0), d.get("character_limit", 0)


def tts(text: str, voice_id: str, key: str, model: str) -> bytes:
    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        json={"text": text, "model_id": model, "voice_settings": SETTINGS},
        timeout=180,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code}: {r.text[:200]}")
    return r.content


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=HERE / "auditions")
    ap.add_argument("--model", default="eleven_multilingual_v2")
    ap.add_argument("--quota", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY not set")

    used, limit = quota(key)
    print(f"quota before: {used:,}/{limit:,}  ({limit-used:,} left)")
    if args.quota:
        return

    meera_line = BY_ID["006"]["text"]
    voice_line = BY_ID["011"]["text"]
    planned = len(meera_line) * len(MEERA_CANDIDATES) + len(voice_line) * len(VOICE_CANDIDATES)
    print(f"this run will spend ~{planned:,} characters\n")
    if planned > (limit - used):
        sys.exit("not enough quota")

    args.out.mkdir(parents=True, exist_ok=True)

    print(f"MEERA — line 006 (the whisper under the duck):\n  \"{meera_line}\"")
    for name, vid in MEERA_CANDIDATES.items():
        try:
            data = tts(meera_line, vid, key, args.model)
        except Exception as err:  # noqa: BLE001
            print(f"    FAIL {name}: {err}")
            continue
        p = args.out / f"meera_{name}.mp3"
        p.write_bytes(data)
        print(f"    {p.name:<24} {len(data)/1024:>7.1f}KB")

    print(f"\nTHE VOICE — line 011 (through the door, must sound kind):\n  \"{voice_line}\"")
    for name, vid in VOICE_CANDIDATES.items():
        try:
            data = tts(voice_line, vid, key, args.model)
        except Exception as err:  # noqa: BLE001
            print(f"    FAIL {name}: {err}")
            continue
        p = args.out / f"villain_{name}.mp3"
        p.write_bytes(data)
        print(f"    {p.name:<24} {len(data)/1024:>7.1f}KB")

    now, _ = quota(key)
    print(f"\nquota after: {now:,}/{limit:,}  ({limit-now:,} left)")
    print(f"\nListen to {args.out}/ and pick one of each.")
    print("Then put the two voice IDs in .env as MEERA_VOICE_ID and VILLAIN_VOICE_ID")
    print("and run: python gen_audio.py lines/ep8.json --out ../server/audio")
    print(f"\nA full 22-line render costs {sum(len(l['text']) for l in LINES):,} characters.")


if __name__ == "__main__":
    main()
