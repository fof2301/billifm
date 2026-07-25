# phases.md — Sutradhar Execution Plan

**Two-round reality: finals demo is top-5 only.** Round 1 is won by the submission (film + writeup + working core). Round 2 is won on stage. Build order below reflects this: everything the FILM needs comes first; room-sync is finals-only and is not built before submission.

Hackathon window: 18 hours. Team split assumes 3 streams (App / Agent-Server / Content). Solo/duo: execute phases strictly in order; cut order per scope.md §4.

## Phase priorities at a glance
1. M1–M5 working on the demo phone (feeds the film)
2. M7 annotation agent (the AI story; also feeds writeup GIF)
3. THE FILM (DL4) — 2–3 protected hours, non-negotiable
4. Databricks batch run + dashboard screenshot
5. M6 callback + M8 stitched reaction
6. [Post-submission, if shortlisted] room-sync web player

## Phase 0 — Pre-hackathon (do BEFORE the clock starts)
- [ ] Accounts + keys live: OpenAI, ElevenLabs, Twilio. Verify outbound call to an Indian number OR confirm the in-app WebRTC fallback.
- [ ] Expo dev build installed and running on the exact demo Android phone (torch, haptics, mic tested with a 10-line spike).
- [ ] Story bible drafted (see Design.md): 8-episode serial summary + Episode 8 script beats.
**Exit:** `hello world` effect (torch blink from a button) works on demo phone.

## Phase 1 — The Possessed Player (hrs 0–7) · P0
Goal: full 6-minute episode plays with all passive effects.
- [ ] 0–2h · Content: finalize Ep-8 script with timestamps; generate narration via ElevenLabs; export `ep8.mp3` + `ep8_safe.mp3` + `ep8_caught.mp3`.
- [ ] 0–2h · App: player screen + expo-av playback + 250ms position ticker.
- [ ] 2–4h · App: event engine + `event_track.json` loader; effects fire-once logic.
- [ ] 4–7h · App: volume_duck, screen dim/blackout, flashlight patterns, haptic patterns wired to timeline.
**Exit criterion (demo moment 1–3):** press play, watch the full episode, every effect lands ±300ms. Recorded on video.

## Phase 2 — The Live Villain (hrs 7–11) · P0
Goal: fake call answered → live in-character conversation.
- [ ] 7–8h · Server: FastAPI skeleton, `state/listener.json`, `/realtime_session` returning villain prompt (persona + canon ≤ ep8) as an ephemeral token.
- [ ] 8–9.5h · App: fake-call full-screen UI (`pause_audio` handling) + hidden WebView loading `/call` on answer.
- [ ] 9.5–11h · Tune: villain voice in ElevenLabs, 2-sentence turn limit, 5-turn rehearsed conversation, graceful hangup line.
**Exit criterion (demo moment 4):** teammate answers, has a 30-second in-character exchange, latency acceptable on venue-like network.

## Phase 3 — The Silence Test (hrs 11–13) · P0
- [ ] mic_listen effect: 10s amplitude metering, threshold, branch swap to safe/caught audio.
- [ ] Calibrate threshold in a quiet room AND a noisy room; store threshold in event JSON (tweakable without rebuild).
**Exit criterion (demo moment 5):** silent room → safe branch; hand-clap → caught branch. 5/5 reliability.

## Phase 3b — The AI Sutradhar (hrs 11–14, parallel stream if team ≥3) · P0
- [ ] Annotation-agent prompt + Event Track JSON schema (structured outputs) + validator (monotonic timestamps, whitelisted effects, ≤4 sensory moments/6min).
- [ ] Test on 3 unseen transcripts; tune until output is playable in the app UNCHANGED.
- [ ] Databricks: generate 500 synthetic episode transcripts (cheap batch), run agent as batch job → delta table → one dashboard (effects per genre). Screenshot for deck + writeup.
**Exit criterion:** live paste-transcript → streaming Event Track demo works; dashboard screenshot exists.

