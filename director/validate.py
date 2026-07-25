"""The validator. This is the guardrail that makes agent output directly playable.

That "playable unchanged" property IS the platform claim (architecture.md 2.7),
so this file is load-bearing pitch material, not plumbing.

Three rules:
  1. Timestamps are monotonic and inside the audio duration.
  2. Effect types and pattern names are whitelisted - the app has exactly seven
     handlers and two haptic patterns; anything else is a dead event.
  3. At most MAX_SENSORY_MOMENTS sensory *moments* per 6 minutes.

On rule 3, a note that matters: the docs say "<=4 sensory moments per 6 min"
while Design.md's own philosophy says 2-4 per episode - and the hand-authored
Ep 8 track has five effect clusters. Both are right, because a *moment* is a
cluster of effects on one beat, and fake_call / mic_listen are decision points,
not sensory moments. Ep 8 has three sensory moments (whisper, blackout+torch,
knocks) plus two decision points. That is the reading this validator enforces.
"""

from __future__ import annotations

from schema import (
    DECISION_TYPES,
    DEFAULTS,
    EFFECT_TYPES,
    FLASHLIGHT_PATTERNS,
    HAPTIC_PATTERNS,
    REQUIRED_FIELDS,
    SENSORY_TYPES,
)

MAX_SENSORY_MOMENTS_PER_6MIN = 4
CLUSTER_WINDOW_S = 15.0  # effects within this window are one moment


def normalize(track: dict) -> dict:
    """Fill defaults and collapse branch_quiet/branch_noise into `branch`.

    The model is asked for flat fields because strict structured outputs dislike
    nested optionals; the app wants the nested shape. This is that seam.
    """
    events = []
    for raw in track.get("events", []):
        event = {k: v for k, v in raw.items() if v is not None}
        etype = event.get("type")

        for key, value in DEFAULTS.get(etype, {}).items():
            event.setdefault(key, value)

        if etype == "mic_listen":
            event["branch"] = {
                "quiet": event.pop("branch_quiet", None) or "ep_safe.mp3",
                "noise": event.pop("branch_noise", None) or "ep_caught.mp3",
            }
        else:
            event.pop("branch_quiet", None)
            event.pop("branch_noise", None)

        events.append(event)

    return {**track, "events": events}


def validate(track: dict) -> list[str]:
    """Return a list of human-readable errors. Empty list means playable."""
    errors: list[str] = []
    events = track.get("events", [])

    if not events:
        return ["track has no events"]

    duration = float(track.get("duration_s") or 0)
    seen_ids: set[str] = set()
    last_t = -1.0

    for i, event in enumerate(events):
        where = f"event[{i}] id={event.get('id', '?')}"
        etype = event.get("type")

        if etype not in EFFECT_TYPES:
            errors.append(f"{where}: effect type {etype!r} has no handler in the app")
            continue

        eid = event.get("id")
        if not eid:
            errors.append(f"{where}: missing id")
        elif eid in seen_ids:
            errors.append(f"{where}: duplicate id {eid!r} - the engine fires each id once")
        else:
            seen_ids.add(eid)

        t = event.get("t")
        if not isinstance(t, (int, float)):
            errors.append(f"{where}: t must be a number")
        else:
            if t < last_t:
                errors.append(f"{where}: t={t} goes backwards (previous was {last_t})")
            if duration and t > duration:
                errors.append(f"{where}: t={t} is past the end of the audio ({duration}s)")
            last_t = max(last_t, float(t))

        for field in REQUIRED_FIELDS.get(etype, []):
            if field not in event:
                errors.append(f"{where}: {etype} is missing required field {field!r}")

        if etype == "haptic" and event.get("pattern") not in HAPTIC_PATTERNS:
            errors.append(
                f"{where}: haptic pattern {event.get('pattern')!r} is not one of {HAPTIC_PATTERNS}"
            )
        if etype == "flashlight" and event.get("pattern") not in FLASHLIGHT_PATTERNS:
            errors.append(
                f"{where}: flashlight pattern {event.get('pattern')!r} is not one of {FLASHLIGHT_PATTERNS}"
            )
        if not event.get("cue"):
            errors.append(f"{where}: no cue - every effect needs an in-story cause")
        if not event.get("why"):
            errors.append(f"{where}: no directorial reasoning")

    moments = count_sensory_moments(events)
    budget = max(1, round(MAX_SENSORY_MOMENTS_PER_6MIN * (duration or 360) / 360))
    if moments > budget:
        errors.append(
            f"{moments} sensory moments in {duration or 360:.0f}s exceeds the budget of {budget}"
            " - scarcity is the effect; an effect the listener expects is a gimmick"
        )

    decisions = sum(1 for e in events if e.get("type") in DECISION_TYPES)
    if decisions > 2:
        errors.append(f"{decisions} decision points; one per episode is the rule (two for Ep 8)")

    return errors


def count_sensory_moments(events: list[dict]) -> int:
    """Cluster sensory effects that land on the same story beat."""
    times = sorted(
        float(e["t"])
        for e in events
        if e.get("type") in SENSORY_TYPES and isinstance(e.get("t"), (int, float))
    )
    if not times:
        return 0

    moments = 1
    anchor = times[0]
    for t in times[1:]:
        if t - anchor > CLUSTER_WINDOW_S:
            moments += 1
            anchor = t
    return moments
