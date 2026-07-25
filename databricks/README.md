# Databricks — Sutradhar data layer

Everything under `databricks/notebooks/` runs on a Databricks workspace
attached to serverless compute (or any Photon cluster). Nothing needs a
custom Docker image — deps come from `eval/requirements.txt`.

## Notebooks (run in order)

| # | Notebook | Purpose |
|---|---|---|
| 00 | `00_setup.py` | Install deps, verify secret + Delta tables |
| 10 | `10_generate_personas.py` | Sample N personas across 2 cohorts → `billifm.eval.personas` |
| 20 | `20_simulate.py` | Persona × story → events → `billifm.eval.events_log` (source=`sim_iterN`). Sharded via `mapInPandas` |
| 30 | `30_genome.py` | events → k-means k=2 → `billifm.eval.genome_profiles` |
| 40 | `40_director.py` | Genome × linear script → `billifm.eval.directed_stories` (one per cohort) |
| 50 | `50_two_genomes_demo.py` | Side-by-side render for the pitch |
| 99 | `99_tests.py` | Smoke tests — run before + after any code change |

## Iteration loop

To sequence 3 iterations manually:

```
10  (once)
for iter in 0..2:
    20 --iteration=iter
    30 --source_tag=sim_iter{iter}
    40 --iteration_tag=sim_iter{iter} --iteration_out={iter+1}
    (measure retention delta, decide to continue)
50 (once, after last iter)
```

Or run `sequencer/run.py` locally against the workspace by exporting
env vars — it drives the same primitives.

## Secrets

Key must exist at `sutradhar/OPENAI_API_KEY` (created via `secrets/put`
API — see `sutradhar_secrets` memory).

## Deployment

1. Databricks UI → **Workspace → Repos → Add Repo**
2. URL: `https://github.com/fof2301/billifm`
3. Path: `/Workspace/Repos/<your-user>/billifm`
4. **Pull** after each commit.

All notebooks assume that path — they build `repo_root` from
`spark.sql("SELECT current_user()")`.

## Model + cost

Default model: `gpt-4o-mini`. Rough spend for a full run with 200
personas × 3 sim iterations × 2 director calls: **~$0.60**. Scaling to
2,000 personas: **~$5**.
