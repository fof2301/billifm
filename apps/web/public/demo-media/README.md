# demo-media

Episode audio for the `#demo` split screen (http://localhost:5173/#demo).

Generate all five episodes (OpenAI TTS, per-character voices, ~$1):

    node --env-file=.env scripts/generate-episode-audio.mjs

Files land here as `riya-calling/ep1.mp3` … `ep5.mp3`. They are
git-ignored (same policy as server/audio: generated audio is too big
for git) — every teammate regenerates locally, or copy them over.

The phone module on the right works with or without these files.
