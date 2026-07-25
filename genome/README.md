# genome/ — M10a, the Genome Agent

**Status: handed off. Not mine.** One file exists as a starting point; the rest is
open. Do not assume anything here is finished.

## What is done

`make_sessions.py` — generates the synthetic behaviour corpus. Verified: 10,000
sessions, deterministic per index, and it carries Sutradhar's distinctive vectors
(answered the call, talked vs stayed silent, passed the silence test, opened the
Board, called Iqbal) rather than just skips and drop-offs.

```bash
python make_sessions.py --count 10000        # -> sessions.jsonl
```

Current output on 10k sessions: mean completion 0.698, answered call 65.5%, passed
silence 54.1%, returned within 24h 49.0%.

**One design decision worth keeping:** sessions are drawn from three latent cohorts
with overlapping noisy parameters, and **the cohort label is deliberately not
written into the output**. Whoever writes the clustering step has to *rediscover*
the structure. That makes the genome a computed result instead of a constant we
typed in — which is the difference between a pipeline and a mock, and it is the
difference a judge will ask about.

The ground-truth cohorts (in `COHORTS`, for checking your clustering, not for
shipping): `night_thriller_binger` 42%, `daytime_casual_commuter` 38%,
`weekend_slow_burn` 20%.

## What is NOT done

- **`compute.py`** — sessions → cohort genome profiles. Needs to cluster, then emit
  the profile shape specified in [../files/agents.md](../files/agents.md) Module 1:
  `attention_curve`, `responds_to`, `numb_to`, `cliffhanger_efficacy`,
  `decision_point_tolerance`, `best_break_pattern`. The corpus already contains
  everything needed to derive each of those — `first_skip_s` drives the attention
  curve, and `cliffhanger_type` × `returned_24h` gives efficacy directly.
- **Databricks** — land `sessions.jsonl` in a Delta table and compute cohorts there.
  `../eval/delta_sync.py` already pushes JSONL to Delta with stdlib only; point it
  at this file rather than writing a new loader.
- **M10b Director v2** — script + genome profile → `directed_story.json`. This is
  the two-genomes side-by-side demo, and scope.md §4 says prefer it over M6 if you
  can only build one.

## Honesty rule

The corpus is synthetic and every session carries `"synthetic": true`. agents.md
commits us to saying so on stage. The pipeline is real; the listeners are
simulated. Say both.

## Reuse, don't rewrite

`../eval/` already does persona simulation → JSONL → Delta → cohort aggregation
(~1,400 lines). Its event schema has no Sutradhar-specific vectors, which is why
this corpus exists separately — but its `delta_sync.py` and `aggregate.py` are
directly reusable.
