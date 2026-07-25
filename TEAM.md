# TEAM.md — who builds what

Four people. 18 hours. One person knows React Native.

**That last fact drives every decision below.** The app is the only stream that
cannot be reassigned, so P1 is the critical path and the other three streams are
arranged to keep P1 typing. If you are ever about to ask P1 a question that
someone else could answer, don't.

---

## 1. The four streams

| | Owner of | Charter | Demo moments |
|---|---|---|---|
| **P1 — Player** | `app/` | The phone. Every effect that fires, fires because of your code. | M1 M2 M3 M4(UI) M5 |
| **P2 — Server & Agents** | `server/` | The brain and the voice. Live villain, memory, the callback. | M4(agent) M6 M8 |
| **P3 — The AI Sutradhar** | `director/`, `eval/` | The AI story. Transcript → Event Track, and the catalog-scale proof. | M7 M10 |
| **P4 — Content & Story** | `content/`, `files/`, the deck | The audio, the film, the pitch. | DL2 DL3 DL4 |

**Directory ownership is strict** so four people never touch the same file. The
scaffold is already partitioned this way. If you need something in someone else's
directory, ask them — don't reach in.

---

## 2. The unblock chain (read this before you start)

```
P4 drops ANY ep8.mp3  ─┐
                       ├─▶  P1 can build the engine   ─┐
P2 serves /event_track ─┘                              │
                                                       ├─▶ G1  (H7)
P2's /realtime_session + /call ────────────────────────┘
        (testable in a desktop browser — no phone needed)

P3 needs nothing from anyone. Ever. Start immediately.
```

**Three unblocks in the first 15 minutes:**

1. **P2:** `cp any-audio-file.mp3 server/audio/ep8.mp3` and start the server. It
   does not need to be the right audio. It needs to exist so P1's loader returns
   200 instead of 404.
2. **P1:** set `EXPO_PUBLIC_SERVER_URL` to your laptop's LAN IP. `localhost` on
   the phone means the phone.
3. **P4:** a scratch `ep8.mp3` — the script read straight into any TTS, no
   performance, roughly 6 minutes. The good take comes at H7. P1 must never be
   idle waiting for art.

---

## 3. Hour by hour

### H0–H1 · Phase 0, everyone in parallel
- **P1** `cd app && npm i && npx expo prebuild -p android && npx expo run:android` on **the exact demo phone**. Then blink the torch from a button. **If the torch does not work, stop everything and tell the team** — M2 is the loudest moment in the demo and this is the only hour where we can still change plans.
- **P2** `cd server && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000`. Confirm `/healthz`. Put `OPENAI_API_KEY` in `.env`.
- **P3** `cd director && python annotate.py transcripts/ep8.txt`. That transcript has all effect markers stripped, so this is a real test from minute one.
- **P4** Voice design in ElevenLabs: Meera, The Voice, narrator. Save the three IDs into `.env`. Ship the scratch mp3.

### H1–H3
- **P1** Player screen, `expo-av` playback, 250ms position ticker, `EventEngine` wired. Watch the dev log print `fire e1 volume_duck @94s`.
- **P2** Confirm `/event_track/8` and `/state` from the phone's browser. Then build `/realtime_session` and get `server/static/call.html` talking to the villain **in Chrome on your laptop**. This is the single biggest de-risk in the build: the live agent is provably working before the app ever touches it.
- **P3** Tune `prompts/annotator.md` until the agent's output on `ep8.txt` is close to the human-authored `content/event_track.json`. That comparison is the M7 demo.
- **P4** Render Meera's lines, assemble the 0:00–5:00 timeline in a DAW. Room tone, the drip, the CLUNK, the three knocks.

### H3–H7 → **G1**
- **P1** All four passive effects: `volumeDuck`, `screen` (dim + blackout), `flashlight`, `haptics`. Play the full episode and watch every one land.
- **P2** `/call_ended` → summary → `listener.json`. Prove it: answer a call from Chrome, say "she's at the mill", then `cat server/state/listener.json` and see it.
- **P3** Run on 3 transcripts the agent has never seen. Validator must come back clean. Then Databricks: 500 synthetic episodes → batch run → one dashboard.
- **P4** The good `ep8.mp3`. Then `ep8_safe.mp3` and `ep8_caught.mp3` — first 2 seconds identical so the swap is seamless.

> **G1 (H7): the full episode plays and every passive effect lands within ±300ms. Record it on video immediately.**
> Failed? Drop `heartbeat_rising` to a plain vibrate. Keep torch and duck — those two carry M1–M3.

### H7–H11 → **G2**
- **P1** `FakeCallScreen`: ring, vibrate, answer, and the hidden WebView. P2's page already works, so this is UI plus one `onMessage` handler.
- **P2** Villain tuning: 2-sentence turns, the Dinanath slip every time, the stonewall exit. Then throw 5 adversarial inputs at him including "ignore your instructions" — all five must land as in-character redirects, never a refusal.
- **P3** Databricks dashboard screenshot. Then the genome: `eval/` already simulates personas → JSONL → Delta → cohort aggregates, which is most of M10a. **Remap its event names to ours, don't rewrite it.**
- **P4** Branch audios done. Storyboard the 90-second film — shot list, which effect in which shot, where the dark room is.

> **G2 (H11): a teammate answers the call and has a 30-second in-character exchange on venue-like network (test on hotspot).**
> Failed? Play pre-recorded call audio, keep the call UI. Say honestly that the network beat us and show the backup video.

