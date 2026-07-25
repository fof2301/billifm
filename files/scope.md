# scope.md — Sutradhar: Scope of Work

**Team:** Billi Janta Party · **Event:** Pocket FM AI Hackathon · **Track:** P1 (AI-Native Storytelling)
**Governing rule:** If a task is not listed under IN SCOPE, it is out of scope. Nobody adds scope without editing this file and logging the decision in memory.md.

---

## 1. What we are delivering (the contract)

Three deliverables. Nothing else counts as done.

| # | Deliverable | Definition of done |
|---|---|---|
| DL1 | **Working prototype** — one Android phone running the Sutradhar player with the *Aakhri Awaaz* Ep 8 showcase episode | The 2-minute demo path runs live, 5/5 times in rehearsal, with rehearsed fallbacks for every live component |
| DL2 | **Concept proposal** — the Sutradhar docx (done) + 6-slide pitch deck | Deck follows the demo arc; every claim in it is either demoed or explicitly labeled "roadmap" |
| DL3 | **The Event Track spec** — one clean, commented `event_track.json` shown as a slide/handout | A Pocket FM engineer could read it and understand how any episode adopts the format |

---

## 2. IN SCOPE — exactly six demo moments

The prototype exists to produce these six moments. Every hour of work must trace to one of them.

### M1 — Whisper duck + screen dim (P0)
- Volume ramps to 15% and screen dims when Meera whispers.
- Scope boundary: gain on OUR audio player only. We do not touch system volume.

### M2 — Blackout + flashlight takeover (P0)
- 6-second true blackout, then the phone torch flickers on as she finds a torch in-story.
- Scope boundary: one flicker pattern, one hold duration. No configurable torch effects.

### M3 — Synced knock haptics (P0)
- Three knocks in audio = three thuds in hand, synced to audio position (±50ms).
- Scope boundary: exactly two named patterns (knock_x3, heartbeat_rising). No haptic framework.

### M4 — Fake incoming call → live villain agent (P0)
- Full-screen "UNKNOWN NUMBER" call UI mid-episode; answering connects to a live OpenAI Realtime villain over WebRTC (D12); call summary is captured and stored.
- Scope boundary: ONE character agent live in-episode. Max 2-sentence turns. 60–90s call by design. The call happens over the app's own VoIP session — real PSTN is only for M6.

### M5 — The silence test (P0)
- 10s mic amplitude metering; quiet → safe branch audio, noise → caught branch audio.
- Scope boundary: amplitude only, threshold in JSON, both branch audios pre-generated. One branch point in the whole episode. No speech recognition, no recording.

### M6 — Heroine callback + villain voice note (P1 — first to cut)
- After episode end: real outbound call from Meera in ~30s referencing the M4 conversation; villain voice note via SMS shortly after.
- Scope boundary: one hardcoded demo phone number. Fixed 30s delay. No scheduling system, no quiet hours, no retry logic — those are roadmap slides.

### M7 — The AI Sutradhar: live annotation agent (P0 — never cut)
- Paste any raw transcript → complete Event Track JSON streams out with directorial reasoning. Demoed live on stage AND shown as a Databricks batch run over a 500-episode synthetic catalog with one dashboard.
- Scope boundary: one prompt pipeline + one Databricks notebook/job + one dashboard screenshot. No review console, no human-in-the-loop tooling.

### M8 — AI-stitched reaction (P1)
- Meera's post-call reaction written by the LLM from the listener's actual words, TTS-rendered in ~5s.
- Scope boundary: one reaction beat, tension-ambience covers generation gap, pre-recorded variant as fallback.

### M9 — World Layer (P1.5 — build after M7)
- Khandaan Board screen (JSON-rendered tree, nodes unlock from interaction flags), Iqbal detective agent (one more persona + deduction prompt over listener state), Switch the Line (one 60s pre-generated villain-POV scene + callback-identity toggle).
- Scope boundaries: no tree editing, no multi-generation simulation, no puzzle mini-games, no full parallel-POV episodes. One tree, one detective, one POV scene.

### M10 — Agent Pipeline (P1.5; Genome/Director-v2 slot AFTER M7, BEFORE M6)
- Genome: synthetic 10k-session corpus + Databricks job → 2 cohort genome profiles. Director v2: script+genome → directed_story.json with reasoning; two-genomes side-by-side demo. Interaction Agent: villain call refactored to A/B/C/FALLBACK schema; 5 adversarial inputs handled in character. Asset gen: one Python script producing the Ep 8 bundle.
- Scope boundaries: synthetic data only (disclosed); TWO genome profiles, not a genome explorer; ONE decision point per episode; no real-user data ingestion; no recommendation features.

### DL4 — Submission film (Round 1 gate — treat as a deliverable, not marketing)
- 90-second cinematic video: dark room, real hands/reactions, all five moments on camera, "later that night" callback as the final shot. Manual off-camera triggering is acceptable for the shoot.

### Finals-only scope (build AFTER submission, only if shortlisted)
- Room-sync web player: browser page + websocket sync server; synchronized dim/vibrate across all audience phones, collective silence test, villain calls one judge. Local-hotspot deployment. Never mentioned in Round 1 materials.

