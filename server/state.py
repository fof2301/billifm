"""Listener state. One JSON file, one hardcoded listener (D5, rules.md 2).

This module is the whole "characters remember" magic. Both live loops - the
in-episode villain call and the post-episode callback - read and write the same
file, which is why Meera can thank you for something you said to the villain.

Spoiler safety is STRUCTURAL, not prompted: `canon_upto` slices the story bible
at the listener's episode_progress, so a character physically cannot be given
text about events they should not know (rules.md 4).
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_DIR = Path(__file__).parent / "state"
STATE_FILE = STATE_DIR / "listener.json"
CANON_FILE = Path(__file__).parent / "canon" / "story_bible.md"

_lock = threading.Lock()

DEFAULT_STATE: dict[str, Any] = {
    "listener_id": "demo",
    "episode_progress": 7,  # they are about to listen to 8
    "flags": {},
    "interactions": [],
}


def load() -> dict[str, Any]:
    with _lock:
        if not STATE_FILE.exists():
            STATE_DIR.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(json.dumps(DEFAULT_STATE, indent=2))
            return json.loads(json.dumps(DEFAULT_STATE))
        return json.loads(STATE_FILE.read_text())


def save(state: dict[str, Any]) -> None:
    with _lock:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))


def set_flag(key: str, value: Any) -> dict[str, Any]:
    state = load()
    state.setdefault("flags", {})[key] = value
    save(state)
    return state


def add_interaction(channel: str, character: str, summary: str) -> dict[str, Any]:
    state = load()
    state.setdefault("interactions", []).append(
        {
            "ts": datetime.now(timezone.utc).isoformat(),
            "channel": channel,
            "character": character,
            "summary": summary,
        }
    )
    save(state)
    return state


def set_progress(episode: int) -> dict[str, Any]:
    state = load()
    state["episode_progress"] = max(state.get("episode_progress", 0), episode)
    save(state)
    return state


def canon_upto(episode: int) -> str:
    """Return only the canon sections at or below `episode`.

    The bible marks gated sections with `<!-- EPISODE: n -->`. Anything above the
    listener's progress is dropped before it can reach a prompt. Never rely on
    telling the model "don't spoil" - it will spoil.
    """
    if not CANON_FILE.exists():
        return ""

    kept: list[str] = []
    current_gate = 0
    for line in CANON_FILE.read_text().splitlines():
        stripped = line.strip()
        if stripped.startswith("<!-- EPISODE:") and stripped.endswith("-->"):
            try:
                current_gate = int(stripped.removeprefix("<!-- EPISODE:").removesuffix("-->").strip())
            except ValueError:
                current_gate = 0
            continue
        if current_gate <= episode:
            kept.append(line)
    return "\n".join(kept).strip()


def recent_interactions(limit: int = 3) -> str:
    state = load()
    items = state.get("interactions", [])[-limit:]
    if not items:
        return "(no prior contact with this listener)"
    return "\n".join(f"- [{i['character']} via {i['channel']}] {i['summary']}" for i in items)


def flags_summary() -> str:
    flags = load().get("flags", {})
    if not flags:
        return "(none set)"
    return "\n".join(f"- {k}: {v}" for k, v in flags.items())


def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)
