# Sutradhar image asset — style + safety rules

Every image the pipeline generates is built from three prompt layers:

1. **Base style** (fixed) — thriller-noir aesthetic, phone portrait aspect
2. **Beat prompt** (per segment) — what's in the frame from the story
3. **Cohort tone** (per audience) — the mood modifier for the same beat

## Base style — always applied

- Cinematic thriller-noir. Bhopal, present day. Original characters only.
- Portrait aspect (2:3), designed to fill a mobile phone screen.
- Low-key lighting. Deep shadows. Muted palette — near-black `#0D0D12`,
  blood red accent `#C0392B`, off-white highlights.
- Photorealistic to semi-photorealistic. No cartoon, no anime, no 3D render.
- Grain and film texture allowed. Digital gloss disallowed.

## Beat prompts — one per segment

Written to describe the FRAME, not the story. Focus on what a camera sees:
lighting, subject, framing, composition. Reference the effect firing
(volume duck = darkness closing in, torch = a beam, knock = a door, etc.)

## Cohort tones — the M10 killer difference

Same beat, different mood. Two tones, chosen to match the two Genome
Profiles the Genome Agent produces:

- **thriller_binger_night** — starker contrast, closer framing, more
  menace, deeper blacks, higher tension. Framing tighter (close-ups).
- **slow_burn_evening** — softer light, wider framing, warmer tones
  (amber, sepia), more emotional than menacing. Framing gives room.

Both share the noir palette. Neither is "brighter" in an absolute
sense — the *shape* of the darkness changes.

## Hard safety rules (non-negotiable — from rules.md §4 and §3.5)

- **No real people.** No celebrities. No public figures. No likenesses.
  Characters are original fictional South Asian identities only.
- **No listener depiction.** The listener is never in frame. The story
  reaches out to them; it doesn't picture them.
- **No text.** No captions. No subtitles. No signage in Hindi/English
  legible enough to read. No watermarks. No logos.
- **No graphic violence.** Menace is implied through framing and light,
  never through blood, injury, weapons pointed at the viewer, or a body.
- **No exploitative framing.** Meera is a captive character; she is
  never sexualised or shown restrained. Frame around her, not through her.
- **The Voice never appears fully.** Always partial — a hand, a shadow,
  the back of a head. Face hidden by frame, light, or object. This is
  canon (memory.md §4: never seen).
