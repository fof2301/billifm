# PRD — Sutradhar: The Invisible Director Inside Every Episode

**Team:** Billi Janta Party · **Showcase story:** *Aakhri Awaaz* (Episode 8)

## 1. One-liner
In Indian theatre, the Sutradhar is the narrator-puppeteer who holds the strings of everything on stage. Sutradhar is a sensory storytelling layer that lets a Pocket FM story take control of the listener's phone — flashlight, haptics, volume, screen, microphone, call screen, and messages — turning the device from a playback tool into a prop inside the fiction, and keeping characters alive between episodes through real calls and voice notes.

## 2. Problem
1. Audio fiction is a one-way, one-sense medium. Every player (Pocket FM, Kuku FM, Audible) delivers the identical experience: an mp3 and a progress bar. There is no structural moat in an mp3.
2. The story dies between sessions. Pocket FM has zero presence in a listener's life for the ~23 hours between episodes. Cliffhanger emotion decays; generic push notifications are ignored.
3. AI in storytelling is being used only as a writer. The unexplored space: AI that lets stories perceive, react, and reach out.

## 3. Target user
- Primary: Pocket FM binge listeners of thriller/horror/drama serials (India, Android-majority, headphone/night listeners).
- Secondary (business buyer): Pocket FM content & growth teams — the Event Track format is a catalog-wide capability, not a single show.

## 4. Goals (hackathon scope)
| Goal | Metric of success |
|---|---|
| Prove emotional impact of in-episode device effects | Judges visibly react during demo (lean-in, gasp at torch moment) |
| Prove live character presence | Judge converses with villain agent live, in character, <1.5s latency |
| Prove the plot can react to the real world | Silence test branches correctly in demo room |
| Prove platform story | Event Track JSON shown; "any episode is one JSON away" lands |

## 4b. Two-round strategy (finals demo only for top 5 teams)
- **Round 1 (submission):** won on paper + video. The 90-second cinematic film of the possessed episode (dark room, real reactions, torch/knocks/call on camera) is the most important deliverable — more than code polish. Writeup leads with the three positioning lines; includes the Event Track JSON visual and an annotation-agent GIF.
- **Round 2 (finals):** the held-back ace — a browser-based room-sync player (QR code, every judge's phone dims/vibrates in sync, collective silence test, villain calls one judge's phone). Built AFTER submission, demoed only at finals. Never promised in Round 1, so it reads as escalation.

## 5. Non-goals (explicitly out of scope)
- Full Pocket FM app clone, catalog, auth, payments
- iOS support (Android-only demo)
- AI story *generation* (story is pre-written)
- Multi-listener / social features
- Production-grade telephony, quiet hours, frequency caps (documented, not built)

## 6. Core features

### F1 — Event Track Player (P0)
A mobile player that reads an `event_track.json` synced to episode audio and fires device effects at timestamps.
- Effects: volume_duck, screen_dim, screen_blackout, flashlight, haptic pattern, fake_call, mic_listen.
- Acceptance: 6-minute showcase episode plays end-to-end with all effects firing within ±300ms of scripted time.

### F2 — Fake Incoming Call with Live Agent (P0)
Mid-episode, a full-screen "UNKNOWN NUMBER" call UI appears. Answering connects to a live LLM voice agent (villain persona).
- Acceptance: agent stays in character for ≥5 turns, replies ≤2 sentences per turn, remembers one fact the listener says and reuses it later (voice note).

### F3 — Silence Test (P0)
At a scripted moment, mic amplitude is metered for 10 seconds. Quiet → "safe" branch audio; noise above threshold → "caught" branch audio.
- Acceptance: correct branch triggers reliably in a demo room; both branch audios pre-generated.

### F4 — Between-Episode Character Callback (P1)
After episode completion, an outbound call is triggered (30s delay in demo) from the heroine, referencing listener progress and last interaction.
- Acceptance: phone rings for real; heroine references the answer given to the villain in F2.

### F5 — Villain Voice Note (P1)
A WhatsApp/SMS voice note from the villain, generated from the last call summary.
- Acceptance: arrives within 2 minutes of the call; content references the call.

### F6 — Listener State & Memory (P0, infrastructure)
Single source of truth: episode progress + interaction summaries. Injected into every agent prompt. Guarantees spoiler safety (characters know nothing past current episode).

### F7 — The AI Sutradhar: Annotation Agent (P0 — THE headline AI feature, never cut)
An LLM pipeline that ingests any raw episode transcript and outputs a complete Event Track JSON — detecting whispers, knocks, darkness, phone calls and tension beats, and making directorial decisions with reasoning. Demoed live: paste a fresh transcript, watch the direction stream out in seconds.
- Acceptance: on 3 unseen transcripts, produces sensible Event Tracks a human agrees with ≥80% of the time.
- Scale proof (Databricks): the same agent run as a batch job over a 500-episode synthetic catalog, with one results dashboard — "we directed an entire catalog overnight."