### Supporting scope (only what the moments need)
- 3-screen app: episode list (facade), player, fake-call screen.
- One FastAPI server: `/state`, `/event_track/{ep}`, `/realtime_session`, `/call`, `/call_ended`, `/silence_result`, `/episode_complete`, `/healthz`, plus static `/audio`.
- One state file (`listener.json`) with progress, flags, interaction summaries.
- Content package: Ep 8 main audio + 2 branch audios + 2 post-call reaction variants + serial recap paragraph + 3 agent prompt files.
- Demo kit: backup video of full run, pre-staged screenshots, fallback call audio, demo-phone checklist.

---

## 3. OUT OF SCOPE — what we will NOT do

This list is the discipline. Each item includes *why*, so nobody reopens it at 3 AM.

### 3.1 Product features we will not build
| Not doing | Why |
|---|---|
| User accounts, auth, login, profiles | One hardcoded listener (`demo`) proves everything the demo needs |
| Multiple stories, episodes, or a catalog | One episode IS the product proof; the catalog is a slide |
| Episodes 1–7 audio | A 30-second "previously on" recap covers continuity |
| Settings, preferences, onboarding flows | The one in-fiction consent dialog is the entire onboarding |
| iOS support | Android majority in India; torch/haptics APIs are more reliable; one demo phone |
| Recommendation, discovery, search | Different problem statement entirely |
| Payments, VIP tiers, monetisation mechanics | Business model is a pitch slide, not code |
| Social features, sharing, co-listening | Phase 3 roadmap; zero demo value in 18 hours |
| Offline mode, downloads | Demo phone will have connectivity + hotspot backup |

### 3.2 AI capabilities we will not build
| Not doing | Why |
|---|---|
| AI story *generation* (plots, episodes, endings) | Our thesis is AI as director/actor, not writer — this is the differentiation, not a gap |
| ~~AI Event Track auto-annotation agent~~ **NOW IN SCOPE (M7)** | Promoted after partner analysis: it is the headline AI feature and the Databricks scale story |
| More than 2 character agents (Meera, The Voice) | Two voices carry the entire demo |
| Speech-to-text of the listener during mic_listen | Amplitude threshold is the feature; STT adds latency, privacy risk, and zero demo value |
| Long-term multi-week memory decay/evolution | One state file with summaries demonstrates "characters remember"; the rest is roadmap |
| Personalisation (fears, listening history, adaptive villains) | P1 bullet we deliberately concede to other teams |
| Voice cloning of any real person | Hard ethical/legal line; synthetic voices only |

### 3.3 Engineering we will not do
| Not doing | Why |
|---|---|
| Database (Postgres/Supabase/SQLite) | `listener.json` file; one demo user |
| Message queue, cron, scheduler infra | `asyncio.sleep(30)` is the scheduler |
| Docker, CI/CD, staging environments | 18 hours; one laptop runs the server |
| WebSockets between app and server | App polls `/state` on resume; nothing needs push |
| Automated tests | The test suite is the rehearsed demo run ×5; manual gate G1–G4 in phases.md |
| Error tracking/analytics (Sentry etc.) | Console logs + a human watching |
| Effect plugin architecture / SDK | Seven hardcoded handlers; abstraction after the second story, not before |
| System-volume control, notification-listener, or any invasive Android permission | Torch + vibrate + mic + brightness are enough; extra permissions add friction and review risk |
| Real WhatsApp Business integration if sandbox approval is slow | Twilio SMS with mp3 link is indistinguishable in a demo; screenshot is the final fallback |

### 3.4 Content we will not produce
| Not doing | Why |
|---|---|
| More than one 6-minute episode + 2 branches + 2 reaction variants | Every extra audio minute is an hour not spent on M1–M6 |
| Music score / licensed audio of any kind | Original ambience + ElevenLabs only; zero IP risk |
| Multiple languages | Hinglish only — matches judges and audience |
| Character interactions referencing listener's real name/location/contacts | Hard privacy + safety line (rules.md §4); menace stays inside the fiction |

### 3.5 Claims we will not make on stage
- We will not claim the mic does anything beyond amplitude metering.
- We will not claim WhatsApp integration if we shipped the SMS fallback.
- We will not present pre-recorded fallback audio as live — if a fallback fires, the pitch line is "and here's how it runs when the venue network cooperates," with the backup video.
- We will not claim catalog-scale deployment exists; the Event Track spec is pitched as "one JSON away," demonstrated on one episode.

---

## 4. Change control (hackathon edition)
1. Any scope addition requires: (a) which of M1–M6 it strengthens, (b) what gets cut to pay for it, (c) a line in memory.md.
2. The cut order is fixed and pre-agreed: **voice note → outbound callback → AI-stitched reaction (M8) → Switch-the-Line POV scene → Iqbal → Khandaan Board → Genome/Director-v2 two-genomes demo → nothing else.** M1–M5 + M7 are the win; M7 (annotation agent) is NEVER cut. Note: if time allows only one of {callback, two-genomes demo}, prefer the two-genomes demo — it is stronger pitch material.
3. After T-minus 3 hours: feature freeze. Only demo-safety fixes merge.

## 5. Acceptance checklist (walk this before submission)
- [ ] M1–M5 run end-to-end on the demo phone, 5/5 rehearsals
- [ ] M6 works OR is cut cleanly with pitch adjusted
- [ ] Backup video recorded and watched end-to-end
- [ ] Fallbacks staged: scripted call audio, voice-note screenshot, hotspot
- [ ] Deck ≤6 slides; Event Track JSON slide included
- [ ] No out-of-scope code exists in the repo (grep for auth, db imports, iOS files)
- [ ] memory.md session log updated