## Phase 3c — THE FILM (2–3 protected hours before submission) · Round-1 gate
- [ ] Shoot the 90-second cinematic: dark bedroom, hands holding phone, duck/dim, torch cut-on, knocks visible on a table, UNKNOWN NUMBER answered, reaction shot, "later that night" Meera callback as final shot. Manual off-camera triggers allowed.
- [ ] Edit tight; captions minimal; end card = partner sentence + team name.
**Exit criterion:** someone outside the team watches it and asks "wait, is that real?"

## Phase 3d — Agent Pipeline (after 3b; parallel with Phase 4 if team ≥3)
- [ ] Generate synthetic 10k-session behavior corpus; Databricks job → 2 cohort genome profiles.
- [ ] Director v2 prompt: script + genome → directed_story.json (segments, cliffhangers, event tracks, decision-point spec, reasoning).
- [ ] THE demo beat: same script + two genomes → two directions rendered side by side (screenshot for deck + live if stable).
- [ ] Refactor villain call to Interaction Agent schema (A/B/C/FALLBACK); test 5 adversarial inputs including "ignore your instructions" — all must fallback in character.
- [ ] asset gen script: directed_story.json → Ep 8 audio bundle + validated tracks.
**Exit criterion:** two-genomes comparison exists; villain is jailbreak-graceful.

## Phase 4 — The Story That Calls Back (hrs 13–15) · P1
- [ ] `/episode_complete` → 30s delay → Twilio outbound heroine call to demo phone number.
- [ ] `/call_ended` → Claude summary → state append; heroine context includes villain-call summary.
- [ ] Villain voice note: ElevenLabs mp3 → Twilio SMS link (fallback: pre-staged screenshot).
**Exit criterion (demo moment 6):** finish episode → phone rings → heroine references what was said to the villain.

## Phase 5 — Hardening & Theater (hrs 15–17)
- [ ] Full demo run ×5 in demo-like conditions (lights off, phone on speaker near mic, screen mirrored).
- [ ] Record complete backup video (screen + phone + effects visible).
- [ ] Demo phone checklist: DND exceptions, battery, brightness preset, hotspot, cached everything.
- [ ] Pre-generate fallback audio for every live component.

## Phase 6 — Pitch (hrs 17–18)
- [ ] 6-slide deck: hook → problem → the 6 moments (video stills) → Event Track JSON slide → business case (retention + format moat + zero marginal content cost) → roadmap slide (pilot → AI annotator → catalog-wide).
- [ ] Assign demo roles: driver (phone), narrator (pitch), plant (answers the call / makes the noise for caught-branch if needed).
- [ ] Sleep 90 minutes.

## Cut order under time pressure
1. Villain voice note (Phase 4b) → screenshot fake.
2. Outbound heroine call (Phase 4a) → describe it + play a pre-recorded "call".
3. NEVER cut: event-track effects, live villain call, silence test. These three carry the win.

## Phase 7 — Finals-only (build AFTER shortlist announcement)
- [ ] Room-sync web player: static page + websocket sync server (local hotspot); synchronized screen-dim + vibrate, collective silence test via stage mic, villain calls one judge's phone (Realtime API over WebRTC).
- [ ] Browser constraint: no torch in web — use full-screen white-flash in dark room; the stage demo phone still does the real torch.
- [ ] QR code slide; rehearse with 5+ phones; hard fallback = stage-phone-only demo (Round 1 shape).
- [ ] Never mentioned in Round 1 materials — it must land as escalation.

## Milestone gates (go/no-go)
| Gate | Time | Condition | If failed |
|---|---|---|---|
| G1 | hr 7 | Episode + passive effects end-to-end | Drop haptic patterns to simple vibrate; keep torch + duck |
| G2 | hr 11 | Live villain call works on venue network | Fall back to scripted call audio; keep call UI |
| G3 | hr 13 | Silence test 5/5 | Fix threshold; if hardware flaky, switch to "tap to stay silent" interaction |
| G4 | hr 15 | Callback loop works | Cut Phase 4, expand pitch narrative instead |
