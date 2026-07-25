"""Timing-aware script refinement. Makes the script physically fit the episode.

    python refine_lines.py                 # report only, spends nothing
    python refine_lines.py --write         # tighten overrunning lines via OpenAI

The problem this solves: a line that runs long does not just sound rushed, it
walks over the next event. If line 013 overruns by 6 seconds, Meera is still
talking when the UNKNOWN NUMBER call fires - and the single best moment in the
demo lands on top of her voice.

So every line gets a hard deadline: the next line, OR the next blocking effect
(fake_call / mic_listen), whichever comes first. Blocking effects are deadlines
you cannot negotiate.

Whisper pace is the binding constraint. Meera whispers ~80% of this episode, and
whispered Hinglish runs slower than spoken - we budget 2.0 words/sec, and only
allow 2.5 for the few lines marked as not whispered.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).parent
LINES = HERE / "lines" / "ep8.json"
TRACK = HERE / "event_track.json"

WHISPER_WPS = 2.0
SPOKEN_WPS = 2.5
BLOCKING = {"fake_call", "mic_listen"}
MODEL = os.environ.get("OPENAI_WRITER_MODEL", "gpt-5")

# Phrases the story cannot lose. If a rewrite drops one, we reject it.
LOAD_BEARING = {
    "003": ["Neem", "Saluja"],
    "004": ["kuch mat batana"],
    "013": ["tumhe call karega", "darr", "naam", "bharosa"],
    "015": ["Sehore", "Saluja", "Iqbal"],
    "016": ["Dus second"],
}


def is_whispered(line: dict) -> bool:
    d = line.get("dir", "").lower()
    return "whisper" in d or "barely" in d or "almost no voice" in d


def budget(line: dict) -> float:
    return WHISPER_WPS if is_whispered(line) else SPOKEN_WPS


def deadlines(lines: list[dict], events: list[dict], total: float) -> dict[str, float]:
    """Hard end time per line: next line start, or next blocking effect, whichever is first.

    NOTE the `>=` on the blocking comparison. It used to be `>`, which meant a line
    starting at the SAME second as a blocking effect looked like it had the whole
    rest of the episode. That hid a real bug: mic_listen was set to t=300 while
    Meera's 15.8s instruction line also started at 300, so the mic opened while the
    phone was still playing her voice - on speaker in a demo room it would hear
    itself and take the caught branch every time. Keep this `>=`.
    """
    blocking_ts = sorted(e["t"] for e in events if e["type"] in BLOCKING)
    out: dict[str, float] = {}
    for i, line in enumerate(lines):
        nxt = lines[i + 1]["t"] if i + 1 < len(lines) else total
        wall = next((t for t in blocking_ts if t >= line["t"]), total)
        out[line["id"]] = min(nxt, wall)
    return out


def measured(line: dict) -> float | None:
    """Real duration of a rendered take, if one exists. Truth beats estimation.

    The words/sec model underestimated TTS by up to 3.5s on long lines, which is
    the difference between fitting a slot and talking over the silence test. Once
    takes exist, always trust them.
    """
    take = HERE / "takes" / f"{line['id']}_{line['voice']}.mp3"
    if not take.exists():
        # takes/ is gitignored, so fall back to the duration recorded in the line
        # data. That keeps this check reproducible for anyone who has not rendered.
        return line.get("measured_s")
    try:
        out = subprocess.run(["afinfo", str(take)], capture_output=True, text=True, timeout=10).stdout
        m = re.search(r"estimated duration: ([\d.]+)", out)
        return float(m.group(1)) if m else None
    except Exception:  # noqa: BLE001
        return None


def analyse(lines: list[dict], events: list[dict], total: float):
    dl = deadlines(lines, events, total)
    rows = []
    for line in lines:
        words = len(line["text"].split())
        slot = dl[line["id"]] - line["t"]
        real = measured(line)
        need = real if real is not None else words / budget(line)
        # Leave a beat of air at the end of each line; a line that lands exactly
        # on the next cue sounds clipped.
        rows.append(
            {
                "id": line["id"],
                "t": line["t"],
                "deadline": dl[line["id"]],
                "slot": slot,
                "words": words,
                "need": need,
                "over": need > slot - 0.5,
                "source": "measured" if real is not None else "estimated",
                # When we have a real take, scale the word budget by its actual
                # delivered pace rather than the nominal one.
                "max_words": max(
                    3,
                    int((slot - 1.0) * (words / real if real else budget(line))),
                ),
                "whispered": is_whispered(line),
            }
        )
    return rows


def tighten(line: dict, row: dict, key: str) -> str | None:
    keep = LOAD_BEARING.get(line["id"], [])
    prompt = f"""You are tightening one line of a Hinglish audio-drama script so it physically fits its slot.

