"""Event Track JSON schema for OpenAI structured outputs.

This is the contract that makes the platform claim true: the agent's output must
be playable in the app UNCHANGED. If you widen this schema, you have to widen
app/src/types.ts and the effect registry in the same commit, or the claim breaks.
"""

from __future__ import annotations

SENSORY_TYPES = {"volume_duck", "screen_dim", "screen_blackout", "flashlight", "haptic"}
DECISION_TYPES = {"fake_call", "mic_listen"}
EFFECT_TYPES = sorted(SENSORY_TYPES | DECISION_TYPES)

HAPTIC_PATTERNS = ["knock_x3", "heartbeat_rising"]
FLASHLIGHT_PATTERNS = ["flicker_then_on"]

# OpenAI structured outputs needs a closed schema; we use one permissive event
# object and enforce per-type field requirements in validate.py, because a
# discriminated union across 7 variants blows past what strict mode allows.
EVENT_TRACK_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["episode", "title", "audio", "duration_s", "events"],
    "properties": {
        "episode": {"type": "integer"},
        "title": {"type": "string"},
        "audio": {"type": "string"},
        "duration_s": {"type": "number"},
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "t", "type", "cue", "why"],
                "properties": {
                    "id": {"type": "string"},
                    "t": {"type": "number", "description": "seconds into the audio"},
                    "type": {"type": "string", "enum": EFFECT_TYPES},
                    "cue": {
                        "type": "string",
                        "description": "the line of script that justifies this effect",
                    },
                    "why": {
                        "type": "string",
                        "description": "directorial reasoning - why here, why this effect",
                    },
                    # Optional per-type fields. Absent ones are filled by defaults().
                    "to": {"type": ["number", "null"]},
                    "ramp_ms": {"type": ["number", "null"]},
                    "hold_s": {"type": ["number", "null"]},
                    "restore_ms": {"type": ["number", "null"]},
                    "opacity": {"type": ["number", "null"]},
                    "fade_ms": {"type": ["number", "null"]},
                    "duration_s": {"type": ["number", "null"]},
                    "pattern": {"type": ["string", "null"]},
                    "from": {"type": ["string", "null"]},
                    "agent": {"type": ["string", "null"]},
                    "pause_audio": {"type": ["boolean", "null"]},
                    "ring_timeout_s": {"type": ["number", "null"]},
                    "decision_id": {"type": ["string", "null"]},
                    "threshold_db": {"type": ["number", "null"]},
                    "branch_quiet": {"type": ["string", "null"]},
                    "branch_noise": {"type": ["string", "null"]},
                },
            },
        },
    },
}

# What each effect type must end up with after defaults are applied.
REQUIRED_FIELDS: dict[str, list[str]] = {
    "volume_duck": ["to", "ramp_ms", "hold_s", "restore_ms"],
    "screen_dim": ["opacity", "hold_s", "fade_ms"],
    "screen_blackout": ["duration_s"],
    "flashlight": ["pattern", "hold_s"],
    "haptic": ["pattern"],
    "fake_call": ["from", "agent", "pause_audio", "ring_timeout_s", "decision_id"],
    "mic_listen": ["duration_s", "threshold_db", "branch"],
}

DEFAULTS: dict[str, dict] = {
    "volume_duck": {"to": 0.15, "ramp_ms": 800, "hold_s": 12, "restore_ms": 1200},
    "screen_dim": {"opacity": 0.85, "hold_s": 20, "fade_ms": 200},
    "screen_blackout": {"duration_s": 6},
    "flashlight": {"pattern": "flicker_then_on", "hold_s": 20},
    "haptic": {"pattern": "knock_x3"},
    "fake_call": {
        "from": "UNKNOWN NUMBER",
        "agent": "villain",
        "pause_audio": True,
        "ring_timeout_s": 25,
        "decision_id": "decision_1",
    },
    "mic_listen": {"duration_s": 10, "threshold_db": -35},
}
