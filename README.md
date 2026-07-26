# Sutradhar · Billi FM

**The invisible director inside every episode.**

Team **Billi Janta Party** · Pocket FM AI Hackathon · Track P1 (AI-Native Storytelling)

In Indian theatre the *Sutradhar* is the narrator-puppeteer who holds the strings
of everything on stage. Sutradhar is a sensory storytelling layer that lets an
audio story take control of the listener's phone — flashlight, haptics, volume,
screen, microphone, call screen — turning the device from a playback tool into a
prop inside the fiction, and keeping characters alive between episodes through
real calls and voice notes.

The showcase story is **Riya Calling** (see [story/](story/)): three nights after
his sister dies in a Diwali-night "accident", Arjun's phone rings at 2:07 AM —
Caller ID **Riya 💜**, calling from three days in the past. 30 paths, 5 endings.
**Your phone is her line.**

> Bandersnatch gave you a remote. We gave the story your phone.

---

## Start here

- **Building?** → [TEAM.md](TEAM.md) — who owns what, hour by hour, with the go/no-go gates.
- **The story & branching architecture** → [story/](story/): bible, branch-map (30 paths / 5 endings), full episode scripts, story_graph.json. (*Aakhri Awaaz* in files/story.md is DROPPED — decision D22.)
- **Why does it look like this?** → the design pack in [files/](files/): [prd.md](files/prd.md), [scope.md](files/scope.md), [architecture.md](files/architecture.md), [rules.md](files/rules.md), [agents.md](files/agents.md), [Design.md](files/Design.md), [userflow.md](files/userflow.md), [phases.md](files/phases.md), [memory.md](files/memory.md).
- **Read [rules.md](files/rules.md) before writing code.** It is short and it is binding.

---

## Layout

```
apps/         Billi FM story framework (web) - mobile module + demo UI
  server/                      Hono gateway :8787 - dialogue, judge, STT/TTS
  web/                         Vite+React :5173 - library, stage, family tree
packages/     engine (session reducer) + schema (story bundle zod)
stories/      story bundles: story.json + secrets.json + assets/
  riya-calling/                the showcase story as a playable bundle
app/          Expo (Android) player - the possessed phone          [P1]
  src/engine/eventEngine.ts    250ms ticker; fires each event once
  src/effects/*.ts             one file per effect, run(event, ctx)
  src/screens/                 home, player, fake call
server/       FastAPI - one process, no DB, no queue               [P2]
  main.py                      6 endpoints + static audio
  state.py                     listener.json + episode-gated canon
  prompts/*.md                 personas, never inlined in code
  static/call.html             OpenAI Realtime over WebRTC
director/     M7 - the AI Sutradhar                               [P3]
  annotate.py                  transcript -> playable Event Track
  validate.py                  the guardrail that IS the platform claim
eval/         Genome pipeline - persona sim -> Delta -> cohorts    [P3]
content/      event_track.json (DL3) + ElevenLabs render script    [P4]
story/        Riya Calling: bible, branch-map, scripts, graph      [P4]
```

## Billi FM story framework + demo UI

A mobile-first web framework for 5–10 minute interactive stories with AI
characters. Stories are JSON bundles; the framework plays them. Three modes:
choices (MCQ), free text, voice. Characters each have their own persona
(`secrets.json`); dead characters and ancestors are talkable via the
family-tree screen (kin generations — ask Sana about the night she died, or
Papa what he would do).

```bash
pnpm install                  # needs Node 22+
cp .env.example .env          # set OPENAI_API_KEY
pnpm dev                      # gateway :8787, web :5173

pnpm test                     # all unit tests (no API key needed)
pnpm e2e                      # Playwright flow, mocked gateway
pnpm typecheck
```

- **Phone module:** open http://localhost:5173 on a phone-sized viewport.
- **Desktop demo (split screen):** open **http://localhost:5173/#demo** — left: the
  produced episode (drop `riya-calling.mp4`/`.mp3` into `apps/web/public/demo-media/`),
  right: the mobile module live in a phone frame.
- **Add a story:** create `stories/<id>/` with `story.json` (public), `secrets.json`
  (server-only personas + judging rubrics) and `assets/`. The server validates
  bundles at boot and fails fast with the exact path of any error.
- **Generate art/ambient for a story:** `node --env-file=.env scripts/generate-story-assets.mjs <id>`
  (reads `stories/<id>/assets.json` prompts; riya-calling ships SVG placeholders
  until then).

## The Event Track

One JSON file per episode is the entire platform asset. This is DL3 — the thing a
Pocket FM engineer reads and understands in a minute:

```json
{ "id": "e5", "t": 127, "type": "flashlight", "pattern": "flicker_then_on", "hold_s": 20,
  "cue": "CLICK. Click-click. CLICK - she finds Dada ji's old torch.",
  "why": "Diegetic: the torch turns on because she found a torch." }
```

Seven effect types, two haptic patterns, nothing else. The engine is deliberately
dumb — it compares audio position to `t` and calls a handler. **Every directorial
decision lives in the JSON**, which is why an AI agent can write one and the app
plays it unchanged. See [content/event_track.json](content/event_track.json).

## Run the Sutradhar player stack

```bash
cp .env.example .env          # fill OPENAI_API_KEY and ELEVENLABS_API_KEY

# server
cd server && pip install -r requirements.txt
cp any.mp3 audio/ep8.mp3      # placeholder so the app's loader returns 200
uvicorn main:app --host 0.0.0.0 --port 8000

# app - needs a dev build; there is no torch API in Expo Go
cd app && npm install
EXPO_PUBLIC_SERVER_URL=http://<your-lan-ip>:8000 npx expo run:android

# the AI Sutradhar - no phone, no audio, no server required
cd director && pip install -r requirements.txt
python annotate.py transcripts/ep8.txt
```

[`director/transcripts/ep8.txt`](director/transcripts/ep8.txt) has every effect
marker stripped, so annotating it and diffing against the human-authored
[`content/event_track.json`](content/event_track.json) is a genuine test — and it
is the M7 stage demo.

## Stack

| Partner | Where it is load-bearing |
|---|---|
| **OpenAI** | Realtime API drives the live villain call and the callback — interruptible, and it hears your silence. Structured outputs drive the annotation agent. Dialogue/STT/TTS power the Billi FM character personas. |
| **Databricks** | The annotation agent as a batch job over a 500-episode synthetic catalog; the genome pipeline's Delta tables and cohort profiles; image asset-gen per cohort. |
| **ElevenLabs** | Pre-generated Hinglish narration, character voices, voice notes. |
| **Twilio** | The outbound PSTN leg and the voice-note SMS. |

> OpenAI gives our stories a voice, Databricks gives our director a catalog,
> Pocket FM gives it 200 million listeners.

## Two things we will not do

**Privacy.** `mic_listen` is amplitude metering only — no speech recognition,
nothing stored, nothing transmitted. Nine words of dialogue are the entire
interface for that moment.

**Menace stays inside the fiction.** No character ever references the listener's
real name, location, family, or anything about their actual life. All original IP,
all synthetic voices, no voice cloning of real people.
