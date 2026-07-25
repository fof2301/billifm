"""Sutradhar persona simulator.

Given a `directed_story.json` (see director/directed_story_schema.py) and
a set of personas, walk each persona through the story segment-by-segment,
letting an OpenAI-backed persona LLM decide:

  - whether they lean-in (or check phone / skip) during a sensory segment
  - whether to answer, ignore, resist, lie, or reveal on the villain call
  - whether they'd sit still through the silence test (persona-modelled)
  - whether the cliffhanger hooks them (would they return tomorrow?)

Every action is written to the shared `Event` schema (schemas.py). Events
land in `eval/out/events.jsonl` locally and can be shipped to the
`billifm.eval.events_log` Delta table via `eval/delta_sync.py`.

The event vocabulary is Sutradhar-specific but stays within the flat
schema (event_type: STRING, payload: JSON) so the Delta table needs no
migration.
"""

from __future__ import annotations
import json
import random
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from .schemas import Persona, Event
from .openai_client import chat_json


PERSONA_SYSTEM = """You are role-playing an audio-story listener on Sutradhar (Pocket FM).
The story possesses your phone — dimming the screen, flashing the torch, buzzing haptics,
even a real-feeling call from a villain. Stay in character. Decide based on your traits,
personality, tags, and how the story is unfolding.

You may lose interest, look at your phone, skip, or hang up. Say so honestly.
Always respond in JSON with the requested keys."""


# ---------- persona context ----------

def _persona_context(p: Persona, cohort_hint: str | None = None) -> str:
    lines = [
        f"You are persona {p.persona_id}, age {p.age_band}, region {p.region}.",
        f"Big5: openness={p.big5_o:.2f} conscientiousness={p.big5_c:.2f} "
        f"extraversion={p.big5_e:.2f} agreeableness={p.big5_a:.2f} "
        f"neuroticism={p.big5_n:.2f}",
        f"Nature: {', '.join(p.nature_tags)}",
        f"Past watches: {p.past_watches or 'none logged'}",
        f"Preferred mode: {p.preferred_mode or 'unknown'}",
    ]
    if cohort_hint:
        lines.append(f"Cohort hint (for internal grounding, don't mention): {cohort_hint}")
    return "\n".join(lines)


# ---------- events ----------

def _emit(events: list[Event], event_type: str, run_id: str,
          persona: Persona, story_id: str,
          node_id: str | None = None,
          payload: dict | None = None) -> None:
    events.append(Event(
        ts=time.time(),
        user_id=persona.persona_id,
        story_id=story_id,
        run_id=run_id,
        event_type=event_type,
        node_id=node_id,
        payload=payload or {},
    ))


# ---------- persona-LLM decisions ----------

def _react_to_sensory(persona_ctx: str, story_context: str,
                      seg_id: str, effects: list[dict],
                      model: str) -> dict:
    """During a sensory segment, does the persona lean in, skip, look at phone?"""
    prompt = (
        f"{persona_ctx}\n\nStory context so far:\n{story_context}\n\n"
        f"Right now in segment {seg_id!r} the phone does: "
        f"{[e.get('type') for e in effects]}. "
        f"How do you react? Are you engaged?\n"
        "Respond as: {\"reaction\":\"lean_in|watch|check_phone|skip\", "
        "\"engagement\":<0..1>}"
    )
    try:
        r = chat_json(prompt, system=PERSONA_SYSTEM, model=model,
                      temperature=0.6, max_tokens=100)
        return {
            "reaction": r.get("reaction", "watch"),
            "engagement": float(r.get("engagement", 0.5)),
        }
    except Exception:
        return {"reaction": "watch", "engagement": 0.5}


def _react_to_call(persona_ctx: str, story_context: str,
                   objective: str, outcome_labels: list[str],
                   model: str) -> dict:
    """When the villain calls: answer? and if so, what response class?"""
    prompt = (
        f"{persona_ctx}\n\nStory context so far:\n{story_context}\n\n"
        f"An UNKNOWN NUMBER is calling. Meera warned you not to tell him anything. "
        f"Villain's goal in the call: {objective}\n"
        f"Do you answer? If yes, do you: {', '.join(outcome_labels)}?\n"
        "Respond as: {\"answered\":<true|false>, "
        f"\"response_class\": <one of {outcome_labels} or \"fallback\">, "
        "\"engagement\":<0..1>, "
        "\"why\":\"one line — in character\"}"
    )
    try:
        r = chat_json(prompt, system=PERSONA_SYSTEM, model=model,
                      temperature=0.7, max_tokens=200)
        return {
            "answered": bool(r.get("answered", True)),
            "response_class": r.get("response_class", "fallback"),
            "engagement": float(r.get("engagement", 0.5)),
            "why": r.get("why", ""),
        }
    except Exception:
        return {"answered": False, "response_class": "fallback",
                "engagement": 0.4, "why": ""}


