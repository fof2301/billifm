"""Call transcript -> summary + decision-point outcome + flags.

This is the ~40 lines that make "the characters remember" true.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

import agents

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = os.environ.get("OPENAI_SUMMARY_MODEL", "gpt-4.1-mini")


async def summarize_call(transcript: str) -> dict[str, Any]:
    """Returns {"summary": str, "outcome": "A"|"B"|"C"|"FALLBACK", "flags": {...}}.

    Never raises. If the API is down mid-demo we degrade to a FALLBACK summary
    rather than take the episode with us.
    """
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return _degraded(transcript, "no OPENAI_API_KEY set")

    payload = {
        "model": MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": agents.summarizer_prompt()},
            {"role": "user", "content": transcript or "(no speech)"},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}"},
                json=payload,
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
    except Exception as err:  # noqa: BLE001 - demo safety beats correctness here
        return _degraded(transcript, str(err))

    return {
        "summary": parsed.get("summary", "")[:400],
        "outcome": parsed.get("outcome", "FALLBACK"),
        "flags": parsed.get("flags", {}) or {},
    }


def _degraded(transcript: str, reason: str) -> dict[str, Any]:
    return {
        "summary": f"Call happened; summary unavailable ({reason}).",
        "outcome": "FALLBACK",
        "flags": {"summarizer_degraded": True},
    }
