"""Persona simulator.

For each persona × N rollouts, walk the story graph and let an LLM
role-play the persona at every decision, callback, and engagement check.
Emit events as we go. Callers can then aggregate the events for
retention / drop-off / trait-fit metrics.
"""

from __future__ import annotations
import sys
import time
import uuid
from pathlib import Path

from .schemas import (
    Story, Persona, Event,
    NarrativeNode, DecisionNode, CallbackNode, MergeNode, EndNode,
)
from .ollama_client import chat_json


PERSONA_SYSTEM = """You are role-playing a listener of an interactive audio story on Billifm.
Stay in character. Use your traits, personality, and past behavior to make choices.
You may lose interest and drop off — say so honestly via the `engagement` field.
Always respond with valid JSON matching the requested keys."""


def _persona_context(p: Persona) -> str:
    return (
        f"You are persona {p.persona_id}, age {p.age_band}, region {p.region}.\n"
        f"Big5: openness={p.big5_o:.2f} conscientiousness={p.big5_c:.2f} "
        f"extraversion={p.big5_e:.2f} agreeableness={p.big5_a:.2f} "
        f"neuroticism={p.big5_n:.2f}\n"
        f"Nature: {', '.join(p.nature_tags)}\n"
        f"Past watches: {p.past_watches or 'none logged'}\n"
        f"Preferred mode: {p.preferred_mode or 'unknown'}\n"
    )


def _emit(events: list[Event], event_type: str, run_id: str,
          persona: Persona, story: Story,
          node_id: str | None = None,
          payload: dict | None = None) -> None:
    events.append(Event(
        ts=time.time(),
        user_id=persona.persona_id,
        story_id=story.story_id,
        run_id=run_id,
        event_type=event_type,
        node_id=node_id,
        payload=payload or {},
    ))


def _ask_engagement(ctx: str, history: list[str], model: str) -> float:
    prompt = (
        f"{ctx}\nSo far you've experienced:\n{chr(10).join(history[-6:])}\n\n"
        "How engaged are you right now (0.0 = bored, 1.0 = hooked)?\n"
        "Respond as: {\"engagement\": <float>}"
    )
    try:
        r = chat_json(model, prompt, system=PERSONA_SYSTEM)
        return float(r.get("engagement", 0.5))
    except Exception:
        return 0.5


def _ask_decision(ctx: str, history: list[str],
                  node: DecisionNode, model: str) -> dict:
    choices_str = "\n".join(f"- {c.id}: {c.text}" for c in node.choices)
    prompt = (
        f"{ctx}\nSo far:\n{chr(10).join(history[-6:])}\n\n"
        f"The story asks: {node.prompt}\n"
        f"Choices:\n{choices_str}\n\n"
        "Pick one. Respond as: "
        "{\"choice_id\": \"<id from above>\", \"engagement\": <float 0-1>}"
    )
    valid_ids = {c.id for c in node.choices}
    try:
        r = chat_json(model, prompt, system=PERSONA_SYSTEM)
        if r.get("choice_id") not in valid_ids:
            r["choice_id"] = node.choices[0].id
        r.setdefault("engagement", 0.5)
        return r
    except Exception:
        return {"choice_id": node.choices[0].id, "engagement": 0.5}


def _ask_callback(ctx: str, history: list[str],
                  node: CallbackNode, model: str) -> dict:
    prompt = (
        f"{ctx}\nSo far:\n{chr(10).join(history[-6:])}\n\n"
        f"{node.character} calls you and says: \"{node.prompt}\"\n"
        "Reply in 1-2 sentences, as you would if this were real.\n"
        "Respond as: {\"text\": \"<your reply>\", \"engagement\": <float 0-1>}"
    )
    try:
        r = chat_json(model, prompt, system=PERSONA_SYSTEM)
        r.setdefault("text", "I don't know.")
        r.setdefault("engagement", 0.5)
        return r
    except Exception:
        return {"text": "I don't know.", "engagement": 0.4}