def _react_to_silence_test(persona_ctx: str, story_context: str,
                           model: str) -> dict:
    """Silence test — does this listener actually stay quiet for 10s?"""
    prompt = (
        f"{persona_ctx}\n\nStory context so far:\n{story_context}\n\n"
        f"Meera whispers: \"Dus second. Koi. Awaaz. Nahi.\" "
        f"The phone is now listening to your room for 10 seconds.\n"
        f"Based on your personality (patience, discipline, environment), "
        f"do you stay perfectly silent, or make a sound?\n"
        "Respond as: {\"outcome\":\"quiet|noise\", "
        "\"engagement\":<0..1>, "
        "\"reason\":\"one line\"}"
    )
    try:
        r = chat_json(prompt, system=PERSONA_SYSTEM, model=model,
                      temperature=0.4, max_tokens=100)
        return {
            "outcome": r.get("outcome", "quiet"),
            "engagement": float(r.get("engagement", 0.5)),
            "reason": r.get("reason", ""),
        }
    except Exception:
        return {"outcome": "quiet", "engagement": 0.5, "reason": ""}


def _react_to_cliffhanger(persona_ctx: str, ending_summary: str,
                          cliffhanger_line: str, model: str) -> dict:
    """Would this persona return next episode?"""
    prompt = (
        f"{persona_ctx}\n\nThe episode ended: {ending_summary}\n"
        f"The cliffhanger line: \"{cliffhanger_line}\"\n\n"
        f"Would you return tomorrow for the next episode? "
        f"How strongly does this hook you?\n"
        "Respond as: {\"return\":<true|false>, "
        "\"hook_strength\":<0..1>}"
    )
    try:
        r = chat_json(prompt, system=PERSONA_SYSTEM, model=model,
                      temperature=0.5, max_tokens=80)
        return {
            "return": bool(r.get("return", True)),
            "hook_strength": float(r.get("hook_strength", 0.5)),
        }
    except Exception:
        return {"return": True, "hook_strength": 0.4}


# ---------- traversal ----------

def _find_seg(story: dict, seg_id: str) -> dict | None:
    for s in story["segments"]:
        if s["seg_id"] == seg_id:
            return s
    return None


