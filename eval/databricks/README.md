# Databricks flow

Local eval runs land JSONL files. From there:

1. `eval/delta_sync.py events --file eval/out/events.jsonl` uploads
   the file to `/Volumes/billifm/eval/raw_events/` and runs
   `COPY INTO billifm.eval.events_log`.
2. `eval/delta_sync.py personas --file eval/examples/personas.csv`
   MERGEs the persona registry.
3. `eval/delta_sync.py story --file eval/examples/story.json`
   MERGEs the story registry.
4. Open `analyze_notebook.py` in Databricks — attach a Serverless
   warehouse or a Photon cluster and it produces every metric via
   SQL against `billifm.eval.events_log`.

## Why this shape

- **Local sim, cloud analytics.** The heavy loop (persona × LLM
  calls) stays on your machine so you can iterate fast with Ollama.
  Databricks owns the persistent event lake and any team dashboards.
- **Same schema for sim and prod.** Set `source='sim'` for
  simulation runs and `source='prod'` when your app ships events
  from real listeners. Every query in `analyze.sql` and the
  notebook works for both.
- **JSON payload column.** Keeps the ingest schema stable while the
  event details evolve. Upgrade to VARIANT later if you want typed
  access without re-ingest.

## Env vars for `delta_sync.py`

```
export DATABRICKS_HOST=https://dbc-XXXXXXXX-XXXX.cloud.databricks.com
export DATABRICKS_TOKEN=dapiXXXXXXXX
export DATABRICKS_WAREHOUSE_ID=<serverless-warehouse-id>
```

Find the warehouse ID under *SQL Warehouses* in the Databricks UI,
or with:

```
curl -s -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "$DATABRICKS_HOST/api/2.0/sql/warehouses" | jq '.warehouses[] | {id, name}'
```

## Provisioning

`setup.sql` records the DDL for the catalog, schema, volume, and
Delta tables. Idempotent — safe to re-run. Ships as a reproducible
record of what's in the workspace, not something you have to run
if setup was already done via the API.

## Files

| File | Purpose |
| --- | --- |
| `setup.sql` | Catalog / schema / volume / table DDL |
| `analyze.sql` | Portable SQL versions of every eval metric |
| `analyze_notebook.py` | Same queries as a Databricks notebook |
| `README.md` | This file |
