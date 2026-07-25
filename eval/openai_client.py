"""OpenAI client — the single LLM backend for eval, sequencer, and director-v2.

Reads the API key from Databricks Secrets when running on a cluster, or
from the `OPENAI_API_KEY` env var locally. One helper for JSON-mode
chat and one for freeform.

The default model is small on purpose — see the sutradhar-stack memory
note for the rationale ("moderate model, save credits for image gen").
Bump per-call via the `model=` kwarg only where a specific call
under-performs.
"""

from __future__ import annotations
import json
import os
from typing import Optional

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError(
        "The `openai` Python package is required. `pip install openai`."
    ) from e


DEFAULT_MODEL = "gpt-4o-mini"
_client: Optional[OpenAI] = None


def _api_key() -> str:
    """Prefer Databricks Secrets (in a notebook context), fall back to env."""
    try:
        from pyspark.dbutils import DBUtils  # type: ignore
        from pyspark.sql import SparkSession  # type: ignore
        dbutils = DBUtils(SparkSession.builder.getOrCreate())
        return dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")
    except Exception:
        pass

    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY not set. On Databricks: "
            "`dbutils.secrets.get('sutradhar','OPENAI_API_KEY')`. "
            "Locally: `export OPENAI_API_KEY=sk-...`."
        )
    return key


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=_api_key())
    return _client


def chat_json(prompt: str, system: Optional[str] = None,
              model: str = DEFAULT_MODEL,
              schema: Optional[dict] = None,
              schema_name: str = "response",
              temperature: float = 0.5,
              max_tokens: int = 2000) -> dict:
    """Chat completion with JSON output.

    If `schema` is provided, uses `response_format=json_schema` (strict
    structured output). Otherwise falls back to `json_object` mode.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if schema is not None:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": False, "schema": schema},
        }
    else:
        kwargs["response_format"] = {"type": "json_object"}

    response = _get_client().chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    try:
        return json.loads(content or "{}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned non-JSON: {(content or '')[:200]}") from e


def chat_text(prompt: str, system: Optional[str] = None,
              model: str = DEFAULT_MODEL,
              temperature: float = 0.7,
              max_tokens: int = 1000) -> str:
    """Freeform chat completion (no JSON constraint)."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = _get_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
