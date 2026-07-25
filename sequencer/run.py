"""Sequencer — the iteration loop.

    for i in 1..N:
        events = simulate(story_i, cohort_personas)
        metrics = measure(events)
        if plateau(metrics, delta_threshold): break
        feedback = compose_feedback(story_i, metrics, genome)
        story_{i+1} = director(linear_script, genome, baseline=story_i, feedback)

Convergence: N iterations OR retention delta < threshold. Both terminate
deterministically for the demo.
"""

from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from eval.openai_client import chat_text, DEFAULT_MODEL
from eval.sim import simulate, write_events
from eval.schemas import Persona
from director.directed_story_schema import validate_directed_story
from director.director_v2 import direct


FEEDBACK_PROMPT = (HERE / "prompts" / "feedback.md").read_text()


def _load_personas(csv_path: Path) -> list[Persona]:
    """Local loader; keeps sequencer decoupled from run_eval CLI."""
    import csv
    from json import loads
    out: list[Persona] = []
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            for k in ("big5_o", "big5_c", "big5_e", "big5_a", "big5_n"):
                row[k] = float(row[k])
            row["nature_tags"] = [t for t in row.get("nature_tags", "").split("|") if t.strip()]
            row["past_watches"] = [t for t in row.get("past_watches", "").split("|") if t.strip()]
            row["content_pref_vec"] = loads(row["content_pref_vec"]) if row.get("content_pref_vec") else []
            for k in ("watch_completion_rate", "avg_session_min"):
                row[k] = float(row[k]) if row.get(k) else None
            for k in ("preferred_mode", "call_response_style"):
                row[k] = row[k] or None
            out.append(Persona(**row))
    return out


def measure(events: list[dict]) -> dict:
    """Retention + drop-off + cliffhanger hook rate for the whole sim."""
    total_runs = len({e["run_id"] for e in events})
    completed = sum(
        1 for e in events
        if e["event_type"] == "session_ended"
        and e["payload"].get("reason") == "complete"
    )
    dropoff_by_seg: dict[str, int] = {}
    for e in events:
        if (e["event_type"] == "session_ended"
                and e["payload"].get("reason") == "dropoff"):
            k = e.get("node_id") or "unknown"
            dropoff_by_seg[k] = dropoff_by_seg.get(k, 0) + 1
    cliff_events = [e for e in events if e["event_type"] == "cliffhanger_hooked"]
    hook_p = (
        sum(1 for e in cliff_events if e["payload"].get("returned"))
        / len(cliff_events) if cliff_events else 0.0
    )
    return {
        "total_runs": total_runs,
        "completion_rate": completed / total_runs if total_runs else 0.0,
        "dropoff_by_segment": dropoff_by_seg,
        "cliffhanger_hook_rate": round(hook_p, 3),
    }


def compose_feedback(prev_story: dict, prev_metrics: dict, genome: dict,
                     model: str = DEFAULT_MODEL) -> str:
    prompt = (
        f"PREV_STORY (excerpt):\n"
        f"{json.dumps({'segments':[{'seg_id':s['seg_id'],'reasoning':s.get('reasoning','')} for s in prev_story.get('segments',[])], 'endings':prev_story.get('endings',[])}, indent=2)}\n\n"
        f"PREV_METRICS:\n{json.dumps(prev_metrics, indent=2)}\n\n"
        f"GENOME:\n{json.dumps(genome, indent=2)}\n"
    )
    return chat_text(prompt, system=FEEDBACK_PROMPT, model=model,
                     temperature=0.5, max_tokens=400)


def plateau(prev_metric: float, curr_metric: float, threshold: float) -> bool:
    return abs(curr_metric - prev_metric) < threshold


def sequence(linear_script: str, genome: dict, personas: list[Persona],
             baseline_story: dict, max_iter: int = 3,
             delta_threshold: float = 0.03,
             model: str = DEFAULT_MODEL,
             sim_rollouts: int = 1,
             cohort_hints: dict[str, str] | None = None,
             ) -> dict:
    """Run the loop. Returns {"final": ..., "history": [...], "metrics": [...]}."""
    history = [baseline_story]
    all_metrics: list[dict] = []
    story = baseline_story
    prev_completion = 0.0

    for it in range(1, max_iter + 1):
        print(f"\n=== Sequencer iteration {it}/{max_iter} ===", file=sys.stderr)
        events = simulate(story, personas, model=model,
                          rollouts=sim_rollouts,
                          cohort_hints=cohort_hints,
                          verbose=False)
        events_d = [e.model_dump() for e in events]
        metrics = measure(events_d)
        metrics["iteration"] = it
        all_metrics.append(metrics)
        print(f"  completion_rate={metrics['completion_rate']:.2%} "
              f"hook_rate={metrics['cliffhanger_hook_rate']:.2%} "
              f"dropoffs={sum(metrics['dropoff_by_segment'].values())}",
              file=sys.stderr)

        if it > 1 and plateau(prev_completion, metrics["completion_rate"],
                              delta_threshold):
            print(f"  plateau reached (Δ<{delta_threshold})", file=sys.stderr)
            break
        prev_completion = metrics["completion_rate"]

        if it == max_iter:
            break

        feedback = compose_feedback(story, metrics, genome, model=model)
        story = direct(linear_script, genome, baseline=story,
                       feedback_notes=feedback, model=model, iteration=it + 1)
        errors = validate_directed_story(story)
        if errors:
            print(f"  ⚠ director output has {len(errors)} validation errors:",
                  file=sys.stderr)
            for e in errors[:3]:
                print(f"    - {e}", file=sys.stderr)
        history.append(story)

    return {
        "final": history[-1],
        "history": history,
        "metrics": all_metrics,
    }


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--linear-script", required=True, type=Path)
    ap.add_argument("--genome", required=True, type=Path)
    ap.add_argument("--personas", required=True, type=Path)
    ap.add_argument("--baseline", required=True, type=Path)
    ap.add_argument("--cohort-map", type=Path,
                    help="Optional persona_id -> cohort JSON (from generate_personas)")
    ap.add_argument("--max-iter", type=int, default=2)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--sim-rollouts", type=int, default=1)
    ap.add_argument("--out-dir", type=Path, default=Path("eval/out/sequencer"))
    args = ap.parse_args()

    genome = json.loads(args.genome.read_text())
    personas = _load_personas(args.personas)
    baseline = json.loads(args.baseline.read_text())
    linear_script = args.linear_script.read_text()
    cohort_hints = json.loads(args.cohort_map.read_text()) if args.cohort_map else None

    result = sequence(
        linear_script=linear_script,
        genome=genome, personas=personas,
        baseline_story=baseline,
        max_iter=args.max_iter,
        model=args.model,
        sim_rollouts=args.sim_rollouts,
        cohort_hints=cohort_hints,
    )

    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "final.json").write_text(json.dumps(result["final"], indent=2))
    (args.out_dir / "history.json").write_text(json.dumps(result["history"], indent=2))
    (args.out_dir / "metrics.json").write_text(json.dumps(result["metrics"], indent=2))
    print(f"\nSequencer done. {len(result['history'])} iterations. "
          f"Final in {args.out_dir}/final.json", file=sys.stderr)


if __name__ == "__main__":
    _main()
