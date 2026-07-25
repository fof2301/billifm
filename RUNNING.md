# RUNNING.md — run Sutradhar locally

Three things run: the **server** (any laptop), the **app** (needs a real Android
phone), and the **AI Sutradhar** (needs nothing but a key). They are independent —
you do not need all three to make progress.

---

## 0. Once, before anything

```bash
cp .env.example .env      # then fill it in — see the table at the bottom
```

Python: **3.13**. On 3.14, `pydantic-core` has no wheel and tries to compile Rust.

```bash
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt -r director/requirements.txt
```

---

## 1. The server — start here, everyone needs it

```bash
cd server
uvicorn main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is not optional: the phone has to reach your laptop over the LAN.

Check it:

```bash
curl -s localhost:8000/healthz | python3 -m json.tool
```

You want `"openai_key": true` and `ep8.wav` in `audio_files`. If `audio_files` is
empty, see §4 — the audio is gitignored and has to be regenerated.

Everything else, no phone needed:

```bash
curl -s localhost:8000/event_track/8      # the Event Track the app plays
curl -s localhost:8000/state              # listener progress + memory
open http://localhost:8000/call           # the live villain, in your browser
```

**That last one is the best de-risk in the build.** `/call` is the real OpenAI
Realtime session — the exact page the app loads inside a hidden WebView. Open it in
Chrome, allow the mic, and talk to the villain. If he works here, he works in the
app. Tune him by editing `server/prompts/villain.md` and reloading the page — no
restart, no rebuild.

---

## 2. The app — needs a physical Android phone

**Expo Go will not work.** There is no torch API in it. You need a dev build.

```bash
cd app
npm install
npx expo prebuild -p android --clean
```

Find your laptop's LAN IP:

```bash
ipconfig getifaddr en0        # macOS wifi
```

Then, with the phone plugged in and USB debugging on:

```bash
EXPO_PUBLIC_SERVER_URL=http://<LAN-IP>:8000 npx expo run:android
```

`localhost` from the app means *the phone*, not your machine. This is the single
most common way to waste twenty minutes here.

On the phone: tap Episode 8 → accept the in-fiction consent → press play. Grant
camera (torch) and mic when asked. Watch the dev log; you should see lines like
`fire e5 flashlight @127s`.

### Without a phone

```bash
cd app
npm run typecheck     # must be clean
npm run test:engine   # 9/9 — runs the real engine with no phone, no audio, no Expo
```

The harness proves the things that would ruin a live demo: every event fires
exactly once, in order, a blocking event suspends the ticker (so the 90-second
villain call does not dump the rest of the timeline on resume), and a failing
effect does not stop later ones.

---

## 3. The AI Sutradhar (M7) — no phone, no audio, no server

```bash
cd director
python annotate.py transcripts/ep8.txt --out /tmp/agent.json
python compare.py ../content/event_track.json /tmp/agent.json
```

`transcripts/ep8.txt` is the Ep 8 script with **every effect marker stripped**, so
the agent has to rediscover the direction. `compare.py` scores it against the
human-authored track. Current result: **88% agreement**, above the 80% gate.

Scale proof:

```bash
python make_catalog.py --count 500 --jsonl --out catalog/
```

---

## 4. Audio — regenerate it, it is not in git

Audio is gitignored (17MB+). Three ways to get it, cheapest first.

**a) Timing reference — free, instant, no API.** A distinct beep at every event
timestamp. Best thing to build the engine against, because you can *hear* whether
the torch landed on the cue or 400ms late — that is the ±300ms G1 criterion.

```bash
cd content && python make_timing_track.py
# then set "audio": "ep8_timing.wav" in content/event_track.json
```

**b) The real ElevenLabs takes — costs quota.** Cast: Meera = Jessica, The Voice =
George (auditioned).

```bash
cd content
python gen_audio.py --quota        # check first, spends nothing
python gen_audio.py --assemble     # 2,629 characters -> server/audio/ep8.wav
```

The account is **free tier: 10,000 characters total, ever.** A full render is
2,629. `gen_audio.py` refuses to start if quota will not cover the job. Do not loop
it to try a setting — use `--only 006` on one line.

**c) OpenAI TTS scratch** — if ElevenLabs quota is gone. Lower quality on Hinglish.

```bash
cd content && python gen_audio_openai.py --format wav --assemble
```

### After ANY re-render, run this

```bash
cd content && python refine_lines.py
```

Changing a voice changes line durations, and a longer line walks over the next
cue. This already bit us twice — Jessica's take of line 013 ran 20.9s into a 20s
slot and would have talked over the UNKNOWN NUMBER call. It must say
`0 overrunning`.

`gen_audio.py --assemble` also prints a silence-test report. It must say **PASS**.
If the mic window is not silent, the phone hears its own speaker and takes the
caught branch every single time — the silence test becomes impossible to pass.

---

## 5. Full demo path

1. Server running, `/healthz` shows the key and the audio.
2. Phone on the same wifi, dev build installed.
3. Lights off, phone on speaker.
4. Play Episode 8 and do not touch it.

| t | What should happen |
|---|---|
| 1:34 | Volume ducks to 15%, screen dims. You lean in involuntarily. |
| 2:01 | Screen goes fully black for 6s. |
| 2:07 | Torch flickers three times, then holds 20s. |
| 2:40 | Three knocks in the audio, three thuds in your hand. |
| 3:30 | UNKNOWN NUMBER, full screen. Answer it and talk to him. |
| 5:17 | Ten seconds of real silence. Stay quiet → escape. Make a noise → caught. |
| end | `/episode_complete` fires; the callback is scheduled. |

Then check the memory actually persisted:

```bash
cat server/state/listener.json
```

You should see the call summary, the outcome (A/B/C/FALLBACK) and the silence
result. That file is the whole "characters remember" mechanic.

Reset between rehearsals:

```bash
echo '{"listener_id":"demo","episode_progress":7,"flags":{},"interactions":[]}' > server/state/listener.json
```

---

## Environment

| Key | Needed for | Without it |
|---|---|---|
| `OPENAI_API_KEY` | villain call, callback, summaries, M7 | `/realtime_session` 500s; `/call_ended` degrades to FALLBACK instead of crashing |
| `ELEVENLABS_API_KEY` | real narration | use §4a or §4c |
| `MEERA_VOICE_ID` | `cgSgspJ2msm6clMCkdW9` (Jessica) | — |
| `VILLAIN_VOICE_ID` | `JBFqnCBsd6RMkjVDRZzb` (George) | — |
| `TWILIO_*`, `DEMO_PHONE_NUMBER` | M6 outbound callback | M6 is unwired anyway — first in the cut order |
| `EXPO_PUBLIC_SERVER_URL` | the app | defaults to a hardcoded IP that is probably not yours |

`.env` is gitignored. Keep it that way.

## When it does not work

| Symptom | Cause |
|---|---|
| App shows nothing, no effects | `EXPO_PUBLIC_SERVER_URL` points at `localhost` or the wrong IP |
| `/audio/ep8.wav` 404 | audio not generated — §4 |
| Torch does nothing | Expo Go instead of a dev build, or camera permission denied |
| Silence test always "caught" | run `refine_lines.py`; a line is overrunning into the mic window |
| Villain silent on answer | open `/call` in a laptop browser first to isolate app vs agent |
| `pydantic-core` build error | Python 3.14 — use 3.13 |