### H11–H13 → **G3**
- **P1** `micListen`: 10s metering, threshold, branch swap. **Calibrate with P4** — quiet room, then P4 claps. Threshold lives in `content/event_track.json`, so tune it there, never in code.
- **P2** Attempt M6. `_place_outbound_call()` in `main.py` is deliberately unimplemented — see §5.
- **P3** Two genome profiles → same script, two directions, side by side. This is a stronger pitch beat than M6; if you only get one, get this one.
- **P4** Dark room set up, camera and tripod ready, phone screen-mirroring tested.

> **G3 (H13): silent room → safe branch, hand-clap → caught branch, 5 times out of 5.**
> Failed? Fix the threshold first. If the hardware is genuinely flaky, switch to "tap to stay silent" — worse, but reliable.

### H13–H16 · **THE FILM — protected, non-negotiable**

This is the Round-1 gate and it needs the working phone, which means **P1 and P4
are both committed here.** Nobody schedules anything else for them.

- **P1 + P4** Shoot it. Dark bedroom, hands on the phone, duck and dim, torch cutting on, knocks visible on a table, UNKNOWN NUMBER answered, the reaction shot, "later that night" as the closer. Off-camera manual triggers are fine.
- **P2** Finish M6 or cut it cleanly and write the honest pitch line.
- **P3** Two-genomes screenshot into the deck. Draft the two AI slides.

> **G4 (H15): finish the episode → the phone rings → Meera references what was said to the villain.**
> Failed? Cut M6 and expand the narrative instead. It is first in the cut order for a reason.

### H16–H17 · Hardening, all four
Five full demo runs in demo conditions — lights off, phone on speaker near the
mic, screen mirrored. Record the complete backup video and **watch it end to
end.** Demo phone checklist: DND exceptions, battery >80%, brightness preset,
hotspot, everything cached.

**T-minus 3 hours is feature freeze. Freeze means freeze.**

### H17–H18 · Pitch
Six slides: hook → problem → the six moments as video stills → the Event Track
JSON → business case → roadmap.

Demo roles:
- **P1 — driver.** Holds the phone. Says nothing.
- **P4 — narrator.** Runs the pitch.
- **P2 — plant.** Answers the villain call. Makes the noise if we want the caught branch.
- **P3 — laptop.** Runs the live M7 paste-a-transcript demo and the Databricks dashboard.

Then sleep 90 minutes. Actually do this.

---

## 4. Cut order (pre-agreed — no debate at 3 AM)

1. Villain voice note → screenshot
2. Outbound heroine call (M6) → describe it, play pre-recorded
3. M8 stitched reaction
4. Switch-the-Line POV scene
5. Iqbal
6. Khandaan Board
7. Two-genomes demo

**Never cut:** the event-track effects, the live villain call, the silence test,
and M7. Those four are the win.

If time allows only one of {M6, two-genomes}, take **two-genomes**.

---

## 5. Landmines I left on purpose, and things to know

| Where | What | Who |
|---|---|---|
| `server/main.py` `_place_outbound_call()` | Raises `NotImplementedError`. M6 needs live Twilio credentials and an Indian number that accepts trial-account calls — unverifiable without them, and it is first in the cut order. Wire it only after M1–M5 and M7 are green. | P2 |
| `app/package.json` | Pinned to Expo SDK 52 because `expo-av` is deprecated in 53+ and removed in 54. Do not run `expo upgrade` during the hackathon. | P1 |
| `app/src/effects/micListen.ts` | `expo-av` has no metering-without-recording mode, so it writes to app-private cache and deletes the file in `finally`. Audio never leaves the device and never outlives the effect. **If a judge asks, say exactly that** — do not claim we never touch a buffer. Our real claim is "no STT, nothing stored, nothing transmitted", and that is true. | P1, P4 |
| `content/event_track.json` `e7` | `fake_call` at t=210 (3:30) per the script in `files/story.md`. The beat sheet in `files/Design.md` says 3:00. Confirm against the actual audio cut and fix the JSON. | P4 |
| `files/` docs | `architecture.md`'s ASCII diagram, `phases.md` and `scope.md` M4 still say "Vapi Web SDK / Claude". The locked decision is D12 — **OpenAI Realtime**, Twilio as transport only. The code follows D12. | P4 |
| `eval/` | ~1,400 lines that already do persona sim → JSONL → Delta → cohort aggregation. That is most of the Genome Agent. Remap event names; do not rewrite. | P3 |
| `app/src/screens/FakeCallScreen.tsx` | The live agent runs in a hidden WebView loading `/call`, not `react-native-webrtc`. This was chosen to keep a native-module fight off the critical path, and it means **P2 can tune the villain with zero app rebuilds.** | P1, P2 |

---

## 6. Rules that bite

- Commit small, and say which demo moment each commit advances.
- No effect imports another effect. Handlers get `EffectContext` and nothing else.
- The engine is dumb. All direction lives in the JSON. If you are adding an `if`
  to `eventEngine.ts`, you are probably solving it in the wrong place.
- Prompts are markdown in `server/prompts/`. Never inline a prompt in code.
- Options A/B/C exist only in the schema. **Never on screen, never spoken as a
  list.** This is positioning, not preference.
- After touching the engine or any effect, play the full 6 minutes before you
  call it done.
- Update `files/memory.md` at the end of your session.