def _classify_callback(text: str, node: CallbackNode, model: str) -> str:
    labels = node.classifier.labels
    prompt = (
        f"Classify this reply into exactly one label from: {labels}.\n"
        f"Reply: \"{text}\"\n"
        "Respond as: {\"label\": \"<one label>\"}"
    )
    try:
        r = chat_json(model, prompt)
        if r.get("label") in labels:
            return r["label"]
    except Exception:
        pass
    return labels[0]


def simulate_once(story: Story, persona: Persona, model: str,
                  dropoff_threshold: float = 0.35,
                  max_steps: int = 100) -> list[Event]:
    """Run one traversal of the story for one persona."""
    run_id = str(uuid.uuid4())[:8]
    events: list[Event] = []
    ctx = _persona_context(persona)
    history: list[str] = []

    _emit(events, "story_started", run_id, persona, story)

    current = story.root
    for _ in range(max_steps):
        node = story.node_by_id(current)
        _emit(events, "node_entered", run_id, persona, story, node_id=node.id)

        if isinstance(node, NarrativeNode):
            history.append(f"[narrative] {node.content}")
            engagement = _ask_engagement(ctx, history, model)
            if engagement < dropoff_threshold:
                _emit(events, "session_ended", run_id, persona, story,
                      node_id=node.id,
                      payload={"reason": "dropoff", "engagement": engagement})
                return events
            if node.next is None:
                _emit(events, "session_ended", run_id, persona, story,
                      node_id=node.id, payload={"reason": "complete"})
                return events
            current = node.next

        elif isinstance(node, DecisionNode):
            decision = _ask_decision(ctx, history, node, model)
            history.append(f"[decision] chose '{decision['choice_id']}'")
            _emit(events, "decision_made", run_id, persona, story,
                  node_id=node.id,
                  payload={"choice_id": decision["choice_id"],
                           "engagement": decision["engagement"]})
            if decision["engagement"] < dropoff_threshold:
                _emit(events, "session_ended", run_id, persona, story,
                      node_id=node.id,
                      payload={"reason": "dropoff",
                               "engagement": decision["engagement"]})
                return events
            choice = next(c for c in node.choices
                          if c.id == decision["choice_id"])
            current = choice.next

        elif isinstance(node, CallbackNode):
            response = _ask_callback(ctx, history, node, model)
            label = _classify_callback(response["text"], node, model)
            history.append(
                f"[callback:{node.character}] you said: "
                f"{response['text']!r} ({label})"
            )
            _emit(events, "callback_answered", run_id, persona, story,
                  node_id=node.id,
                  payload={"text": response["text"],
                           "classified_label": label,
                           "engagement": response["engagement"]})
            if response["engagement"] < dropoff_threshold:
                _emit(events, "session_ended", run_id, persona, story,
                      node_id=node.id,
                      payload={"reason": "dropoff",
                               "engagement": response["engagement"]})
                return events
            current = node.next_map[label]

        elif isinstance(node, MergeNode):
            current = node.next

        elif isinstance(node, EndNode):
            _emit(events, "session_ended", run_id, persona, story,
                  node_id=node.id,
                  payload={"reason": "complete",
                           "ending_label": node.ending_label})
            return events

    # exceeded max_steps — treat as dropoff
    _emit(events, "session_ended", run_id, persona, story,
          node_id=current, payload={"reason": "max_steps_exceeded"})
    return events


def simulate(story: Story, personas: list[Persona], model: str,
             rollouts: int = 3, dropoff_threshold: float = 0.35,
             verbose: bool = True) -> list[Event]:
    """Run `rollouts` traversals for every persona. Returns all events."""
    all_events: list[Event] = []
    total = len(personas) * rollouts
    done = 0
    for p in personas:
        for r in range(rollouts):
            if verbose:
                print(f"  [{done+1}/{total}] persona={p.persona_id} rollout={r+1}",
                      file=sys.stderr)
            all_events.extend(
                simulate_once(story, p, model, dropoff_threshold)
            )
            done += 1
    return all_events


def write_events(events: list[Event], path: Path) -> None:
    """Persist events as JSONL — one event per line."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for e in events:
            f.write(e.model_dump_json() + "\n")
