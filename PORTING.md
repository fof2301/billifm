# PORTING.md — what needs moving from `sutradhar-build` onto `main`

Everything below is on branch **`sutradhar-build`** (PR #1) and **not** on `main`.

Why the split: `main` was force-pushed to remove my commits, then a teammate pushed
work based on the pre-force-push `main`. Their push restored my first three commits
and left the last four behind. Nobody's fault — it's what happens with two people
pushing to `main`. Net effect: **`main` has the scaffold but not the bug fixes.**

Cherry-pick from `origin/sutradhar-build`. Two of the P0 items are live bugs.

---

## P0 — real bugs. Port these regardless of the story change.

### 1. `director/prompts/annotator.md` — M7 currently fails its own gate

`main` has the pre-fix prompt. Measured against the human-authored track:

| prompt | agreement | verdict |
|---|---|---|
| `main` today | **75%** | FAIL (gate is 80%) |
| with this fix | **88%** | PASS |

Two rules were wrong. Old rule 6 said *"only place a haptic where there is an
actual percussive event"* — which **forbids** the sustained `heartbeat_rising`
haptic entirely. And nothing told the agent that effects may stack on one beat, so
it never paired `screen_dim` with `volume_duck`.

The fix splits haptics into percussive vs sustained, and adds a rule stating that a
sensory *moment* is 2–3 effects on one beat and that stacking does not cost extra
moment budget.

```bash
git checkout origin/sutradhar-build -- director/prompts/annotator.md
```

Story-agnostic. Port as-is.

### 2. `server/prompts/summarizer.md` — a lie scores as cooperation

`main` classifies *"she's in Indore, with the police"* (a lie) as outcome **A
(revealed)** instead of **C (lied)**. Consequence: the story plays the *betrayed*
reaction variant at a listener who actually **protected** the character. It inverts
the emotional payoff of the one interactive beat in the episode.

Fix: outcome rules are now **ordered** — FALLBACK, then C, then A, then B, first
match wins — plus a `was_truthful` flag. 6/6 test cases correct after, including a
lie the antagonist never calls out.

```bash
git checkout origin/sutradhar-build -- server/prompts/summarizer.md
```

⚠️ **Then rewrite the canon block inside it.** It currently describes Meera in the
Saluja storeroom. For Riya Calling it needs the facts that distinguish a true
statement from a false one on Arjun's timeline, or outcome C cannot be detected.

### 3. `content/refine_lines.py` — the timing logic hole

`deadlines()` compared blocking effects with `>` instead of `>=`, so a line starting
at the **same second** as an effect appeared to have the rest of the episode free.

That hid this: `mic_listen` was at t=300 while the instruction line *"Dus second.
Koi. Awaaz. Nahi."* ran 300→315.8s. **The mic opened while the phone was still
playing dialogue.** On speaker in a demo room it hears its own output, measures
noise, and takes the caught branch every single time — the silence test could never
be passed.

**Riya Calling has a silence test in Ep3 ("saans mat lena"). Same trap.**

### 4. `content/assemble.py` → `silence_report()` — the check that catches it

Measures RMS inside the mic window and prints PASS/FAIL. This is what found the bug;
reading the code never would have. Run it after every audio render.

```
silence test @ t=317s for 10s
  speech before : rms    1619
  mic window    : rms       0
  PASS - the mic opens into real silence
```

**Estimation was wrong every time — three separate timing bugs, all found only by
measuring.** Don't trust words-per-second.

---

## P1 — story-agnostic tooling worth keeping

| File | Why |
|---|---|
| `content/assemble.py` | ffmpeg-free WAV mixing (stdlib `wave`). ffmpeg isn't installed on the build machine. Includes `silence_report()` and `wrap_pcm()`. |
| `content/gen_audio.py` (rewrite) | **Quota guard** — refuses to start if remaining characters won't cover the job, prints spend before/after. Renders `pcm_24000` → WAV so assembly needs no ffmpeg. `main` has the old unguarded version. |
| `content/audition_voices.py` | Renders the two hardest lines across candidate voices so you cast before spending. |
| `content/gen_audio_openai.py` | OpenAI TTS fallback for when ElevenLabs quota is gone. Uses each line's performance direction as the `instructions` field. |
| `content/refine_lines.py` | Timing vs hard deadlines; prefers measured durations over estimates. |
| `server/static/preview.html` + `/preview`, `/reset_state` in `server/main.py` | Browser preview of any event track. Duck, dim, blackout, the live Realtime call and the silence test are **real**; torch and haptics are labelled substituted. Lets the team see the timeline with no Android build. Reads `/event_track/8`, so it works for the new story unchanged. **Not** the finals room-sync player — no websockets, nothing stage-facing. |
| `RUNNING.md` | How to run server / app / M7 independently. Structure holds; update the audio section for the new cast. |

---

## Do NOT port

| | Why |
|---|---|
| `content/event_track.json`, `content/lines/ep8.json` | *Aakhri Awaaz*. Dead per `story/README.md`. |
| `content/takes_11/` (22 WAVs) | Meera + The Voice. Wrong cast for Riya Calling. |
| `genome/` | Superseded — the teammate's `eval/genome.py` + `databricks/notebooks/30_genome.py` do this properly. |
| `TEAM.md` (my version) | Written around *Aakhri Awaaz* and a stale status table. Take the status facts, not the file. |

---

## Budget warning — read before rendering audio

**ElevenLabs is free tier: 10,000 characters total, ever. 3,061 already spent** on
Aakhri Awaaz takes that the story change orphaned.

**~6,900 remain ≈ two full episode renders, for the whole hackathon.**

Riya Calling is 5 episodes with 4 cast members (Arjun, Riya, Zoya, Dev) — far more
than 6,900 characters of dialogue. Decide deliberately:

- audition first (`audition_voices.py`), never render to "try a setting"
- use `gen_audio.py --only <id>` for single lines
- consider OpenAI TTS (`gen_audio_openai.py`) for everything except the 2–3 lines that carry the demo
- or upgrade the account

The key also lacks the scope to use **cloned or designed voices**, and there is **no
Indian-accented premade voice** on this tier. For a Hinglish story set in India that
is a real quality ceiling, not a detail.

---

## One positioning question, not a bug

`story/README.md` lists `checkpoint_menu` — **visible predefined options at
checkpoints.** That contradicts two locked decisions:

- `files/rules.md` §4: *"Decision points are conversations, never menus. Options A/B/C exist only in the schema — NEVER on screen."*
- `files/memory.md` D15: branching vocabulary banned in all materials.

The pitch line *"You never make a choice in Sutradhar — the story watches, listens,
and reaches out"* stops being true if the screen shows a menu, and "so it's
Bandersnatch?" becomes hard to answer.

This may be a deliberate reversal — reconvergent branching with 30 paths is a strong
retention story on its own. But it should be an explicit decision logged in
`memory.md`, not drift. Someone owns that call.

---

## Verification commands

After porting, these should all pass:

```bash
cd app && npm run typecheck && npm run test:engine     # expect: clean, 9/9
cd director && python compare.py <human>.json <agent>.json   # expect: >=80%
cd content && python refine_lines.py                   # expect: "0 overrunning"
# after any audio render — expect: PASS
```
