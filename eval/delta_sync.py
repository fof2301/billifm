"""Sync local eval artifacts to Databricks Delta tables.

Design: local JSONL / CSV / story JSON stays the source of truth
during a run. When you're ready to analyze in Databricks, call this
module to:

  1. upload events.jsonl to the `billifm.eval.raw_events` Volume
  2. COPY INTO `billifm.eval.events_log` (idempotent — uses file names
     as the load-token so re-runs of the same file are skipped)
  3. optionally sync `personas.csv` and `story.json` to their
     registry tables

All writes go through the Statement Execution API against a serverless
SQL warehouse — no cluster needed, no Spark install required locally.

Env vars required:
  DATABRICKS_HOST    e.g. https://dbc-xxxx.cloud.databricks.com
  DATABRICKS_TOKEN   PAT (dapi...)
  DATABRICKS_WAREHOUSE_ID  serverless SQL warehouse ID

Defaults for catalog/schema/table are overridable via keyword args.
"""

from __future__ import annotations
import csv
import json
import os
import time
import urllib.request
from pathlib import Path


CATALOG = "billifm"
SCHEMA = "eval"
EVENTS_TABLE = "events_log"
PERSONAS_TABLE = "personas"
STORIES_TABLE = "stories"
RAW_EVENTS_VOLUME = "raw_events"


# ---------- HTTP + SQL execution ----------

def _cfg() -> tuple[str, str, str]:
    host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
    token = os.environ.get("DATABRICKS_TOKEN", "")
    warehouse = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
    if not (host and token and warehouse):
        raise RuntimeError(
            "Set DATABRICKS_HOST, DATABRICKS_TOKEN, and "
            "DATABRICKS_WAREHOUSE_ID before calling delta_sync."
        )
    return host, token, warehouse


def _request(method: str, path: str,
             body: dict | bytes | None = None,
             extra_headers: dict | None = None) -> dict:
    host, token, _ = _cfg()
    url = f"{host}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    if extra_headers:
        headers.update(extra_headers)
    data: bytes | None = None
    if isinstance(body, dict):
        headers.setdefault("Content-Type", "application/json")
        data = json.dumps(body).encode()
    elif isinstance(body, (bytes, bytearray)):
        data = bytes(body)
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw.decode(errors="replace")}


def run_sql(sql: str, params: list[dict] | None = None,
            poll_secs: float = 2.0, timeout_secs: float = 300.0) -> dict:
    """Execute SQL against the configured warehouse and return the result.

    Blocks until the statement is in a terminal state or `timeout_secs`.
    Raises on FAILED / CANCELED / CLOSED.
    """
    _, _, warehouse = _cfg()
    body = {"warehouse_id": warehouse, "statement": sql, "wait_timeout": "30s"}
    if params:
        body["parameters"] = params
    resp = _request("POST", "/api/2.0/sql/statements", body=body)
    sid = resp.get("statement_id")
    if not sid:
        raise RuntimeError(f"Statement Execution API rejected request: {resp}")

    deadline = time.time() + timeout_secs
    while True:
        state = resp.get("status", {}).get("state")
        if state == "SUCCEEDED":
            return resp
        if state in {"FAILED", "CANCELED", "CLOSED"}:
            err = resp.get("status", {}).get("error", {})
            raise RuntimeError(f"SQL {state}: {err.get('message', err)}\nSQL: {sql[:200]}")
        if time.time() > deadline:
            raise TimeoutError(f"SQL still {state} after {timeout_secs}s")
        time.sleep(poll_secs)
        resp = _request("GET", f"/api/2.0/sql/statements/{sid}")


# ---------- Volume upload ----------