def simulate_once(story: dict, persona: Persona, model: str,
                  dropoff_threshold: float = 0.3,
                  cohort_hint: str | None = None) -> list[Event]:
    """Walk one persona through the directed_story. Emit events."""
    run_id = str(uuid.uuid4())[:8]
    events: list[Event] = []
    story_id = story["story_id"]
    ctx = _persona_context(persona, cohort_hint=cohort_hint)
    history: list[str] = []
    flags: dict[str, str] = {}

    _emit(events, "story_started", run_id, persona, story_id,
          payload={"cohort_hint": cohort_hint or ""})

    for seg in story["segments"]:
        # Follow deterministic flow: honor previous seg's decision; else t_start order
        # For MVP we walk in declaration order and let flags gate consequence segments.
        seg_id = seg["seg_id"]

        # If this seg is a consequence of a prior decision AND we haven't
        # taken that decision path, skip it. Simple rule: skip segs whose
        # id contains "_reaction_" if it wasn't picked as consequence_seg.
        if "reaction" in seg_id and flags.get("_consequence_seg") not in {seg_id, None}:
            if flags.get("_consequence_seg") != seg_id:
                continue
        if seg_id.startswith("s8_") and flags.get("_ending_seg") and \
                flags.get("_ending_seg") != seg_id:
            continue

        _emit(events, "segment_entered", run_id, persona, story_id,
              node_id=seg_id,
              payload={"t_start": seg["t_start"], "beat": seg["beat"][:120]})

        effects = seg.get("event_track") or []
        for effect in effects:
            _emit(events, "effect_fired", run_id, persona, story_id,
                  node_id=seg_id,
                  payload={"effect_type": effect.get("type"),
                           "effect_id": effect.get("id"),
                           "t": effect.get("t")})

        # sensory react (if there are effects)
        if effects:
            react = _react_to_sensory(ctx, "; ".join(history[-3:]),
                                      seg_id, effects, model)
            _emit(events, "sensory_reaction", run_id, persona, story_id,
                  node_id=seg_id, payload=react)
            history.append(f"[{seg_id}] {react['reaction']} @ engagement={react['engagement']:.2f}")

            if react["engagement"] < dropoff_threshold or react["reaction"] == "skip":
                _emit(events, "session_ended", run_id, persona, story_id,
                      node_id=seg_id,
                      payload={"reason": "dropoff",
                               "engagement": react["engagement"],
                               "at": "sensory"})
                return events

        # decision point
        dp = seg.get("decision_point")
        if dp:
            if dp["kind"] == "interaction_agent":
                labels = [k for k in dp["outcomes"].keys() if k != "FALLBACK"]
                r = _react_to_call(ctx, "; ".join(history[-3:]),
                                   dp.get("objective", ""), labels, model)
                if not r["answered"]:
                    flags["call_response"] = "fallback"
                    _emit(events, "call_declined", run_id, persona, story_id,
                          node_id=seg_id,
                          payload={"engagement": r["engagement"], "why": r["why"]})
                else:
                    rc = r["response_class"] if r["response_class"] in dp["outcomes"] else "FALLBACK"
                    flags["call_response"] = rc.lower() if rc != "FALLBACK" else "fallback"
                    _emit(events, "call_answered", run_id, persona, story_id,
                          node_id=seg_id,
                          payload={"response_class": rc,
                                   "engagement": r["engagement"],
                                   "why": r["why"]})
                # route to consequence
                key = rc if r["answered"] else "FALLBACK"
                out = dp["outcomes"].get(key) or dp["outcomes"]["FALLBACK"]
                flags["_consequence_seg"] = out["consequence_seg"]
                history.append(f"[call] chose {key}")

            elif dp["kind"] == "mic_amplitude":
                s = _react_to_silence_test(ctx, "; ".join(history[-3:]), model)
                flags["silence"] = s["outcome"]
                _emit(events, "silence_test_result", run_id, persona, story_id,
                      node_id=seg_id,
                      payload={"outcome": s["outcome"],
                               "engagement": s["engagement"],
                               "reason": s["reason"]})
                out = dp["outcomes"].get(s["outcome"]) or dp["outcomes"][list(dp["outcomes"].keys())[0]]
                flags["_ending_seg"] = out["consequence_seg"]
                history.append(f"[silence] {s['outcome']}")

        # cliffhanger reaction — only if this seg has one and is the taken ending
        if seg.get("cliffhanger") and (
            seg_id.startswith("s8_") or seg.get("cliffhanger", {}).get("returns_next_episode")
        ):
            if flags.get("_ending_seg") and flags["_ending_seg"] != seg_id:
                continue
            c = _react_to_cliffhanger(ctx, seg["beat"],
                                      seg["cliffhanger"]["line"], model)
            _emit(events, "cliffhanger_hooked", run_id, persona, story_id,
                  node_id=seg_id,
                  payload={"returned": c["return"],
                           "hook_strength": c["hook_strength"],
                           "cliffhanger_kind": seg["cliffhanger"].get("kind")})
            _emit(events, "ending_reached", run_id, persona, story_id,
                  node_id=seg_id,
                  payload={"ending_seg": seg_id, "flags": {k: v for k, v in flags.items() if not k.startswith("_")}})

    _emit(events, "session_ended", run_id, persona, story_id,
          payload={"reason": "complete", "flags": {k: v for k, v in flags.items() if not k.startswith("_")}})
    return events


def simulate(story: dict, personas: list[Persona], model: str,
             rollouts: int = 1, dropoff_threshold: float = 0.3,
             cohort_hints: dict[str, str] | None = None,
             verbose: bool = True,
             progress_every: int = 25) -> list[Event]:
    """Simulate all personas × rollouts. Returns all events."""
    all_events: list[Event] = []
    total = len(personas) * rollouts
    done = 0
    for p in personas:
        hint = (cohort_hints or {}).get(p.persona_id)
        for _ in range(rollouts):
            all_events.extend(
                simulate_once(story, p, model, dropoff_threshold, cohort_hint=hint)
            )
            done += 1
            if verbose and done % progress_every == 0:
                print(f"  [sim] {done}/{total} runs done", file=sys.stderr)
    return all_events


def write_events(events: list[Event], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for e in events:
            f.write(e.model_dump_json() + "\n")


def load_story(path: Path) -> dict:
    return json.loads(path.read_text())
