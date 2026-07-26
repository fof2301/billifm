"""Schema for the OUTER directed_story.json.

The M7 annotator (schema.py + annotate.py + validate.py) owns the inner
Event Track schema. This file adds the shape ABOVE it: segments,
cliffhangers, decision points, endings, reasoning. Together they define
the full artifact the Director agent (director_v2.py) outputs.

Kept separate on purpose:
  - schema.py is load-bearing pitch material (the "playable unchanged" claim)
  - directed_story_schema.py is the eval / Sequencer layer
  - editing one should not require editing the other
"""

from __future__ import annotations
from typing import Literal, Optional, Union
from pydantic import BaseModel, Field


# ---------- Decision points ----------

class OutcomeBranch(BaseModel):
    # label and intent are human-readable helpers; the outcome-map key
    # (A / B / C / FALLBACK) is the actual identifier.
    label: Optional[str] = None
    intent: Optional[str] = None
    flag: str
    consequence_seg: str
    behavior: Optional[str] = None


class MicOutcomeBranch(BaseModel):
    label: Optional[str] = None
    flag: str
    consequence_seg: str


class InteractionAgentDecision(BaseModel):
    decision_id: str
    kind: Literal["interaction_agent"]
    in_character: str
    objective: str
    outcomes: dict[str, OutcomeBranch]
    turn_limit: int = 6
    max_seconds: int = 90
    reasoning: str = ""


class MicAmplitudeDecision(BaseModel):
    decision_id: str
    kind: Literal["mic_amplitude"]
    objective: str
    outcomes: dict[str, MicOutcomeBranch]
    duration_s: float = 10
    threshold_db: float = -35
    reasoning: str = ""


DecisionPoint = Union[InteractionAgentDecision, MicAmplitudeDecision]


# ---------- Cliffhangers ----------

class Cliffhanger(BaseModel):
    kind: Literal["return_promise", "threat_to_listener", "unresolved_stakes",
                  "character_peril", "revelation_pending"]
    line: str
    returns_next_episode: bool = True


# ---------- Segments ----------

class Segment(BaseModel):
    seg_id: str
    t_start: float
    t_end: float
    beat: str
    event_track: list[dict] = Field(default_factory=list)
    decision_point: Optional[DecisionPoint] = None
    cliffhanger: Optional[Cliffhanger] = None
    reasoning: str = ""


# ---------- Endings ----------

class Ending(BaseModel):
    ending_id: str
    reached_via_flags: dict[str, str]
    segment_id: str
    reasoning: str = ""


# ---------- Reasoning envelope ----------

class DirectorReasoning(BaseModel):
    why_this_shape: str
    manual_baseline: bool = False
    genome_hint: Optional[str] = None
    iteration_delta_notes: Optional[str] = None


# ---------- Top-level ----------

class DirectedStory(BaseModel):
    story_id: str
    title: str
    mode: Literal["interactive", "standard", "minimal"] = "interactive"
    duration_s: float
    linear_script_ref: str
    genome_ref: Optional[str] = None
    iteration: int = 0
    source: Literal["manual_v0", "director_agent", "sequencer"] = "director_agent"
    reasoning: DirectorReasoning
    segments: list[Segment]
    endings: list[Ending]


# `from __future__ import annotations` defers all type hints; force pydantic
# to resolve them now so validate_directed_story() works regardless of
# import order / pydantic version.
InteractionAgentDecision.model_rebuild()
MicAmplitudeDecision.model_rebuild()
Cliffhanger.model_rebuild()
Segment.model_rebuild()
Ending.model_rebuild()
DirectorReasoning.model_rebuild()
DirectedStory.model_rebuild()


# ---------- OpenAI JSON schema (structured output) ----------
# Kept flat enough for `response_format=json_schema`. The Director prompt
# leans on the field descriptions, so keep those tight and instructive.

