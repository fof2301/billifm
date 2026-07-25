# Billifm — Interactive Story Evaluation Framework

An evaluation harness for interactive stories on Billifm. It simulates
audience personas walking through a branching story graph and produces
retention, drop-off, and trait-fit metrics — before the story ever
ships to real users.

The event schema is intentionally shared between simulation and
production, so anything you learn from eval works just as well on
post-launch analytics.

---

## What it evaluates

For a given story + audience, you get:

- **Completion rate** — what % of listeners reach an ending
- **Retention curve** — fraction of runs that reach each node
- **Drop-off hotspots** — where personas quit
- **Choice distribution** — how a decision splits the audience
- **Callback label distribution** — for virtual-call nodes, which
  intent classes users land on
- **Trait-fit by drop-off** — the average personality profile of
  personas who bailed at each node ("extraverts are dropping at n7")

---

## Installation

```bash
pip install -r eval/requirements.txt
```

You also need [Ollama](https://ollama.com) with at least one model pulled:

```bash
# Local (fast, cheap)
ollama pull qwen3:4b        # or gemma3:4b, phi4-mini

# Cloud (better quality; needs `ollama signin`)
ollama pull gemma4:cloud
```

---

## Quick start

From the repo root:

```bash
# 1. Simulate 10 personas x 3 rollouts against the sample story
python -m eval.run_eval simulate \
    --story eval/examples/story.json \
    --personas eval/examples/personas.csv \
    --model qwen3:4b \
    --rollouts 3 \
    --out eval/out/events.jsonl

# 2. Produce a report
python -m eval.run_eval report \
    --events eval/out/events.jsonl \
    --personas eval/examples/personas.csv
```

Add `--json` to `report` to get machine-readable output for a
dashboard.

---

## Story format

Stories are directed graphs of typed nodes. Full schema in
[`schemas.py`](schemas.py). Node types:

| Type        | Purpose                                                              |
| ----------- | -------------------------------------------------------------------- |
| `narrative` | Plain audio/prose. Advances to `next`.                               |
| `decision`  | Presents choices; each choice has its own `next`.                    |
| `callback`  | Character "calls" the user; user replies free-text; a classifier maps the reply to a label; the label is looked up in `next_map` to pick the next node. |
| `merge`     | Convergence point where branches rejoin.                             |
| `end`       | Terminal node (an ending).                                           |

Every story starts at `root` and travels through nodes until it hits an
`end` — or the persona drops off.

See [`examples/story.json`](examples/story.json) for a complete
12-node story called "Missed Call".

---

## Persona CSV format

Columns (in order):

```
persona_id, age_band, gender, region,
big5_o, big5_c, big5_e, big5_a, big5_n,   # 0-1 floats
nature_tags,                               # pipe-separated
content_pref_vec,                          # JSON array (quote the field!)
past_watches,                              # pipe-separated (may be empty)
watch_completion_rate,                     # 0-1 (may be empty)
avg_session_min,                           # float (may be empty)
preferred_mode,                            # interactive|standard|minimal (may be empty)
call_response_style                        # text|voice|skip (may be empty)
```

Fields after `content_pref_vec` are optional — the simulator reasons
with whatever's present. See
[`examples/personas.csv`](examples/personas.csv) for 10 sample rows
(2 have watch history filled, matching the "~20% populated" starting
point).

---

## Event schema

Emitted by the simulator to a JSONL file. Also the shape you should
send to PostHog / your event lake in production.

```
story_started    (user_id, story_id, ts)
node_entered     (node_id)
decision_made    (node_id, choice_id, engagement)
callback_answered(node_id, text, classified_label, engagement)
session_ended    (node_id, reason: complete|dropoff|max_steps_exceeded,
                             engagement?, ending_label?)
```

`run_id` distinguishes multiple rollouts of the same persona.

---

## Model split (recommended)

| Role                          | Model                          | Why                                            |
| ----------------------------- | ------------------------------ | ---------------------------------------------- |
| Story writer (external)       | `gemma4:cloud` or Claude       | JSON reliability at graph scale                |
| Persona sim (×N rollouts)     | `qwen3:4b` / `gemma3:4b` local | Fast, cheap, good enough for persona choices   |
| Callback intent classifier    | `qwen3:4b` local               | Small-text intent classification               |
| Judge / rewrite suggester     | `gemma4:cloud`                 | Nuanced critique on drop-off hotspots          |

Small models are noisy at 4B — that's why we do 3–5 rollouts per
persona. Majority behavior stabilizes with more runs.

---

## Extending

- **Add a node type** — subclass a Pydantic model in `schemas.py`,
  extend the `Union`, then handle it in `sim.simulate_once`.
- **Change drop-off logic** — tweak `dropoff_threshold` or replace
  `_ask_engagement` with something deterministic (e.g. a trait-vs-genome
  match score).
- **Custom aggregations** — add functions to `aggregate.py` that read
  the JSONL stream. Everything downstream is dict-shaped.
- **Real-user events** — mirror the event schema in your app, ship to
  PostHog / DuckDB. All aggregators here work unchanged.

---

## What's not built yet (by design)

- **Story writer** — the LLM that generates `story.json` from a
  premise. Deliberately deferred until the writer model is picked
  (Claude vs. `gemma4:cloud` vs. something else).
- **Return-loop / push-notification sim** — the virtual-call-back
  feature. Paper design lives in the top-level PRD; add a
  `notification_sent` / `notification_responded` handler to `sim.py`
  when ready.
- **Judge / rewrite recommender** — takes drop-off hotspots and
  suggests story edits. Straightforward to add once we know the writer.

---

## Layout

```
eval/
├── README.md                # this file
├── requirements.txt
├── __init__.py
├── schemas.py               # Pydantic: Story, Persona, Event
├── ollama_client.py         # thin JSON-mode wrapper
├── sim.py                   # persona traversal + event emission
├── aggregate.py             # metrics + text report
├── run_eval.py              # CLI entry point
└── examples/
    ├── story.json           # 12-node sample story
    └── personas.csv         # 10 sample personas
```
