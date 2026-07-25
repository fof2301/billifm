"""Module 1a — synthesize the behaviour corpus (M10a).

    python make_sessions.py --count 10000 --out sessions.jsonl

Generates listener sessions carrying Sutradhar's *unfair* behaviour vectors: not
just skips and drop-offs, but did they answer the call, did they talk or stay
silent, did they pass the silence test. No other audio product can collect these,
which is the whole argument for the Genome.

THE DATA IS SYNTHETIC AND WE SAY SO ON STAGE. The pipeline is real; the listeners
are simulated. agents.md commits us to that disclosure - honour it.

Design note that matters for the demo: sessions are drawn from LATENT cohorts with
overlapping, noisy parameters, and the cohort label is NOT written into the output.
compute.py has to rediscover the structure by clustering. That makes the genome a
computed result rather than an echo of a constant we typed in - which is the
difference between a pipeline and a mock.

Deterministic: seeded per index, so a re-run is comparable.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

# Latent cohorts. These parameters are the ground truth compute.py must recover.
COHORTS = [
    {
        "_name": "night_thriller_binger",
        "weight": 0.42,
        "hour": (21, 26),          # 26 -> 2AM
        "completion": (0.86, 0.10),
        "answers_call": 0.91,
        "talks_on_call": 0.78,
        "passes_silence": 0.83,
        "returns_24h": 0.79,
        "exposition_tolerance_s": (38, 12),
        "binge": (3.1, 1.2),
        "opens_board": 0.61,
        "calls_iqbal": 0.44,
        "skips": (0.7, 0.9),
    },
    {
        "_name": "daytime_casual_commuter",
        "weight": 0.38,
        "hour": (7, 19),
        "completion": (0.51, 0.19),
        "answers_call": 0.39,
        "talks_on_call": 0.31,
        "passes_silence": 0.22,     # a train is never quiet
        "returns_24h": 0.34,
        "exposition_tolerance_s": (16, 7),
        "binge": (1.3, 0.6),
        "opens_board": 0.18,
        "calls_iqbal": 0.06,
        "skips": (3.4, 2.1),
    },
    {
        "_name": "weekend_slow_burn",
        "weight": 0.20,
        "hour": (14, 23),
        "completion": (0.74, 0.14),
        "answers_call": 0.66,
        "talks_on_call": 0.58,
        "passes_silence": 0.61,
        "returns_24h": 0.57,
        "exposition_tolerance_s": (74, 22),
        "binge": (2.2, 1.0),
        "opens_board": 0.42,
        "calls_iqbal": 0.27,
        "skips": (1.2, 1.1),
    },
]

CLIFFHANGERS = ["threat_to_listener", "character_peril", "revelation", "soft_out"]
# How well each cliffhanger type converts a return, per cohort index.
CLIFF_LIFT = {
    "threat_to_listener": [1.18, 0.86, 0.94],
    "character_peril": [0.92, 0.97, 1.16],
    "revelation": [1.05, 1.02, 1.08],
    "soft_out": [0.71, 0.88, 0.83],
}
OUTCOMES = ["A", "B", "C", "FALLBACK"]


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def make_session(index: int) -> dict:
    rng = random.Random(index * 104729)

    r = rng.random()
    acc = 0.0
    ci = 0
    for i, c in enumerate(COHORTS):
        acc += c["weight"]
        if r <= acc:
            ci = i
            break
    c = COHORTS[ci]

    completion = clamp(rng.gauss(*c["completion"]))
    cliff = rng.choice(CLIFFHANGERS)
    answered = rng.random() < c["answers_call"]
    talked = answered and rng.random() < c["talks_on_call"]

    # Drop-off only if they did not finish; biased toward the exposition window.
    dropoff = None
    if completion < 0.95:
        dropoff = round(min(360.0, max(5.0, rng.gauss(360 * completion, 28))), 1)

    if not answered:
        outcome = "FALLBACK"
    elif not talked:
        outcome = "FALLBACK" if rng.random() < 0.55 else "B"
    else:
        outcome = rng.choices(OUTCOMES, weights=[0.24, 0.46, 0.18, 0.12])[0]

    return_p = clamp(c["returns_24h"] * CLIFF_LIFT[cliff][ci] * (0.55 + 0.45 * completion))

    return {
        "session_id": f"s{index:06d}",
        # NOTE: no cohort label. compute.py must find it.
        "hour_of_day": rng.randrange(*c["hour"]) % 24,
        "completion": round(completion, 3),
        "dropoff_s": dropoff,
        "skips": max(0, int(rng.gauss(*c["skips"]))),
        "replays": max(0, int(rng.gauss(0.6, 0.9))),
        "first_skip_s": round(max(4.0, rng.gauss(*c["exposition_tolerance_s"])), 1),
        "binge_episodes": max(1, int(rng.gauss(*c["binge"]))),
        "cliffhanger_type": cliff,
        "returned_24h": rng.random() < return_p,
        "answered_call": answered,
        "talked_on_call": talked,
        "call_turns": 0 if not answered else max(1, int(rng.gauss(4.2 if talked else 1.4, 1.6))),
        "call_outcome": outcome,
        "silence_test_passed": rng.random() < c["passes_silence"],
        "opened_board": rng.random() < c["opens_board"],
        "called_iqbal": rng.random() < c["calls_iqbal"],
        "synthetic": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10000)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "sessions.jsonl")
    args = parser.parse_args()

    sessions = [make_session(i) for i in range(1, args.count + 1)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(json.dumps(s) for s in sessions) + "\n")

    n = len(sessions)
    print(f"{args.out}  ({n:,} sessions)")
    print(f"  mean completion      {sum(s['completion'] for s in sessions)/n:.3f}")
    print(f"  answered the call    {sum(s['answered_call'] for s in sessions)/n:.1%}")
    print(f"  passed the silence   {sum(s['silence_test_passed'] for s in sessions)/n:.1%}")
    print(f"  returned within 24h  {sum(s['returned_24h'] for s in sessions)/n:.1%}")
    print(f"  outcomes             { {o: round(sum(s['call_outcome']==o for s in sessions)/n, 3) for o in OUTCOMES} }")
    print("\nSynthetic. Disclose it.")


if __name__ == "__main__":
    main()