def upload_to_volume(local_path: Path, volume_path: str,
                     overwrite: bool = True) -> None:
    """Upload a local file to a Unity Catalog Volume via the Files API.

    volume_path example: /Volumes/billifm/eval/raw_events/events-20260725.jsonl
    """
    host, token, _ = _cfg()
    url = f"{host}/api/2.0/fs/files{volume_path}"
    if overwrite:
        url += "?overwrite=true"
    data = local_path.read_bytes()
    req = urllib.request.Request(
        url, data=data, method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        if r.status not in (200, 204):
            raise RuntimeError(f"Volume upload failed: HTTP {r.status}")


# ---------- Event sync ----------

def sync_events(events_jsonl: Path, source: str = "sim",
                catalog: str = CATALOG, schema: str = SCHEMA,
                table: str = EVENTS_TABLE,
                volume: str = RAW_EVENTS_VOLUME) -> dict:
    """Upload a JSONL event file and COPY INTO the Delta events table.

    COPY INTO is idempotent by filename — safe to re-run.
    Returns the SQL result summary.
    """
    fname = events_jsonl.name
    volume_path = f"/Volumes/{catalog}/{schema}/{volume}/{fname}"
    upload_to_volume(events_jsonl, volume_path)

    # COPY INTO reads the JSONL and appends to the Delta table.
    # We wrap it in a SELECT that adds ts_utc / source / ingested_at columns
    # so the write matches the table schema exactly.
    sql = f"""
COPY INTO {catalog}.{schema}.{table}
FROM (
  SELECT
    CAST(ts AS DOUBLE)                       AS ts,
    CAST(from_unixtime(ts) AS TIMESTAMP)     AS ts_utc,
    user_id, story_id, run_id, event_type, node_id,
    to_json(payload)                         AS payload,
    '{source}'                               AS source,
    current_timestamp()                      AS ingested_at
  FROM '/Volumes/{catalog}/{schema}/{volume}/'
)
FILEFORMAT = JSON
PATTERN = '{fname}'
FORMAT_OPTIONS ('multiline' = 'false')
COPY_OPTIONS ('mergeSchema' = 'false')
""".strip()
    return run_sql(sql)


# ---------- Persona sync ----------

def sync_personas(personas_csv: Path,
                  catalog: str = CATALOG, schema: str = SCHEMA,
                  table: str = PERSONAS_TABLE) -> dict:
    """MERGE personas from a local CSV into the Delta persona table."""
    rows = _load_personas_rows(personas_csv)
    if not rows:
        return {"rows_merged": 0}

    values = ",\n".join(_persona_row_to_sql(r) for r in rows)
    sql = f"""
MERGE INTO {catalog}.{schema}.{table} AS t
USING (
  SELECT * FROM (VALUES
    {values}
  ) AS v(
    persona_id, age_band, gender, region,
    big5_o, big5_c, big5_e, big5_a, big5_n,
    nature_tags, content_pref_vec, past_watches,
    watch_completion_rate, avg_session_min,
    preferred_mode, call_response_style, ingested_at
  )
) AS s
ON t.persona_id = s.persona_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
""".strip()
    return run_sql(sql)


def _load_personas_rows(path: Path) -> list[dict]:
    out = []
    with path.open() as f:
        for r in csv.DictReader(f):
            r["nature_tags"] = [t for t in r.get("nature_tags", "").split("|") if t.strip()]
            r["past_watches"] = [t for t in r.get("past_watches", "").split("|") if t.strip()]
            r["content_pref_vec"] = (
                json.loads(r["content_pref_vec"])
                if r.get("content_pref_vec") else []
            )
            out.append(r)
    return out


def _persona_row_to_sql(r: dict) -> str:
    def s(v):
        if v is None or v == "":
            return "NULL"
        return "'" + str(v).replace("'", "''") + "'"

    def f(v):
        return "NULL" if v in (None, "") else str(float(v))

    def a_str(vs):
        if not vs:
            return "ARRAY()"
        return "ARRAY(" + ",".join(s(v) for v in vs) + ")"

    def a_dbl(vs):
        if not vs:
            return "ARRAY()"
        return "ARRAY(" + ",".join(str(float(v)) for v in vs) + ")"

    return (
        f"({s(r['persona_id'])}, {s(r['age_band'])}, {s(r['gender'])}, {s(r['region'])}, "
        f"{f(r['big5_o'])}, {f(r['big5_c'])}, {f(r['big5_e'])}, {f(r['big5_a'])}, {f(r['big5_n'])}, "
        f"{a_str(r['nature_tags'])}, {a_dbl(r['content_pref_vec'])}, {a_str(r['past_watches'])}, "
        f"{f(r.get('watch_completion_rate'))}, {f(r.get('avg_session_min'))}, "
        f"{s(r.get('preferred_mode'))}, {s(r.get('call_response_style'))}, "
        f"current_timestamp())"
    )


# ---------- Story sync ----------

def sync_story(story_json: Path,
               catalog: str = CATALOG, schema: str = SCHEMA,
               table: str = STORIES_TABLE) -> dict:
    """MERGE a single story into the Delta story registry."""
    story = json.loads(story_json.read_text())
    story_id = story["story_id"]
    title = story["title"].replace("'", "''")
    mode = story["mode"]
    root = story["root"]
    genome = json.dumps(story.get("genome", {})).replace("'", "''")
    node_count = len(story.get("nodes", []))
    raw = json.dumps(story).replace("'", "''")

    sql = f"""
MERGE INTO {catalog}.{schema}.{table} AS t
USING (SELECT
  '{story_id}' AS story_id, '{title}' AS title, '{mode}' AS mode,
  '{root}' AS root_node, '{genome}' AS genome,
  {node_count} AS node_count, '{raw}' AS raw_json,
  current_timestamp() AS ingested_at
) AS s
ON t.story_id = s.story_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *
""".strip()
    return run_sql(sql)


# ---------- CLI ----------

def _main() -> None:
    import argparse
    ap = argparse.ArgumentParser(
        description="Sync eval artifacts to Databricks Delta.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("events", help="Upload JSONL and COPY INTO events_log")
    e.add_argument("--file", required=True, type=Path)
    e.add_argument("--source", default="sim")

    p = sub.add_parser("personas", help="MERGE personas CSV")
    p.add_argument("--file", required=True, type=Path)

    s = sub.add_parser("story", help="MERGE a story JSON")
    s.add_argument("--file", required=True, type=Path)

    args = ap.parse_args()
    if args.cmd == "events":
        print(sync_events(args.file, source=args.source))
    elif args.cmd == "personas":
        print(sync_personas(args.file))
    elif args.cmd == "story":
        print(sync_story(args.file))


if __name__ == "__main__":
    _main()
