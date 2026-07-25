# story/ — RIYA CALLING

The canonical demo story. Supersedes *Aakhri Awaaz* (`files/story.md` is dead;
do not build on it).

> Three nights after his sister dies in a Diwali-night "accident", Arjun's
> phone rings at 2:07 AM. Caller ID: **Riya 💜**. She's calling from three
> days in the past — three days before she dies.

**30 unique paths · 5 endings · 4 checkpoints per playthrough · plot invariant
on every path.** The story's own fate mechanic ("every change re-routes")
is the in-fiction cover for reconvergent branching.

## Files

| File | What it is |
|---|---|
| `bible.md` | World, cast, the phone-link rules, the crime, canon facts. **Read first.** |
| `branch-map.md` | The architecture: checkpoint graph, exact option UI copy, variant scenes, flags, reconvergence proofs, 30-path math, endings. **The spine.** |
| `episodes/ep1.md … ep5.md` | Full recording scripts (Hinglish dialogue + SFX + device-effect cues). Ep4 has two track variants (`ep4a.md`, `ep4b.md`); `ep5.md` holds the common spine + all five endings. |
| `story_graph.json` | Machine-readable graph: nodes, checkpoints, options, flags, personas, effects. Source of truth for the player/eval/director pipeline. |
| `linear_script.txt` | The default path (CP1:SABOOT → CP2:CHAARA → CP3:B → E4) compiled as one straight script — input for the director-v2 / two-genomes demo. |
| `research.md` | Pocket FM formula research that calibrated episode length, cliffhanger cadence, register. |

## The branch math

```
CP1 (3 options) × CP2 (2) × [ Track A → CP4a (3)  +  Track B → CP4b (2) ] = 3 × 2 × 5 = 30 paths
Endings: E1..E5, exactly 6 paths reach each ending.
```

Default/canonical ending: **E4 "Wahi Raat"** (fate + justice — she dies, he wins).
Replays chase the save: E1/E2/E5. That replay loop is the retention pitch.

## Where each demo feature is showcased

| Demo feature | Moment |
|---|---|
| Fake **incoming** call | Ep1 2:07 AM "Riya 💜" (signature beat); Ep5/E5 final call |
| Fake **outgoing** call | Ep3 Arjun redials while the intruder is inside (unanswered dread); Zoya advice calls anytime |
| Message-typing UI popup | Ep1 missed-calls + typed-then-deleted text; FL1–FL3 chosen texts typed live; E5 chat history rewriting itself |
| Haptics | Ep1 heartbeat on caller-ID; Ep3 knock_x3 at the storeroom door; Ep5 heartbeat_rising 11:50→11:58 |
| Blackout + flashlight | Ep3 power cut; her phone-torch = the listener's torch |
| Volume duck / whisper | Ep3 hiding; Ep5 flyover underpass |
| Silence test (mic, amplitude-only) | Ep3 "saans mat lena" — tension-only, both results reconverge |
| **AI persona — advice** | Zoya (cyber-cell SI): callable, reasons over YOUR flags/evidence, canon-gated to your progress |
| **AI persona — emotional** | Riya free-talk: Ep2 terrace, Ep4A last-normal-conversation |
| Interaction agent (invisible A/B/C) | Dev confrontation (Ep4A); lure-resistance beat (Ep5) |
| **Checkpoint menus (visible options)** | CP1–CP4 — the new visible-choice mode |
| Director / two-genomes | `linear_script.txt` in, two cohort genomes → different segmentation/checkpoint placement of the same story |
| Genome / eval sim | `story_graph.json` nodes+flags map onto `eval/` persona simulation |

## Engineering deltas this story needs (not yet built)

1. **`message_overlay` effect** — chat/notification popup with typed-live text,
   received photos, and the E5 rewrite animation. New handler in `app/src/effects/`.
2. **`outgoing_call` effect/affordance** — FakeCallScreen currently does incoming
   only; needs an outgoing variant + a "Call Zoya" entry point between beats.
3. **`checkpoint_menu` UI** — visible predefined options at checkpoints. New
   overlay/screen + branch-aware audio swapping in the engine (the engine's
   existing `branch` mechanic on `mic_listen` generalizes to N-way).
4. **Server personas** — `prompts/zoya.md`, `prompts/riya.md` replacing
   villain/heroine; state gains `flags` from `story_graph.json`.
5. **Audio** — all of it (ElevenLabs voices for Riya/Arjun/Zoya/Dev/Rohan +
   narrator; `content/gen_audio.py` pipeline exists).
