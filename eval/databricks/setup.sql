-- Billifm eval — Databricks resource DDL.
--
-- Run once per workspace. Idempotent: uses IF NOT EXISTS.
-- Assumes Unity Catalog is enabled and the caller has CREATE CATALOG
-- privilege. If not, replace `billifm` below with an existing catalog
-- (e.g. `workspace`) and just create the schema.

CREATE CATALOG IF NOT EXISTS billifm
  COMMENT 'Billifm interactive story eval + prod data';

CREATE SCHEMA IF NOT EXISTS billifm.eval
  COMMENT 'Persona-simulated + real interactive-story events';

-- Landing volume: JSONL event files uploaded from local sim runs
-- get merged into events_log via COPY INTO.
CREATE VOLUME IF NOT EXISTS billifm.eval.raw_events
  COMMENT 'Landing zone for JSONL event uploads';

-- Shared event log for both simulator runs and real production users.
-- payload stored as JSON string for portability; upgrade to VARIANT later
-- if you want typed access.
CREATE TABLE IF NOT EXISTS billifm.eval.events_log (
  ts           DOUBLE,
  ts_utc       TIMESTAMP,
  user_id      STRING,
  story_id     STRING,
  run_id       STRING,
  event_type   STRING,
  node_id      STRING,
  payload      STRING,
  source       STRING,           -- 'sim' | 'prod'
  ingested_at  TIMESTAMP
) USING DELTA
PARTITIONED BY (story_id)
COMMENT 'Shared shape for sim + real events. payload is JSON string.';

-- Persona registry. dim table; MERGE'd on persona_id.
CREATE TABLE IF NOT EXISTS billifm.eval.personas (
  persona_id             STRING,
  age_band               STRING,
  gender                 STRING,
  region                 STRING,
  big5_o                 DOUBLE,
  big5_c                 DOUBLE,
  big5_e                 DOUBLE,
  big5_a                 DOUBLE,
  big5_n                 DOUBLE,
  nature_tags            ARRAY<STRING>,
  content_pref_vec       ARRAY<DOUBLE>,
  past_watches           ARRAY<STRING>,
  watch_completion_rate  DOUBLE,
  avg_session_min        DOUBLE,
  preferred_mode         STRING,
  call_response_style    STRING,
  ingested_at            TIMESTAMP
) USING DELTA
COMMENT 'Persona registry — dim table joined to events_log';

-- Story registry. Full DAG kept as raw JSON so downstream analysis
-- can reconstruct paths / choices without re-reading the source files.
CREATE TABLE IF NOT EXISTS billifm.eval.stories (
  story_id     STRING,
  title        STRING,
  mode         STRING,           -- interactive | standard | minimal
  root_node    STRING,
  genome       STRING,           -- JSON
  node_count   INT,
  raw_json     STRING,
  ingested_at  TIMESTAMP
) USING DELTA
COMMENT 'Story registry — DAG stored as JSON blob + summary columns';