The line is spoken by {'MEERA (the heroine, captive, whispering)' if line['voice'] == 'meera' else 'THE VOICE (the antagonist, calm and courteous)'}.

Performance direction: {line['dir']}

CURRENT LINE ({row['words']} words, needs {row['need']:.1f}s at {budget(line)} words/sec):
{line['text']}

HARD CONSTRAINT: it must be at most {row['max_words']} words. It currently overruns its slot and would talk over the next cue.

Rules:
- Keep it Hinglish in Latin script, exactly the register it is already in. Do not translate to pure Hindi or pure English.
- Cut words, do not summarise. The result must read as a person speaking under stress, not as a précis.
- Preserve these exactly, they are load-bearing plot: {keep if keep else '(none)'}
- Keep the emotional turn of the line. If it ends on steel, it still ends on steel.
- Keep any unfinished sentence unfinished (a trailing em dash or ellipsis is deliberate).
- Return ONLY the rewritten line. No quotes, no commentary, no word count."""

    res = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": MODEL, "messages": [{"role": "user", "content": prompt}]},
        timeout=180,
    )
    res.raise_for_status()
    text = res.json()["choices"][0]["message"]["content"].strip().strip('"')

    missing = [k for k in keep if k.lower() not in text.lower()]
    if missing:
        print(f"    REJECTED - dropped load-bearing text: {missing}", file=sys.stderr)
        return None
    if len(text.split()) > row["max_words"]:
        print(f"    REJECTED - still {len(text.split())} words > {row['max_words']}", file=sys.stderr)
        return None
    return text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="apply rewrites (spends OpenAI tokens)")
    parser.add_argument("--out", type=Path, default=LINES)
    args = parser.parse_args()

    lines = json.loads(LINES.read_text())
    track = json.loads(TRACK.read_text())
    total = float(track["duration_s"])

    # Main path only: branch/variant lines live outside the main timeline.
    main = [l for l in lines if l["id"] not in {"014b", "014c", "017", "018", "019", "020"}]
    rows = analyse(main, track["events"], total)

    print(f"{'id':<6}{'t':>6}{'ends':>7}{'slot':>7}{'words':>7}{'needs':>8}{'src':>10}  verdict")
    for r in rows:
        print(
            f"{r['id']:<6}{r['t']:>6}{r['deadline']:>7.0f}{r['slot']:>7.0f}{r['words']:>7}"
            f"{r['need']:>8.1f}{r['source']:>10}  {'OVERRUNS' if r['over'] else 'ok'}"
        )

    over = [r for r in rows if r["over"]]
    speech = sum(r["need"] for r in rows)
    print(f"\nspeech {speech:.0f}s of {total:.0f}s · {len(over)} overrunning: {[r['id'] for r in over]}")

    if not over:
        print("script fits.")
        return
    if not args.write:
        print("\nrun with --write to tighten them.")
        return

    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY not set")

    by_id = {l["id"]: l for l in lines}
    changed = 0
    for r in over:
        line = by_id[r["id"]]
        print(f"\n  {r['id']}: {r['words']} -> max {r['max_words']} words")
        print(f"    before: {line['text']}")
        new = tighten(line, r, key)
        if new:
            line["text"] = new
            changed += 1
            print(f"    after:  {new}")
            print(f"    now {len(new.split())} words = {len(new.split())/budget(line):.1f}s (slot {r['slot']:.0f}s)")

    if changed:
        args.out.write_text(json.dumps(lines, indent=2, ensure_ascii=False) + "\n")
        print(f"\nrewrote {changed} line(s) -> {args.out}")


if __name__ == "__main__":
    main()
