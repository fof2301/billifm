"""Render the episode with OpenAI TTS. The unblock path when ElevenLabs is gated.

    python gen_audio_openai.py                       # render every line
    python gen_audio_openai.py --only 006            # one line
    python gen_audio_openai.py --assemble            # stitch to server/audio/

Why this exists: ElevenLabs free-tier keys cannot use library voices via the API
(HTTP 402), so it is unavailable until someone upgrades or supplies custom voice
IDs. Meanwhile `gpt-4o-mini-tts` takes a free-text `instructions` field - which is
exactly what the `dir` field in lines/ep8.json already contains. A whisper-heavy
Hinglish episode is a better fit for instruction-steered TTS than for a voice
preset anyway.

Honest limitation: this is a scratch/preview render. OpenAI voices are not
Hinglish-native and will put an English cadence on some words. Good enough to
build the engine against, cut the film's timing to, and rehearse with. Re-render
with ElevenLabs multilingual_v2 for the final take if the budget appears.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).parent
LINES = HERE / "lines" / "ep8.json"
MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")

# Meera: mid-range, warm, breathy under stress. The Voice: low, unhurried, a smile
# in it. `ash` and `onyx` are the closest of the OpenAI set.
VOICES = {"meera": "ash", "villain": "onyx", "narrator": "sage"}

# Steering that applies to every line, on top of the per-line direction.
BASE_STYLE = (
    "This is a Hinglish (Hindi-English mixed) audio thriller. Pronounce the Hindi words "
    "with natural Indian pronunciation, not anglicised. Speak intimately, very close to "
    "the microphone, as if into a hidden phone. Never announce or perform - underplay. "
    "Do not read stage directions aloud."
)


def render(line: dict, key: str, fmt: str = "mp3") -> bytes:
    instructions = f"{BASE_STYLE}\n\nFor this line specifically: {line['dir']}"
    res = httpx.post(
        "https://api.openai.com/v1/audio/speech",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": MODEL,
            "voice": VOICES.get(line["voice"], "ash"),
            "input": line["text"],
            "instructions": instructions,
            "response_format": fmt,
        },
        timeout=180,
    )
    if res.status_code >= 400:
        raise RuntimeError(f"{res.status_code}: {res.text[:300]}")
    return res.content


def assemble_wav(out_dir: Path, lines: list[dict], target: Path, duration: int = 360) -> bool:
    """Mix the WAV takes onto a silent bed at their timestamps. Stdlib only.

    Deliberately no ffmpeg: it is not installed here and `brew install ffmpeg` is a
    long detour on a clock. `wave` + `audioop`-free integer mixing is enough for a
    dialogue bed, which is all this needs to be - room tone, the drip, the knocks
    and the CLUNK get layered in a DAW afterwards.
    """
    import array
    import wave as wavemod

    main = [l for l in lines if l["id"] not in {"014b", "014c", "017", "018", "019", "020"}]
    takes = [(l, out_dir / f"{l['id']}_{l['voice']}.wav") for l in main]
    takes = [(l, p) for l, p in takes if p.exists()]
    if not takes:
        print("no .wav takes found - render with --format wav first", file=sys.stderr)
        return False

    with wavemod.open(str(takes[0][1])) as probe:
        channels, width, rate = probe.getnchannels(), probe.getsampwidth(), probe.getframerate()
    if width != 2:
        print(f"expected 16-bit takes, got {width*8}-bit", file=sys.stderr)
        return False

    bed = array.array("h", bytes(duration * rate * channels * 2))

    for line, path in takes:
        with wavemod.open(str(path)) as w:
            if (w.getnchannels(), w.getframerate()) != (channels, rate):
                print(f"  skip {line['id']}: format mismatch", file=sys.stderr)
                continue
            samples = array.array("h", w.readframes(w.getnframes()))
        start = int(line["t"] * rate) * channels
        for i, s in enumerate(samples):
            j = start + i
            if j >= len(bed):
                break
            mixed = bed[j] + s
            bed[j] = 32767 if mixed > 32767 else (-32768 if mixed < -32768 else mixed)

    target = target.with_suffix(".wav")
    target.parent.mkdir(parents=True, exist_ok=True)
    with wavemod.open(str(target), "w") as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(bed.tobytes())

    print(f"\nassembled -> {target} ({duration}s, {target.stat().st_size/1_048_576:.1f}MB)")
    print(f'Set "audio": "{target.name}" in event_track.json to play it.')
    return True


def assemble(out_dir: Path, lines: list[dict], target: Path, duration: int = 360) -> bool:
    """Lay the rendered lines onto a silent 360s bed at their timestamps.

    Needs ffmpeg. Without it, the per-line mp3s are still usable - import them into
    a DAW at the timestamps in lines/ep8.json, which is what Content will do anyway
    to add room tone, the drip, the knocks and the CLUNK.
    """
    if not subprocess.run(["which", "ffmpeg"], capture_output=True).returncode == 0:
        print("\nffmpeg not installed - skipping assembly.", file=sys.stderr)
        print("Per-line mp3s are in", out_dir, file=sys.stderr)
        print("Import them into a DAW at the timestamps in lines/ep8.json.", file=sys.stderr)
        return False

    main = [l for l in lines if l["id"] not in {"014b", "014c", "017", "018", "019", "020"}]
    inputs, filters = [], []
    for i, line in enumerate(main):
        path = out_dir / f"{line['id']}_{line['voice']}.mp3"
        if not path.exists():
            continue
        inputs += ["-i", str(path)]
        filters.append(f"[{len(inputs)//2 - 1}:a]adelay={int(line['t']*1000)}|{int(line['t']*1000)}[a{i}]")

    mix = "".join(f"[a{i}]" for i in range(len(filters)))
    graph = ";".join(filters) + f";{mix}amix=inputs={len(filters)}:normalize=0[out]"

    cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", graph, "-map", "[out]",
           "-t", str(duration), "-codec:a", "libmp3lame", "-q:a", "3", str(target)]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print(result.stderr.decode()[-500:], file=sys.stderr)
        return False
    print(f"\nassembled -> {target} ({target.stat().st_size/1_048_576:.1f}MB)")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=HERE / "takes")
    parser.add_argument("--only", help="render just this line id")
    parser.add_argument("--assemble", action="store_true")
    parser.add_argument("--format", default="mp3", choices=["mp3", "wav"],
                        help="wav is required for stdlib assembly")
    parser.add_argument("--target", type=Path, default=HERE.parent / "server" / "audio" / "ep8.mp3")
    args = parser.parse_args()

    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY not set")

    args.out.mkdir(parents=True, exist_ok=True)
    lines = json.loads(LINES.read_text())
    todo = [l for l in lines if not args.only or l["id"] == args.only]

    total_chars = 0
    for line in todo:
        target = args.out / f"{line['id']}_{line['voice']}.{args.format}"
        try:
            audio = render(line, key, args.format)
        except Exception as err:  # noqa: BLE001
            print(f"  FAIL {line['id']}: {err}", file=sys.stderr)
            continue
        target.write_bytes(audio)
        total_chars += len(line["text"])
        print(f"  {line['id']:<5} {line['voice']:<8} {len(line['text']):>4}ch  {len(audio)/1024:>7.1f}KB  {target.name}")

    print(f"\n{len(todo)} lines, {total_chars} characters -> {args.out}")

    if args.assemble:
        if args.format == "wav":
            assemble_wav(args.out, lines, args.target)
        else:
            assemble(args.out, lines, args.target)


if __name__ == "__main__":
    main()
