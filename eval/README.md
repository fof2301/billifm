# Sutradhar Data Layer — Genome + Director + Sequencer

The data-layer piece of Sutradhar (see [/files/agents.md](../files/agents.md) for
the full pipeline spec, and [/files/scope.md M10a](../files/scope.md) for
the scope constraint).

**Owner:** Shreyansh. Also owns Databricks deployment. Others own `app/`,
`server/`, the M7 annotator in `director/`, and `content/`.

**Model:** `gpt-4o-mini` everywhere. Ollama has been dropped.

## What lives here

| File | Purpose |
| --- | --- |
| `schemas.py` | `Persona`, `Event` pydantic models (the OG `Story` type is legacy — the new pipeline uses `content/directed_story_v0.json` as a raw dict) |
| `openai_client.py` | Single LLM backend. Reads key from Databricks Secrets on cluster, `OPENAI_API_KEY` env var locally |
| `generate_personas.py` | Sample N personas across two declared cohorts |
| `sim.py` | Walk one persona through a `directed_story` → emit Sutradhar-specific events (call_answered, silence_test_result, cliffhanger_hooked, effect_fired, …) |
| `genome.py` | events → per-persona behavior vectors → k-means k=2 → Genome Profile JSON (agents.md §1 shape) |
| `aggregate.py` | Legacy per-run report (retention curve, drop-off, choice distribution). The Databricks notebooks are the authoritative aggregation layer |
| `delta_sync.py` | Upload local JSONL / persona CSV to Delta via the SQL warehouse (kept for the local → cloud workflow) |
| `run_eval.py` | Local CLI: `simulate` + `report` |
| `databricks/` | Portable SQL + legacy analysis notebook. New notebooks live in top-level `../databricks/` |

Sibling directories:

- [`../director/`](../director/) — the M7 annotator (owned by someone else)
  **plus** `director_v2.py` + `directed_story_schema.py` + `prompts/director.md`
  (this repo's Director agent, owned by us)
- [`../sequencer/`](../sequencer/) — the iteration loop
- [`../databricks/`](../databricks/) — Databricks notebooks (this is the
  production path — read `../databricks/README.md`)
- [`../content/directed_story_v0.json`](../content/directed_story_v0.json) —
  hand-authored manual baseline the Sequencer improves against

## Local dev flow

```bash
pip install -r eval/requirements.txt
export OPENAI_API_KEY=sk-...

# 1. Generate a small persona corpus
python -m eval.generate_personas -n 50

# 2. Simulate against the manual v0
python -m eval.run_eval simulate \
    --story content/directed_story_v0.json \
    --personas eval/out/personas.csv \
    --cohort-map eval/out/cohort_map.json \
    --out eval/out/events.jsonl

# 3. Build genome profiles (k=2)
python -m eval.genome --events eval/out/events.jsonl

# 4. Direct once per profile
python -m director.director_v2 \
    --linear-script files/story.md \
    --genome eval/out/genome_profiles.json \
    --out eval/out/directed_v1.json

# 5. Full sequencer (2 iterations)
python -m sequencer.run \
    --linear-script files/story.md \
    --genome eval/out/genome_profiles.json \
    --personas eval/out/personas.csv \
    --baseline content/directed_story_v0.json \
    --cohort-map eval/out/cohort_map.json \
    --max-iter 2
```

Local runs cost cents. Do NOT run 10k personas locally — that's a
Databricks job.

## Databricks (production) flow

Read [`../databricks/README.md`](../databricks/README.md).

Short version:
1. Repos → Add Repo → `https://github.com/fof2301/billifm`
2. Run `databricks/notebooks/00_setup.py` once per new cluster
3. `10 → 20 → 30 → 40 → 50` runs the full pipeline; `99` is the test suite

## Event schema (Sutradhar-specific)

Every event has `{ts, user_id, story_id, run_id, event_type, node_id, payload}`.
Sutradhar-specific `event_type` values:

| event_type | Emitted when | Payload |
| --- | --- | --- |
| `story_started` | Persona starts a run | `{cohort_hint}` |
| `segment_entered` | Persona enters a segment | `{t_start, beat}` |
| `effect_fired` | Any sensory effect | `{effect_type, effect_id, t}` |
| `sensory_reaction` | Persona reacts to the effect(s) | `{reaction, engagement}` |
| `call_answered` | Persona picks up the villain call | `{response_class, engagement, why}` |
| `call_declined` | Persona lets it ring | `{engagement, why}` |
| `silence_test_result` | Silence test finishes | `{outcome, engagement, reason}` |
| `cliffhanger_hooked` | Cliffhanger delivered | `{returned, hook_strength, cliffhanger_kind}` |
| `ending_reached` | Persona hits an ending seg | `{ending_seg, flags}` |
| `session_ended` | Any terminal state | `{reason, engagement?}` |

Table target: `billifm.eval.events_log`, column `event_type STRING`,
`payload STRING(JSON)`. No schema migration needed as new event types are
added.

## Cohort profile shape (agents.md §1)

```json
{
  "cohort": "...",
  "n_personas": 100,
  "attention_curve": {"safe_zone_s": 45, "risk_after_s": 90},
  "responds_to": ["silence_tension", "direct_address", "haptic_sync"],
  "numb_to": ["jump_scares", "long_exposition"],
  "cliffhanger_efficacy": {"return_promise": 0.81, "threat_to_listener": 0.63},
  "decision_point_tolerance": 1,
  "best_break_pattern": "5min_segments_hard_out"
}
```
