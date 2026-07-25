"""Synthetic episode catalog — batch input for the Databricks scale proof (M7).

    python make_catalog.py --count 500 --out catalog/

Produces N synthetic episode transcripts across genres so the annotation agent can
be run as a batch job and we can say "we directed an entire catalog overnight"
with a real table behind it rather than a slide.

THESE TRANSCRIPTS ARE SYNTHETIC AND WE SAY SO ON STAGE. The pipeline is real, the
catalog is generated. That distinction is the difference between a demo and a lie
(scope.md 3.5).

Deterministic: seeded per index, so the same --count always yields the same
catalog and a Databricks re-run is comparable.
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

GENRES = {
    "thriller": {
        "settings": ["a locked stairwell", "an empty call centre at 3AM", "a stalled lift", "a night bus depot"],
        "beats": [
            ("whisper", "{who} drops to a whisper: someone is on the landing above."),
            ("dark", "The corridor lights cut out, all at once."),
            ("light", "{who} finds a phone torch and thumbs it on."),
            ("knock", "Three knocks. Unhurried. Then nothing."),
            ("call", "An unknown number rings {who}'s phone."),
            ("silence", "{who} breathes: 'Don't make a sound. Ten seconds.'"),
        ],
    },
    "horror": {
        "settings": ["a village well at night", "her grandmother's shut bedroom", "a temple after the last aarti"],
        "beats": [
            ("whisper", "{who} speaks so quietly the mic barely takes it."),
            ("dark", "Every lamp in the house dies at once."),
            ("light", "A match catches. Then a torch."),
            ("knock", "Knuckles on wood, from inside the cupboard."),
            ("silence", "'If it hears you, it comes. Be still.'"),
        ],
    },
    "crime": {
        "settings": ["an evidence room", "a highway dhaba at 2AM", "a courthouse basement"],
        "beats": [
            ("whisper", "{who} lowers their voice; the constable is two feet away."),
            ("call", "The informant calls {who} directly."),
            ("dark", "The generator fails and the room goes black."),
            ("knock", "Someone raps on the shutter, three times."),
        ],
    },
    "romance": {
        "settings": ["a Mumbai local at midnight", "a terrace in the monsoon", "a hostel phone booth"],
        "beats": [
            ("whisper", "{who} almost says it, then whispers it instead."),
            ("call", "The phone rings. It is finally them."),
        ],
    },
    "mythology": {
        "settings": ["the banks before the flood", "a forest exile", "a war camp at dusk"],
        "beats": [
            ("dark", "The sun is swallowed mid-verse."),
            ("light", "A single lamp is lit and held aloft."),
            ("knock", "A staff strikes the ground three times."),
            ("whisper", "The vow is given barely above a breath."),
        ],
    },
}

NAMES = ["Meera", "Aarti", "Rehan", "Kabir", "Shalini", "Iqbal", "Devika", "Farhan", "Nandini", "Vikram"]


def make_episode(index: int) -> dict:
    rng = random.Random(index * 7919)  # deterministic per index
    genre = rng.choice(list(GENRES))
    spec = GENRES[genre]
    who = rng.choice(NAMES)
    setting = rng.choice(spec["settings"])

    duration = rng.choice([300, 330, 360, 390, 420])
    # 2-5 beats, always leaving the first ~80s bare (earn trust before you take over)
    chosen = rng.sample(spec["beats"], k=min(len(spec["beats"]), rng.randint(2, 5)))
    slots = sorted(rng.sample(range(85, duration - 30), k=len(chosen)))

    lines = [
        f"EPISODE {index} - {genre.upper()}",
        f"Setting: {setting}. Runtime {duration}s. Lead: {who}.",
        "",
        f"[00:00] {who} sets the scene. Nothing happens to the phone yet; the",
        "listener is being taught to trust the silence.",
        "",
    ]
    for (kind, template), at in zip(chosen, slots):
        lines.append(f"[{at // 60:02d}:{at % 60:02d}] {template.format(who=who)}")
        lines.append("")

    lines.append(f"[{(duration - 20) // 60:02d}:{(duration - 20) % 60:02d}] Cliffhanger. Cut to credits.")

    return {
        "episode_id": f"syn_{index:04d}",
        "genre": genre,
        "duration_s": duration,
        "expected_beats": [k for k, _ in chosen],
        "transcript": "\n".join(lines),
        "synthetic": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=500)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "catalog")
    parser.add_argument("--jsonl", action="store_true", help="one JSONL file instead of N txt files")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    episodes = [make_episode(i) for i in range(1, args.count + 1)]

    if args.jsonl:
        target = args.out / "catalog.jsonl"
        target.write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in episodes))
        print(f"{target}  ({args.count} episodes)")
    else:
        for ep in episodes:
            (args.out / f"{ep['episode_id']}.txt").write_text(ep["transcript"])
        (args.out / "manifest.json").write_text(
            json.dumps([{k: v for k, v in e.items() if k != "transcript"} for e in episodes], indent=2)
        )
        print(f"{args.out}/  ({args.count} transcripts + manifest.json)")

    genres: dict[str, int] = {}
    beats: dict[str, int] = {}
    for ep in episodes:
        genres[ep["genre"]] = genres.get(ep["genre"], 0) + 1
        for beat in ep["expected_beats"]:
            beats[beat] = beats.get(beat, 0) + 1

    print(f"  genres: {genres}")
    print(f"  beats:  {beats}")
    print(f"  mean duration: {sum(e['duration_s'] for e in episodes) / len(episodes):.0f}s")
    print("\nAll synthetic. Disclose that on stage.")


if __name__ == "__main__":
    main()
