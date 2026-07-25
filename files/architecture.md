# architecture.md — Sutradhar System Architecture

## 1. System overview

```
┌─────────────────────────── ANDROID PHONE (Expo app) ───────────────────────────┐
│                                                                                │
│  Player Screen ──▶ Audio Engine (expo-av) ──▶ position ticker (250ms)          │
│                                   │                                            │
│                          Event Engine (JSON timeline)                          │
│                                   │                                            │
│   ┌───────────┬───────────┬───────┴─────┬─────────────┬──────────────┐         │
│   ▼           ▼           ▼             ▼             ▼              ▼         │
│ volume     screen      flashlight    haptics      fake-call      mic-listen    │
│ duck       dim/black   (torch API)   (patterns)   screen (UI)    (metering)    │
│ (gain)     (overlay)                                  │              │         │
│                                                       ▼              ▼         │
│                                             Vapi Web SDK      branch selector  │
│                                             (live villain)    (safe/caught)    │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌────────────────────────── FASTAPI SERVER (single service) ─────────────────────┐
│                                                                                │
│  /episode_complete  ──▶ schedules outbound call (30s) ──▶ Vapi outbound API    │
│  /vapi/webhook      ──▶ builds agent context per call  ──▶ returns config      │
│  /call_ended        ──▶ Claude summarizes call ──▶ append to listener state    │
│                        └──▶ generate villain voice note (ElevenLabs)           │
│                             └──▶ Twilio SMS with mp3 link                      │
│                                                                                │
│  state/listener.json   prompts/*.md   canon/story_bible.md   audio/ (static)   │
└────────────────────────────────────────────────────────────────────────────────┘
                    │                          │                    │
                    ▼                          ▼                    ▼
              Anthropic API              ElevenLabs API        Vapi / Twilio
              (Claude — brain)           (TTS voices)          (telephony)
```

## 2. Components

### 2.1 Mobile app (Expo / React Native, Android)
| Module | Responsibility | Key lib |
|---|---|---|
| `app/player/` | Audio playback, position ticker, episode UI | `expo-av` |
| `app/engine/eventEngine.ts` | Poll position vs event track; fire handlers once each | none (setInterval) |
| `app/effects/volumeDuck.ts` | Set gain on our own audio track (no OS permission) | expo-av volume |
| `app/effects/screen.ts` | Dim overlay + blackout overlay + brightness | `expo-brightness` |
| `app/effects/flashlight.ts` | Torch on/off/flicker patterns | `expo-camera` torch |
| `app/effects/haptics.ts` | Named vibration patterns (knock_x3, heartbeat_rising) | `expo-haptics` |
| `app/effects/fakeCall.tsx` | Full-screen Android-style call UI; on answer, opens Vapi web call | Vapi Web SDK |
| `app/effects/micListen.ts` | 10s amplitude metering; threshold compare; report branch | expo-av recording metering |

Design decision: **volume duck attenuates our own player**, not system volume — zero permissions, identical perceived effect.

### 2.2 Event Track format (the platform asset)
```json
{
  "episode": 8,
  "audio": "ep8.mp3",
  "events": [
    { "id": "e1", "t": 94,  "type": "volume_duck",     "to": 0.15, "ramp_ms": 800 },
    { "id": "e2", "t": 96,  "type": "haptic",          "pattern": "heartbeat_rising" },
    { "id": "e3", "t": 121, "type": "screen_blackout", "duration_s": 6 },
    { "id": "e4", "t": 127, "type": "flashlight",      "pattern": "flicker_then_on", "hold_s": 20 },
    { "id": "e5", "t": 180, "type": "fake_call",       "from": "UNKNOWN NUMBER", "agent": "villain", "pause_audio": true },
    { "id": "e6", "t": 300, "type": "mic_listen",      "duration_s": 10, "threshold_db": -35,
      "branch": { "quiet": "ep8_safe.mp3", "noise": "ep8_caught.mp3" } }
  ]
}
```
Rules: events fire once (engine tracks `fired` set); `pause_audio` events suspend the ticker until resolved; branch events swap the audio source and reset the timeline.

### 2.3 Server (FastAPI, single process)
Endpoints:
- `POST /episode_complete {listener_id, episode}` → update state; `asyncio` 30s delay → Vapi outbound call (heroine assistant).
- `POST /vapi/webhook` → assemble system prompt: persona md + canon up to `episode_progress` + last 3 interaction summaries → return to Vapi.
- `POST /call_ended` (Vapi end-of-call hook) → transcript → Claude summary (≤3 bullets) → append to `state/listener.json` → fire villain voice note pipeline.
- `GET /state` → app fetches progress on launch.