### F8 — AI-Stitched Reaction (P1)
After the villain call, the LLM writes Meera's reaction referencing the listener's actual words; TTS renders it in ~5s and it plays as the episode resumes. Generation and immersion fused.

### F9 — World Layer (P1/P2 priority; demo-cheap, pitch-rich)
Three capabilities inside the same story, mapping directly to listed problem-statement bullets:
- **F9a Khandaan Board** (P2: AI Family Tree) — two-family tree screen; nodes unlock from interaction flags; AI generates canon-consistent relatives on demand. Acceptance: villain call reveal → Dinanath node appears live.
- **F9b Iqbal the Detective** (P2: AI Detective) — third voice character; deduces from the listener's real interaction history, generates clues/next questions live. Acceptance: references at least one specific thing the listener actually said.
- **F9c Switch the Line** (character switching) — one pre-generated 60s replay of the villain-call scene from The Voice's POV + a toggle for which character calls you back. Acceptance: the POV scene plays with its own mini event track.
- **Living Characters** (P2 bullet) — already delivered by F6 memory; claimed explicitly in pitch.

### F10 — The Agent Pipeline (see agents.md for full spec)
Four modules turning any linear story into a directed, interactive, self-improving experience:
- **F10a Genome Agent** (P1: Story Genome) — behavior vectors (skips, drop-offs, cliffhanger return-rates, call/silence behavior) → genome profile JSON. Databricks delta tables + batch jobs; hackathon uses 10k SYNTHETIC listener sessions (pipeline real, users simulated, disclosed). Acceptance: two distinct cohort genomes computed from the synthetic corpus.
- **F10b Director Agent** — input: straight threadless script + genome profile; output: segmentation, cliffhanger placement/type, Event Tracks, decision-point placement, with reasoning notes. The annotation agent (F7) is its step 3. Acceptance: SAME script + TWO genomes → two visibly different directions, shown side by side (this is a headline demo beat).
- **F10c Interaction Agent** — owns each decision point as a constrained CONVERSATION: outcomes A/B/C + graceful in-character fallback for anything unmappable (off-topic, jailbreak, sustained silence). Options are NEVER shown on screen — invisible constraint, open feel. The villain call is instance #1 (refactored to the outcome schema); the silence test is instance #2. Acceptance: 5 adversarial inputs (including "ignore your instructions") all produce in-character graceful fallbacks.
- **F10d Asset Gen Pipeline** — directed_story.json → per-segment audio, consequence variants, validated event tracks, asset manifest. Rule: no consequence ships without its asset. Hackathon form: one Python script.
- **The flywheel:** player behavior feeds back into the Genome. The story learns its audience.

Problem-statement coverage after F10: **six listed bullets** — P1 AI-native + P1 Story Genome + P2 Living Characters + P2 AI Detective + P2 AI Family Tree + P3 story-tests-reality — one world, one pipeline.

## 6b. Partner stack (this is a partner hackathon — name these on stage)
| Partner | Where it is load-bearing |
|---|---|
| OpenAI | Realtime API powers the live villain call and heroine callback (speech-to-speech, interruptible, reacts to silence); structured outputs for the annotation agent |
| Databricks | Genome pipeline: synthetic behavior corpus (10k sessions) → delta tables → cohort genome profiles + vector search; plus annotation-agent batch run over 500-episode catalog + dashboard | 
| Pocket FM | The catalog, the retention thesis, the business |

Pitch sentence: "OpenAI gives our stories a voice, Databricks gives our director a catalog, Pocket FM gives it 200 million listeners."

## 7. The showcase story
One original 6-minute kidnapping-thriller episode ("Episode 8" of a fictional serial), written specifically around the effects. Two characters: MEERA (heroine, captive) and the VOICE (villain). Hinglish narration via ElevenLabs. Original IP — zero copyright risk.

## 8. Demo script (2 minutes)
0:00 hook line → play scene → 0:15 whisper/duck/dim → 0:35 blackout + torch + knock haptics → 1:00 UNKNOWN NUMBER live call on speaker → 1:25 silence test with the room → 1:45 close: "Every episode in the catalog is one JSON file away from feeling like this."

## 9. Success criteria for the submission
Novel (no other team touches device-as-prop), demoable in 2 min, AI-native (live perceiving/reaching-out agents), business-fit (retention + format moat + zero marginal content cost), buildable (all off-the-shelf tech).

## 10. Open questions
- Vapi vs Retell for lowest India-latency voice? (spike in Phase 1)
- Can outbound PSTN calls reach Indian numbers on trial accounts? Fallback: in-app VoIP call via web SDK.
- WhatsApp Business sandbox approval time? Fallback: Twilio SMS with hosted mp3 link.
