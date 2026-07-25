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
│                                             Realtime WebRTC   branch selector  │
│                                             (live villain)    (safe/caught)    │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌────────────────────────── FASTAPI SERVER (single service) ─────────────────────┐
│                                                                                │
│  /episode_complete  ──▶ schedules outbound call (30s) ──▶ Twilio outbound      │
│  /realtime_session  ──▶ builds agent context per call  ──▶ ephemeral token     │
│  /call_ended        ──▶ GPT summarizes call ──▶ append to listener state       │
│                        └──▶ generate villain voice note (ElevenLabs)           │
│                             └──▶ Twilio SMS with mp3 link                      │
│                                                                                │
│  state/listener.json   prompts/*.md   canon/story_bible.md   audio/ (static)   │
└────────────────────────────────────────────────────────────────────────────────┘
                    │                          │                    │
                    ▼                          ▼                    ▼
              OpenAI API                 ElevenLabs API        Twilio
              (Realtime + GPT)           (TTS voices)          (telephony)
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
| `app/effects/fakeCall.ts` + `screens/FakeCallScreen.tsx` | Full-screen Android-style call UI; on answer, a hidden WebView loads the server's `/call` page, which runs the OpenAI Realtime session over WebRTC | `react-native-webview` |
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
- `POST /episode_complete {listener_id, episode, path}` → update state; `asyncio` 30s delay → Twilio outbound call (heroine on path A, The Voice on path B).
- `POST /realtime_session {agent, decision_id}` → assemble system prompt: persona md + canon up to `episode_progress` + last 3 interaction summaries → mint an ephemeral OpenAI Realtime token. The API key never reaches the device.
- `GET /call` → the WebRTC page the app hides in a WebView; it does the SDP handshake with that token.
- `POST /call_ended` → transcript → GPT summary (≤3 bullets) + decision outcome + flags → append to `state/listener.json`.
- `POST /silence_result {result}` → record the silence-test branch.
- `GET /event_track/{episode}` → serve the track from `content/`, so timings retune without an app rebuild.
- `GET /state` → app fetches progress on launch. `GET /healthz` → keys present, audio present, state summary.
- `GET /audio/{file}` → static episode audio (streamed, not bundled).

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

**Loop A — in-episode call:** event `e7` fires → audio pauses → fake call UI → answer → hidden WebView loads `/call` → `/realtime_session` builds villain context and mints a token → WebRTC conversation → hangup → `/call_ended` → summary + outcome + flag extraction → state updated → episode audio resumes.

**Loop B — post-episode presence:** episode ends → `/episode_complete` → 30s → heroine calls listener's real number, context includes Loop A summary ("you told him nothing — thank you") → call ends → villain voice note generated referencing the same facts → SMS delivered.

The two loops sharing one state file is the "characters remember" magic — and it's ~40 lines of code.

## 4. Repo layout
```
billifm/
├── app/                 # Expo app (Android)
│   ├── src/screens/  src/engine/  src/effects/  src/lib/
│   └── harness/         # headless engine tests - no phone required
├── server/              # FastAPI
│   ├── main.py  agents.py  summarize.py  state.py
│   ├── prompts/ (villain.md, heroine.md, summarizer.md)
│   ├── static/call.html # OpenAI Realtime over WebRTC
│   ├── canon/story_bible.md
│   ├── audio/           # served at /audio/*
│   └── state/listener.json
├── director/            # M7: annotate.py, validate.py, compare.py, make_catalog.py
├── eval/                # M10a genome: persona sim → Delta → cohort profiles
├── content/             # event_track.json, lines/ep8.json, gen_audio.py
└── files/               # these ten documents
```

## 5. Explicit non-choices
No DB (file state). No queue (asyncio delay). No websockets app↔server (poll `/state` on resume). No CI/CD (it's 18 hours). Each of these is reversible in Phase 1 of the real roadmap; none earns its cost in the hackathon.
