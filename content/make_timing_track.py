"""Generate a timing-reference track so P1 is never blocked on audio.

    python make_timing_track.py

Writes a 6-minute WAV with a distinct beep at every event timestamp in
event_track.json, plus a quiet tick every 10s for orientation.

Why this beats a silent placeholder: you can hear the cue. When the torch fires
you know instantly whether it landed on the beep or 400ms late - which is exactly
the ±300ms acceptance criterion for G1. With silence you can only confirm that
something happened eventually.

Throw it away once the real ep8.mp3 exists. Stdlib only - no ffmpeg, no deps.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import wave
from pathlib import Path

RATE = 22050
HERE = Path(__file__).parent

# Frequency per effect type, so you can identify the cue by ear alone.
TONES = {
    "volume_duck": 440,
    "screen_dim": 494,
    "screen_blackout": 262,
    "flashlight": 880,
    "haptic": 659,
    "fake_call": 1047,
    "mic_listen": 330,
}


def sine(freq: float, ms: int, amp: float = 0.32) -> list[int]:
    n = int(RATE * ms / 1000)
    out = []
    for i in range(n):
        # Short fade in/out so the beeps do not click.
        env = min(1.0, i / 200, (n - i) / 200)
        out.append(int(32767 * amp * env * math.sin(2 * math.pi * freq * i / RATE)))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--track", type=Path, default=HERE / "event_track.json")
    parser.add_argument("--out", type=Path, default=HERE.parent / "server" / "audio" / "ep8_timing.wav")
    args = parser.parse_args()

    track = json.loads(args.track.read_text())
    duration = int(track.get("duration_s", 360))
    samples = [0] * (RATE * duration)

    def place(at_s: float, data: list[int]) -> None:
        start = int(at_s * RATE)
        for i, value in enumerate(data):
            if start + i < len(samples):
                samples[start + i] = max(-32767, min(32767, samples[start + i] + value))

    # Orientation ticks every 10s, very quiet.
    for second in range(0, duration, 10):
        place(second, sine(1200, 25, amp=0.05))

    for event in track["events"]:
        freq = TONES.get(event["type"], 700)
        place(event["t"], sine(freq, 220))
        print(f"  {event['t']:>6.1f}s  {freq:>5}Hz  {event['type']:<16} {event['id']}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.out), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(b"".join(struct.pack("<h", s) for s in samples))

    size_mb = args.out.stat().st_size / 1_048_576
    print(f"\n{args.out}  ({duration}s, {size_mb:.1f}MB)")
    print(
        f'\nTo use it: set "audio": "{args.out.name}" in {args.track.name}, '
        "start the server, press play, and check each effect lands on its beep.\n"
        "Revert that field the moment the real ep8.mp3 lands.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
