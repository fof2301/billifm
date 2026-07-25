"""Prompt assembly for the live agents.

Prompts live in prompts/*.md as plain markdown and are read fresh on every call
(rules.md 3) - so you can retune the villain mid-rehearsal without restarting
anything, let alone rebuilding the app.
"""

from __future__ import annotations

from pathlib import Path

import state

PROMPTS = Path(__file__).parent / "prompts"

AGENTS = {
    "villain": "villain.md",
    "heroine": "heroine.md",
}


def build_system_prompt(agent: str) -> str:
    """Assemble persona + episode-gated canon + interaction memory."""
    filename = AGENTS.get(agent)
    if not filename:
        raise ValueError(f"unknown agent {agent!r}; known: {sorted(AGENTS)}")

    template = (PROMPTS / filename).read_text()
    current = state.load()
    progress = current.get("episode_progress", 0)

    return template.format(
        episode_progress=progress,
        canon=state.canon_upto(progress),
        interactions=state.recent_interactions(3),
        flags=state.flags_summary(),
    )


def summarizer_prompt() -> str:
    return (PROMPTS / "summarizer.md").read_text()
