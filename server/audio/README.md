# server/audio/ — drop the mp3s here

The app streams audio from `GET /audio/<file>` rather than bundling it, so
Content can replace a take without an app rebuild. Filenames must match
`content/event_track.json`.

Required for M1–M5:

| File | What | Needed by |
|---|---|---|
| `ep8.mp3` | The 6-minute main episode, 0:00–5:00 | Hour 2 — blocks the whole app stream |
| `ep8_safe.mp3` | Path A, the room stayed silent | Hour 11 (M5) |
| `ep8_caught.mp3` | Path B, the room made a sound | Hour 11 (M5) |

Branch audios must share their first 2 seconds (door-area ambience) so the swap
is seamless (Design.md 4).

**Unblock trick for hour 0:** the app only needs *an* `ep8.mp3` of roughly the
right length to start wiring the engine. Generate a scratch take — even TTS of
the script read straight, no performance — and drop it here immediately. Person A
must never sit idle waiting for the good take.

Mix rule: dialogue at −14 LUFS baseline, so the 15% duck is dramatic but still
intelligible on a phone speaker at demo volume.
