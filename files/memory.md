# memory.md — Sutradhar Project Memory (Living Document)

> Purpose: persistent context for every human and AI coding session. Read this AFTER architecture.md, BEFORE writing code. Update the log at the end of every session. Newest entries on top. Keep entries ≤5 lines.

## 1. Project snapshot (keep current)
- **Status:** Concept & docs complete. Build not started. Currently pitching as a concept (no full app required for submission).
- **Current phase:** Phase 0 (pre-hackathon prep) per phases.md.
- **Demo target:** 6 moments — duck/dim, torch, knock haptics, live villain call, silence test, heroine callback.
- **Submission track:** P1 (AI-Native Storytelling), with P2/P3 as framing support.

## 2. Locked decisions (do not relitigate without a log entry)
| # | Decision | Why | Date |
|---|---|---|---|
| D1 | Product name: **Sutradhar** (theatre's narrator-puppeteer) — tagline "The invisible director inside every episode" / "Your phone is the stage." Team: **Billi Janta Party**. Rejected: Aawaaz, Jinn, Nine Lives, Fourth Wall | Name itself teaches the concept (director track pulls the phone's strings); deep cultural fit for Pocket FM judges | 2026-07 |
| D2 | Pitch = sensory format (Event Track) + living characters; NOT an AI story writer | Differentiation vs 90% of teams | 2026-07 |
| D3 | Android-only, Expo/React Native app; single FastAPI server | Torch/haptics reliability; India user base; speed | 2026-07 |
| D4 | Volume duck = attenuate own player gain, not system volume | Zero permissions, same effect | 2026-07 |
| D5 | File-based state (`listener.json`), no DB, no queue | YAGNI; 18-hour build | 2026-07 |
| D6 | Mic = amplitude metering only; never record/store/transmit | Privacy is a pitch point, not a footnote | 2026-07 |
| D7 | Story = original IP "Aakhri Awaaz", Ep 8 showcase, Hinglish | Zero copyright risk; canon small enough to control | 2026-07 |
| D8 | ~~Voice stack: Vapi (agents/telephony) + ElevenLabs (voices) + Claude (brain)~~ **SUPERSEDED BY D12** | Fastest proven path; Retell is the swap-in alternative | 2026-07 |
| D9 | Live generation ONLY for conversations; all narration/branches pre-generated | Quality + demo reliability | 2026-07 |
| D10 | Cut order under pressure: voice note → outbound callback → NEVER the in-episode trio | Protects the demo core | 2026-07 |

| D11 | Annotation agent (M7) promoted from roadmap to P0 build — the headline AI feature, demoed live, never cut | Answers "where's the AI?"; converts effects from hand-made gimmick to AI-directed output | 2026-07 |
| D12 | Voice stack switched to **OpenAI Realtime API** for villain call + callback (ElevenLabs stays for pre-generated narration/voice notes; Twilio/Vapi = transport only) | Partner hackathon (OpenAI); lower latency, native interruption, silence-awareness | 2026-07 |
| D13 | **Databricks** batch pipeline: annotation agent over 500 synthetic episodes + dashboard | Partner alignment; makes "catalog overnight" demonstrated, not asserted | 2026-07 |
| D14 | Two-round strategy: Round 1 won by 90-sec cinematic FILM + writeup; **room-sync web player is finals-only ace**, built after shortlist, never promised in Round 1 | Finals demo limited to top 5; escalation between rounds reads as momentum | 2026-07 |
| D15 | Branching vocabulary BANNED in all materials ("story tests you", "reversed agency" instead) | "Choices change the story" is the most crowded framing; ours is story-acts-on-you | 2026-07 |
| D16 | M8 AI-stitched reaction added (P1); cut order now: voice note → callback → M8 → nothing | Fuses generation + immersion cheaply | 2026-07 |
| D17 | World Layer (M9) added: Khandaan Board (family tree = the murder board), Iqbal detective agent, Switch the Line (one villain-POV scene). Villain motive = 1994 family betrayal via Meera's grandfather Dinanath | Absorbs 3 more listed bullets (Family Tree, AI Detective, Living Characters claimed by name) + POV switching as ONE story system, not four features. Cut order updated: ...M8 → POV scene → Iqbal → Board | 2026-07 |
| D18 | Agent pipeline formalized (see agents.md): GENOME (behavior vectors → genome profile, Databricks, synthetic 10k sessions) → DIRECTOR (linear script + genome → segmentation, cliffhangers, event tracks, decision points; annotation agent is its step 3) → INTERACTION AGENT (constrained conversation at decision points: invisible A/B/C + gracious in-character fallback; villain call refactored to this schema; doubles as jailbreak defense) → ASSET GEN (segments+consequences → playable audio bundle). Killer demo: same script + two genomes → two different directions side-by-side. Claims P1 Story Genome = 6th bullet. Options NEVER shown on screen | Turns backend into a self-improving flywheel; strengthens Databricks story; formalizes the "constrained input, open feel" mechanic | 2026-07 |

