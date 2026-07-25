"""Thin Ollama wrapper. Works with local and cloud models identically.

Uses `format="json"` to force structured output. If the model returns
prose, the caller can fall back to defaults.
"""

from __future__ import annotations
import json
from typing import Optional

try:
    import ollama
except ImportError as e:
    raise ImportError(
        "The `ollama` Python client is required. Install with: pip install ollama"
    ) from e


def chat_json(model: str, prompt: str, system: Optional[str] = None,
              options: Optional[dict] = None) -> dict:
    """Call the model and parse a JSON response.

    Raises ValueError if the response is not valid JSON.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = ollama.chat(
        model=model,
        messages=messages,
        format="json",
        options=options or {},
    )
    content = response["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned non-JSON: {content[:200]}") from e


def chat_text(model: str, prompt: str, system: Optional[str] = None) -> str:
    """Call the model and return raw text (no JSON parsing)."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return ollama.chat(model=model, messages=messages)["message"]["content"]
