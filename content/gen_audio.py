"""ElevenLabs render pipeline. Script lines in, mp3s out.

D9: everything that can be pre-generated IS pre-generated. Live generation only
where liveness is the demo (the villain call, the callback).

    export ELEVENLABS_API_KEY=... MEERA_VOICE_ID=... VILLAIN_VOICE_ID=...
    python gen_audio.py lines/ep8.json --out ../server/audio

Line file format — a flat list so a non-programmer can edit it:

    [
      {"id": "001", "voice": "meera", "text": "Haan. Chal raha hai..."},
      {"id": "002", "voice": "villain", "text": "Meera beta. Neend nahi aa rahi?"}
    ]

This renders one mp3 per line. Assembling them against the timeline (and adding
room tone, the drip, the knocks, the CLUNK) happens in a DAW - that part is
craft, not code, and it is where the 15%-duck moment is actually won or lost.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

VOICE_ENV = {
    "meera": "MEERA_VOICE_ID",
    "villain": "VILLAIN_VOICE_ID",
    "narrator": "NARRATOR_VOICE_ID",
}

MODEL = "eleven_multilingual_v2"  # Hinglish


def render(text: str, voice_id: str, key: str) -> bytes:
    res = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": MODEL,
            # Low stability + high similarity keeps the breathy whisper alive;
            # high stability flattens exactly the performance we need.
            "voice_settings": {"stability": 0.35, "similarity_boost": 0.85, "style": 0.4},
        },
        timeout=120,
    )
    res.raise_for_status()
    return res.content


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("lines", type=Path)
    parser.add_argument("--out", type=Path, default=Path("../server/audio"))
    parser.add_argument("--only", help="render just this line id")
    args = parser.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY not set")

    args.out.mkdir(parents=True, exist_ok=True)
    lines = json.loads(args.lines.read_text())

    for line in lines:
        if args.only and line["id"] != args.only:
            continue

        env_key = VOICE_ENV.get(line["voice"])
        voice_id = os.environ.get(env_key or "", "")
        if not voice_id:
            print(f"  skip {line['id']}: {env_key} not set", file=sys.stderr)
            continue

        target = args.out / f"{line['id']}_{line['voice']}.mp3"
        target.write_bytes(render(line["text"], voice_id, key))
        print(f"  {target}  ({len(line['text'])} chars)")


if __name__ == "__main__":
    main()