## 3. Known risks & mitigations (carry into every session)
- Outbound PSTN to Indian numbers may be blocked on trial telephony accounts → verify in Phase 0; fallback = in-app VoIP callback on a second phone.
- WhatsApp Business approval is slow → default to Twilio SMS + hosted mp3; screenshot fallback staged.
- Venue network latency can wreck live calls → rehearse on hotspot; pre-recorded call audio as G2 fallback.
- Torch/haptics APIs are device-quirky → all testing on the exact demo phone only.
- `mic_listen` threshold varies by room → threshold lives in event JSON, calibrated on-site.

## 4. Canon quick-reference (story facts agents must never contradict)
- Serial: *Aakhri Awaaz*, 8 episodes. Meera = true-crime podcaster, Bhopal. Villain = "The Voice", never seen, calm/polite menace.
- MOTIVE (revealed gradually, never fully in Ep 8): 1994 — Meera's grandfather **Dinanath** testified in an extortion trial; the accused family was ruined — father jailed (died inside 2003), mother institutionalized, two sons scattered. The Voice is the younger son. He knows Dinanath's name; Meera doesn't know the connection yet at Ep 8.
- Third character: **Iqbal** — Meera's retired-cop uncle, gravelly, affectionate, chai-slurping; callable between episodes; deduces from listener's actual interactions.
- Ep 7 end: Meera abducted; keeps her phone hidden → the listener holds "her line." Ep 8: storeroom, power cut, torch, three knocks, villain calls the listener, silence test, escape-or-caught cliffhanger.
- Hard rules: villain never learns/uses listener's real-world info; no character knows anything past listener's `episode_progress`; The Voice NEVER states his identity or full motive in Ep 8 — only slips ("How is Dinanath's health these days?").

## 5. Environment & keys checklist
`.env` requires: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `TWILIO_SID`, `TWILIO_AUTH`, `TWILIO_FROM`, `SERVER_BASE_URL`, `DEMO_PHONE_NUMBER`. Voice IDs (fill when created): `MEERA_VOICE_ID=__`, `VILLAIN_VOICE_ID=__`, `NARRATOR_VOICE_ID=__`.

## 6. Session log (newest first)
### 2026-07-25 — Session 2 (first build session, with Claude Code)
- Built: repo scaffold + verified locally. `app/` (Expo, engine + 5 effect handlers + 3 screens), `server/` (FastAPI, 9 endpoints, episode-gated canon, Realtime broker, WebRTC call page), `director/` (M7 annotate + validate + compare + 500-episode synthetic catalog), `content/` (event_track.json, lines/ep8.json, timing-track generator). Plus TEAM.md (4-way split; only 1 of us knows RN, so the app is the critical path).
- Verified, not assumed: app typechecks clean; headless engine harness 9/9 stable across runs; every no-key server endpoint exercised over HTTP; `/call_ended` degrades to FALLBACK without a key instead of 500; canon gating proven to withhold the Ep 9 twist at progress 7 and 8.
- Broke/fixed: `Camera.setTorchAsync` does not exist in expo-camera 16 — torch is a prop on a mounted `<CameraView>`. Restructured as `ctx.setTorch()` + a 1x1 invisible CameraView held for the whole episode. **This would have killed M2 on device.** Also: pinned `pydantic==2.10.4` has no py3.14 wheel and tried to compile Rust; requirements now use ranges and are tested on 3.13.
- Decided: **D19** — the live agent runs in a hidden WebView loading the server's `/call` page, not `react-native-webrtc`. Keeps a native-module fight off the one RN dev, and lets the villain be retuned with zero app rebuilds. **D20** — audio streams from `GET /audio/*` instead of shipping in the bundle, so Content replaces takes without a rebuild.
- Docs: fixed stale Vapi/Claude references in architecture/scope/phases (code follows D12); D8 marked superseded.
- Still blocked on us, not on code: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` + 3 voice IDs, the real `ep8.mp3`, and a dev build on the demo phone. M6 Twilio leg is deliberately unimplemented (first in cut order).
- Next: Phase 0 per TEAM.md — P1 torch spike on the demo phone is the gate that decides whether M2 survives.

### 2026-07-25 — Session 1 (strategy revision, with Claude)
- Idea stress-tested vs alternatives (Adaalat, Kaun Tha?, 1000 Kaan, AI Bigg Boss) — Sutradhar reconfirmed; partner analysis (OpenAI/Databricks/Pocket FM) strengthened it.
- Locked D11–D16: annotation agent to P0, Realtime API stack, Databricks pipeline, two-round strategy (film → finals room-sync ace), branching language ban, M8 added.
- Docs revised: prd, scope, architecture, phases, Design, memory. Next: verify hackathon brief (partner prize tracks? submission format/deadline?), then Phase 0 checklist.

### 2026-07-25 — Session 0 (planning, with Claude)
- Explored hackathon options (StoryOS, character-calls concept, AI reality show); converged on Sutradhar = possessed-phone immersion + living characters.
- Produced concept proposal docx + this 6-doc pack (prd, rules, architecture, phases, Design, memory).
- Decisions D1–D10 locked. Next action: Phase 0 checklist (accounts, demo-phone spike, story bible draft).
- Open questions parked in prd.md §10 (Vapi vs Retell latency, PSTN-to-India, WhatsApp sandbox timing).

### (template for future entries)
### YYYY-MM-DD — Session N (who/agent)
- Built: …
- Broke/blocked: …
- Decided: … (add to §2 if durable)
- Next: …