### 2.4 State model (`state/listener.json`)
```json
{
  "listener_id": "demo",
  "episode_progress": 8,
  "flags": { "silence_test_result": "quiet", "told_villain": "she is at the mill" },
  "interactions": [
    { "ts": "...", "channel": "fake_call", "character": "villain",
      "summary": "Listener refused to reveal Meera's location; sounded defiant." }
  ]
}
```
Spoiler safety is **structural**: the webhook only ever loads canon sections `<= episode_progress`.

### 2.5 External services (partner-aligned stack)
| Service | Used for | Fallback |
|---|---|---|
| **OpenAI Realtime API** | Live villain call + heroine callback: speech-to-speech agent, interruptible, reacts to listener silence/tone. WebRTC from the app for M4; Twilio Media Streams (or Vapi as transport only) for the real outbound call in M6 | Pre-recorded call audio; scripted call flow |
| **OpenAI (GPT + structured outputs)** | Annotation agent (M7): transcript → Event Track JSON with reasoning; call summaries; Meera's stitched reaction (M8) | Pre-run outputs shown from cache |
| **Databricks** | Batch job running the annotation agent over a 500-episode synthetic catalog; results table + dashboard (sensory moments per genre, effect distribution) | Pre-run notebook screenshots |
| ElevenLabs | Pre-generated narration + character voices + villain voice-note mp3 (Hinglish); Realtime API's native voices are the alternative if Hinglish quality suffices | Pre-generated audio |
| Twilio | Outbound PSTN leg for M6 + SMS voice-note link | Second phone via WebRTC; screenshot |

Partner sentence (pitch): "OpenAI gives our stories a voice, Databricks gives our director a catalog, Pocket FM gives it 200 million listeners."

### 2.6 The Agent Pipeline (full spec: agents.md)
```
LINEAR SCRIPT ─▶ GENOME AGENT ─▶ DIRECTOR AGENT ─▶ ASSET GEN ─▶ PLAYER + INTERACTION AGENT ─▶ behavior
                (Databricks:      (segmentation,     (audio,       (effects fire; decision       vectors
                 behavior          cliffhangers,      variants,     points run as constrained     feed back
                 vectors →         event tracks,      validated     conversations: invisible      to Genome
                 genome            decision-point     tracks,       A/B/C + gracious in-          — the
                 profile JSON)     placement + why)   manifest)     character fallback)            flywheel)
```
- The annotation agent below is the Director's step 3 (sensory direction). Same validator guardrail applies.
- Interaction Agent schema (outcomes A/B/C/FALLBACK, turn/time limits) lives per decision point in directed_story.json; the villain call and the silence test are instances #1 and #2.
- Genome on Databricks: synthetic 10k-session corpus → delta tables → cohort profiles; disclosed as synthetic.
- Headline demo: one script + two genomes → two directions side by side.

### 2.7 The Annotation Agent (Director step 3) — pipeline
```
transcript.txt ──▶ GPT (structured output, Event Track schema + directorial
                   reasoning per event) ──▶ event_track.json ──▶ validator
                   (timestamps monotonic, effects whitelisted, ≤4 sensory
                   moments per 6 min) ──▶ playable in the app unchanged
Databricks: same prompt as batch inference over catalog table (500 synthetic
episodes) ──▶ delta table of event tracks ──▶ dashboard
```
The validator is the guardrail that makes agent output directly playable — that "unchanged" property IS the platform claim.

## 3. Data flows (the two live loops)

**Loop A — in-episode call:** event `e5` fires → audio pauses → fake call UI → answer → Vapi web call → webhook builds villain context → conversation → hangup → `/call_ended` → summary + flag extraction → state updated → episode audio resumes.

**Loop B — post-episode presence:** episode ends → `/episode_complete` → 30s → heroine calls listener's real number, context includes Loop A summary ("you told him nothing — thank you") → call ends → villain voice note generated referencing the same facts → SMS delivered.

The two loops sharing one state file is the "characters remember" magic — and it's ~40 lines of code.

## 4. Repo layout
```
sutradhar/
├── app/                 # Expo app
│   ├── player/  engine/  effects/  assets/audio/
├── server/              # FastAPI
│   ├── main.py  vapi.py  summarize.py  voicenote.py
│   ├── prompts/ (villain.md, heroine.md, summarizer.md)
│   ├── canon/story_bible.md
│   └── state/listener.json
├── content/             # source scripts, event_track.json, ElevenLabs gen scripts
└── docs/                # these six documents
```

## 5. Explicit non-choices
No DB (file state). No queue (asyncio delay). No websockets app↔server (poll `/state` on resume). No CI/CD (it's 18 hours). Each of these is reversible in Phase 1 of the real roadmap; none earns its cost in the hackathon.
