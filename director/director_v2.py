"""Director Agent v2 — linear script + genome profile → directed_story.json.

This is Module 2 from agents.md. The M7 annotator (annotate.py) is the
Director's step 3 for the raw Event Track; this file is steps 1-2-4:
segmentation, cliffhanger + decision placement, per-segment reasoning.

Uses OpenAI structured output against DIRECTED_STORY_JSON_SCHEMA. Reads
API key from Databricks Secrets on cluster, env locally.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path

# Import from sibling files without requiring director/ to be a package.
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from directed_story_schema import (
    DIRECTED_STORY_JSON_SCHEMA, validate_directed_story,
)

# The OpenAI client lives in eval/ — reach it as a module.
sys.path.insert(0, str(HERE.parent))
from eval.openai_client import chat_json, DEFAULT_MODEL


PROMPT_PATH = HERE / "prompts" / "director.md"


def direct(linear_script: str, genome_profile: dict,
           baseline: dict | None = None,
           feedback_notes: str | None = None,
           model: str = DEFAULT_MODEL,
           iteration: int = 1) -> dict:
    """Call the Director. Returns a validated directed_story dict."""
    system = PROMPT_PATH.read_text()

    parts = [
        f"GENOME PROFILE:\n{json.dumps(genome_profile, indent=2)}\n",
        f"LINEAR SCRIPT (with time markers):\n{linear_script}\n",
    ]
    if baseline is not None:
        parts.append(
            "BASELINE (manual v0 — improve on this, don't just copy):\n"
            f"{json.dumps(baseline, indent=2)[:8000]}\n"
        )
    if feedback_notes:
        parts.append(f"FEEDBACK NOTES FROM PREVIOUS ITERATION:\n{feedback_notes}\n")
    parts.append(
        f"Return ONLY a directed_story.json object with iteration={iteration}, "
        f"source=\"director_agent\", genome_ref=\"{genome_profile.get('cohort','')}\"."
    )
    user_prompt = "\n---\n".join(parts)

    result = chat_json(
        user_prompt, system=system, model=model,
        schema=DIRECTED_STORY_JSON_SCHEMA, schema_name="directed_story",
        temperature=0.6, max_tokens=4000,
    )
    result.setdefault("iteration", iteration)
    result.setdefault("source", "director_agent")
    result.setdefault("genome_ref", genome_profile.get("cohort", ""))
    return result


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--linear-script", required=True, type=Path)
    ap.add_argument("--genome", required=True, type=Path,
                    help="Path to one genome profile JSON object")
    ap.add_argument("--baseline", type=Path,
                    default=Path("content/directed_story_v0.json"))
    ap.add_argument("--feedback", type=Path)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--iteration", type=int, default=1)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    script = args.linear_script.read_text()
    genome = json.loads(args.genome.read_text())
    baseline = json.loads(args.baseline.read_text()) if args.baseline.exists() else None
    feedback = args.feedback.read_text() if args.feedback else None

    story = direct(script, genome, baseline=baseline,
                   feedback_notes=feedback, model=args.model,
                   iteration=args.iteration)

    errors = validate_directed_story(story)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(story, indent=2, ensure_ascii=False))
    print(f"Wrote {args.out}  segments={len(story.get('segments',[]))}  "
          f"endings={len(story.get('endings',[]))}  errors={len(errors)}",
          file=sys.stderr)
    for e in errors:
        print(f"  ✗ {e}", file=sys.stderr)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    _main()
