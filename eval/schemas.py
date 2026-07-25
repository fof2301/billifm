"""Pydantic schemas for stories, personas, and events.

The story is a directed graph of typed nodes. Personas are the audience
we simulate. Events are the shared record that both simulations and
real users emit — so eval data and production data have the same shape.
"""

from __future__ import annotations
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Field


# ---------- Story graph ----------

class Choice(BaseModel):
    id: str
    text: str
    next: str
    trait_signal: Optional[str] = None


class Classifier(BaseModel):
    labels: list[str]


class NarrativeNode(BaseModel):
    id: str
    type: Literal["narrative"]
    content: str
    next: Optional[str] = None


class DecisionNode(BaseModel):
    id: str
    type: Literal["decision"]
    prompt: str
    choices: list[Choice]


class CallbackNode(BaseModel):
    """A virtual call from a character. User replies free-text;
    a classifier maps the reply to one of `classifier.labels`;
    that label is looked up in `next_map` to pick the next node."""
    id: str
    type: Literal["callback"]
    character: str
    prompt: str
    expects: Literal["free_text"] = "free_text"
    classifier: Classifier
    next_map: dict[str, str]


class MergeNode(BaseModel):
    id: str
    type: Literal["merge"]
    next: str


class EndNode(BaseModel):
    id: str
    type: Literal["end"]
    ending_label: Optional[str] = None


Node = Annotated[
    Union[NarrativeNode, DecisionNode, CallbackNode, MergeNode, EndNode],
    Field(discriminator="type"),
]


class Genome(BaseModel):
    themes: list[str] = []
    tone: str = ""
    target_traits: dict[str, str] = {}
    expected_completion_min: Optional[float] = None


class Story(BaseModel):
    story_id: str
    title: str
    mode: Literal["interactive", "standard", "minimal"]
    root: str
    genome: Genome
    nodes: list[Node]

    def node_by_id(self, node_id: str) -> Node:
        for n in self.nodes:
            if n.id == node_id:
                return n
        raise KeyError(f"Node not found: {node_id}")


# ---------- Persona ----------

class Persona(BaseModel):
    persona_id: str
    age_band: str
    gender: str
    region: str
    big5_o: float
    big5_c: float
    big5_e: float
    big5_a: float
    big5_n: float
    nature_tags: list[str]
    content_pref_vec: list[float]
    past_watches: list[str] = []
    watch_completion_rate: Optional[float] = None
    avg_session_min: Optional[float] = None
    preferred_mode: Optional[str] = None
    call_response_style: Optional[str] = None


# ---------- Events ----------

class Event(BaseModel):
    """Shared shape for simulated and real events. Persist as JSONL,
    or ship to PostHog/DuckDB with the same schema."""
    ts: float
    user_id: str
    story_id: str
    run_id: str
    event_type: str
    node_id: Optional[str] = None
    payload: dict = {}