DIRECTED_STORY_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "story_id", "title", "duration_s", "linear_script_ref",
        "iteration", "reasoning", "segments", "endings",
    ],
    "properties": {
        "story_id": {"type": "string"},
        "title": {"type": "string"},
        "mode": {"type": "string", "enum": ["interactive", "standard", "minimal"]},
        "duration_s": {"type": "number"},
        "linear_script_ref": {"type": "string"},
        "genome_ref": {"type": ["string", "null"]},
        "iteration": {"type": "integer"},
        "source": {"type": "string",
                   "enum": ["manual_v0", "director_agent", "sequencer"]},
        "reasoning": {
            "type": "object",
            "additionalProperties": False,
            "required": ["why_this_shape"],
            "properties": {
                "why_this_shape": {"type": "string"},
                "manual_baseline": {"type": "boolean"},
                "genome_hint": {"type": ["string", "null"]},
                "iteration_delta_notes": {"type": ["string", "null"]},
            },
        },
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["seg_id", "t_start", "t_end", "beat", "reasoning"],
                "properties": {
                    "seg_id": {"type": "string"},
                    "t_start": {"type": "number"},
                    "t_end": {"type": "number"},
                    "beat": {"type": "string"},
                    "event_track": {"type": "array", "items": {"type": "object"}},
                    "decision_point": {
                        "type": ["object", "null"],
                        "description": "One of two shapes. `interaction_agent`: {decision_id, kind='interaction_agent', in_character, objective, outcomes:{A|B|C|FALLBACK:{label,intent,flag,consequence_seg}}, turn_limit, max_seconds, reasoning}. `mic_amplitude`: {decision_id, kind='mic_amplitude', objective, outcomes:{quiet|noise:{label,flag,consequence_seg}}, duration_s, threshold_db, reasoning}.",
                    },
                    "cliffhanger": {
                        "type": ["object", "null"],
                        "description": "Fields: kind (one of: return_promise, threat_to_listener, unresolved_stakes, character_peril, revelation_pending), line (str), returns_next_episode (bool). Do NOT use `type` instead of `kind`.",
                    },
                    "reasoning": {"type": "string"},
                },
            },
        },
        "endings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["ending_id", "reached_via_flags", "segment_id"],
                "properties": {
                    "ending_id": {"type": "string"},
                    "reached_via_flags": {
                        "type": "object", "additionalProperties": {"type": "string"},
                    },
                    "segment_id": {"type": "string"},
                    "reasoning": {"type": "string"},
                },
            },
        },
    },
}


def validate_directed_story(data: dict) -> list[str]:
    """Structural checks beyond what pydantic enforces.

    Returns a list of human-readable errors. Empty = valid.
    """
    errors: list[str] = []
    try:
        story = DirectedStory.model_validate(data)
    except Exception as e:
        errors.append(f"pydantic: {e}")
        return errors

    seg_ids = {s.seg_id for s in story.segments}

    for s in story.segments:
        if s.t_end < s.t_start:
            errors.append(f"segment {s.seg_id}: t_end < t_start")
        if s.decision_point:
            dp = s.decision_point
            for label, out in dp.outcomes.items():
                if out.consequence_seg not in seg_ids:
                    errors.append(
                        f"decision {dp.decision_id} outcome {label}: "
                        f"consequence_seg {out.consequence_seg!r} not defined"
                    )

    for e in story.endings:
        if e.segment_id not in seg_ids:
            errors.append(
                f"ending {e.ending_id}: segment_id {e.segment_id!r} not defined"
            )

    n_decisions = sum(1 for s in story.segments if s.decision_point)
    # Riya Calling has 4 checkpoints per playthrough; the manual v0
    # additionally represents alternate-track decisions so a rendered
    # directed_story may carry up to 5-6. Anything beyond 8 is a red flag.
    if n_decisions > 8:
        errors.append(
            f"{n_decisions} decision points; more than 8 is a red flag "
            f"(Riya Calling has 4 per playthrough + alternates)"
        )

    return errors
