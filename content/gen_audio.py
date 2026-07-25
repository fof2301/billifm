"""ElevenLabs render pipeline — the real takes. Script lines in, episode out.

    python gen_audio.py --quota          # check remaining characters, spend nothing
    python gen_audio.py --only 006       # one line
    python gen_audio.py --assemble       # render all + mix to server/audio/ep8.wav

Cast (auditioned, see audition_voices.py):
    MEERA      Jessica  cgSgspJ2msm6clMCkdW9
    THE VOICE  George   JBFqnCBsd6RMkjVDRZzb

BUDGET DISCIPLINE. The account is free tier: 10,000 characters, total, ever. A
full 22-line render costs 2,629. So this script refuses to start if the remaining
quota would not cover the job, and prints the spend before and after. Do not
loop it "just to try a setting" - use --only on one line instead.

Renders as pcm_24000 and wraps to WAV so assembly needs no ffmpeg (see assemble.py).
WAV also avoids a second lossy generation before the DAW pass.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx

import assemble

HERE = Path(__file__).parent
LINES = HERE / "lines" / "ep8.json"
TRACK = HERE / "event_track.json"

MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
RATE = 24000

VOICE_ENV = {"meera": "MEERA_VOICE_ID", "villain": "VILLAIN_VOICE_ID", "narrator": "NARRATOR_VOICE_ID"}

# Low stability keeps the breath and the shake alive. High stability flattens
# exactly the performance this episode lives on - Meera whispers 80% of it.
# style lifts delivery; speaker_boost helps intelligibility at the 15% duck.
SETTINGS = {"stability": 0.30, "similarity_boost": 0.85, "style": 0.45, "use_speaker_boost": True}


def quota(key: str) -> tuple[int, int]:
    d = httpx.get(
        "https://api.elevenlabs.io/v1/user/subscription",
        headers={"xi-api-key": key},
        timeout=30,
    ).json()
    return d.get("character_count", 0), d.get("character_limit", 0)


def render(text: str, voice_id: str, key: str) -> bytes:
    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        params={"output_format": f"pcm_{RATE}"},
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        json={"text": text, "model_id": MODEL, "voice_settings": SETTINGS},
        timeout=180,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code}: {r.text[:250]}")
    return r.content


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=HERE / "takes_11")
    ap.add_argument("--only", help="render just this line id")
    ap.add_argument("--assemble", action="store_true")
    ap.add_argument("--target", type=Path, default=HERE.parent / "server" / "audio" / "ep8.wav")
    ap.add_argument("--quota", action="store_true")
    ap.add_argument("--force", action="store_true", help="render even if quota looks tight")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY not set")

    used, limit = quota(key)
    left = limit - used
    print(f"quota: {used:,}/{limit:,} used, {left:,} left")
    if args.quota:
        return

    lines = json.loads(LINES.read_text())
    todo = [l for l in lines if not args.only or l["id"] == args.only]
    if not todo:
        sys.exit(f"no line with id {args.only!r}")

    cost = sum(len(l["text"]) for l in todo)
    print(f"this run costs {cost:,} characters -> {left - cost:,} would remain\n")
    if cost > left and not args.force:
        sys.exit("not enough quota; use --only, or --force if you know what you are doing")

    args.out.mkdir(parents=True, exist_ok=True)
    ok = 0
    for line in todo:
        env_key = VOICE_ENV.get(line["voice"])
        voice_id = os.environ.get(env_key or "", "")
        if not voice_id:
            print(f"  skip {line['id']}: {env_key} not set")
            continue
        try:
            pcm = render(line["text"], voice_id, key)
        except Exception as err:  # noqa: BLE001
            print(f"  FAIL {line['id']}: {err}")
            continue
        target = args.out / f"{line['id']}_{line['voice']}.wav"
        assemble.wrap_pcm(pcm, target, rate=RATE)
        dur = len(pcm) / 2 / RATE
        ok += 1
        print(f"  {line['id']:<5} {line['voice']:<8} {len(line['text']):>4}ch  {dur:>5.1f}s  {target.name}")

    now, _ = quota(key)
    print(f"\n{ok}/{len(todo)} rendered · quota now {now:,}/{limit:,} ({limit-now:,} left)")

    if args.assemble:
        out = assemble.mix(args.out, lines, args.target, duration=int(json.loads(TRACK.read_text())["duration_s"]))
        if out:
            # Changing voices changes line durations, which can re-break the
            # silence test. Never skip this.
            assemble.silence_report(out, TRACK)
            print(f'\nSet "audio": "{out.name}" in event_track.json to play it.')


if __name__ == "__main__":
    main()
