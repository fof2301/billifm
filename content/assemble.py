"""Mix per-line WAV takes onto a silent bed at their timestamps. Stdlib only.

Shared by gen_audio.py (ElevenLabs) and gen_audio_openai.py (OpenAI TTS) - two
callers, so it earns being its own module.

No ffmpeg on purpose: it is not installed on the build machine and `brew install
ffmpeg` is a long detour on a clock. Integer mixing with `wave` is enough for a
dialogue bed, which is all this needs to be. Room tone, the drip, the knocks and
the CLUNK get layered in a DAW afterwards - that part is craft, not code.
"""

from __future__ import annotations

import array
import json
import wave
from pathlib import Path

# Branch and variant lines do not live on the main timeline.
OFF_TIMELINE = {"014b", "014c", "017", "018", "019", "020"}


def wrap_pcm(pcm: bytes, path: Path, rate: int = 24000, channels: int = 1) -> None:
    """ElevenLabs pcm_24000 is raw 16-bit LE mono. Give it a WAV header."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def mix(
    takes_dir: Path,
    lines: list[dict],
    target: Path,
    duration: int = 360,
    include_off_timeline: bool = False,
) -> Path | None:
    """Lay each line's WAV at line['t'] onto a `duration`-second silent bed."""
    wanted = [l for l in lines if include_off_timeline or l["id"] not in OFF_TIMELINE]
    takes = [(l, takes_dir / f"{l['id']}_{l['voice']}.wav") for l in wanted]
    takes = [(l, p) for l, p in takes if p.exists()]
    if not takes:
        print(f"  no .wav takes in {takes_dir}")
        return None

    with wave.open(str(takes[0][1])) as probe:
        channels, width, rate = probe.getnchannels(), probe.getsampwidth(), probe.getframerate()
    if width != 2:
        print(f"  expected 16-bit takes, got {width * 8}-bit")
        return None

    bed = array.array("h", bytes(duration * rate * channels * 2))

    for line, path in takes:
        with wave.open(str(path)) as w:
            if (w.getnchannels(), w.getframerate()) != (channels, rate):
                print(f"  skip {line['id']}: format mismatch")
                continue
            samples = array.array("h", w.readframes(w.getnframes()))
        start = int(line["t"] * rate) * channels
        for i, s in enumerate(samples):
            j = start + i
            if j >= len(bed):
                break
            v = bed[j] + s
            bed[j] = 32767 if v > 32767 else (-32768 if v < -32768 else v)

    target = target.with_suffix(".wav")
    target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), "w") as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(bed.tobytes())

    print(f"\nassembled -> {target}  ({duration}s, {target.stat().st_size / 1_048_576:.1f}MB, {rate}Hz)")
    return target


def silence_report(path: Path, track_path: Path) -> None:
    """Prove the mic_listen window is actually silent.

    This is the check that caught the demo-breaking bug: mic_listen used to fire at
    t=300 while Meera's instruction line ran to 315.8s, so the phone metered its own
    speaker and always took the caught branch. Run this after every re-render -
    changing a voice changes line durations, which can re-break it.
    """
    import math

    track = json.loads(track_path.read_text())
    mic = next((e for e in track["events"] if e["type"] == "mic_listen"), None)
    if not mic:
        return

    with wave.open(str(path)) as w:
        rate = w.getframerate()
        data = array.array("h", w.readframes(w.getnframes()))

    def rms(a: float, b: float) -> float:
        s = data[int(a * rate) : int(b * rate)]
        return math.sqrt(sum(x * x for x in s) / len(s)) if len(s) else 0.0

    t, d = mic["t"], mic["duration_s"]
    before, window = rms(max(0, t - 15), t - 0.5), rms(t, t + d)
    print(f"\nsilence test @ t={t}s for {d}s")
    print(f"  speech before : rms {before:>7.0f}")
    print(f"  mic window    : rms {window:>7.0f}")
    if window < 1:
        print("  PASS - the mic opens into real silence")
    else:
        print("  FAIL - the phone would hear its own speaker and always take the caught branch")
        print(f"  fix: move mic_listen later than the end of the line starting at {t}s")
