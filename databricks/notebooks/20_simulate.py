# Databricks notebook source
# MAGIC %md
# MAGIC # 20 · Simulate personas on a directed story
# MAGIC
# MAGIC Loads personas + cohort map + a directed_story JSON, runs the
# MAGIC Sutradhar sim, and lands the events in `billifm.eval.events_log`.
# MAGIC
# MAGIC Sharded via `mapInPandas` so 200-2000 personas run in parallel.

# COMMAND ----------
dbutils.widgets.text("story_path", "content/directed_story_v0.json", "Story JSON (repo-relative)")
dbutils.widgets.text("iteration", "0", "Iteration tag (0 = manual v0)")
dbutils.widgets.text("rollouts", "1", "Rollouts per persona")
dbutils.widgets.text("model", "gpt-4o-mini", "OpenAI model")
STORY_PATH = dbutils.widgets.get("story_path")
ITERATION = int(dbutils.widgets.get("iteration"))
ROLLOUTS = int(dbutils.widgets.get("rollouts"))
MODEL = dbutils.widgets.get("model")

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if not repo_root.startswith("/Workspace/"):
    repo_root = "/Workspace" + repo_root   # Databricks FS is /Workspace/... under Files In Repos
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

os.environ["OPENAI_API_KEY"] = dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")

# COMMAND ----------
# MAGIC %md ## Load story + cohort map

# COMMAND ----------
story = json.load(open(f"{repo_root}/{STORY_PATH}"))
cohort_map = json.loads(
    dbutils.fs.head("/Volumes/billifm/eval/raw_events/cohort_map.json", 5_000_000)
)
print(f"Story: {story['story_id']} · {len(story['segments'])} segments")
print(f"Cohort map has {len(cohort_map)} personas")

# COMMAND ----------
# MAGIC %md ## Load personas from Delta

# COMMAND ----------
personas_df = spark.table("billifm.eval.personas").filter(
    f"persona_id IN ({','.join(repr(p) for p in cohort_map.keys())})"
)
print(f"Loaded {personas_df.count()} persona rows")

# COMMAND ----------
# MAGIC %md ## Run the sim (mapInPandas)

# COMMAND ----------
import pandas as pd
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType

def _run_shard(iterator):
    """One Spark task handles one shard of personas."""
    # These imports run inside the executor.
    import sys, os, json, time
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from eval.schemas import Persona
    from eval.sim import simulate_once

    for pdf in iterator:
        rows_out = []
        for _, row in pdf.iterrows():
            try:
                p = Persona(
                    persona_id=row["persona_id"],
                    age_band=row["age_band"], gender=row["gender"], region=row["region"],
                    big5_o=row["big5_o"], big5_c=row["big5_c"], big5_e=row["big5_e"],
                    big5_a=row["big5_a"], big5_n=row["big5_n"],
                    nature_tags=list(row["nature_tags"] or []),
                    content_pref_vec=list(row["content_pref_vec"] or []),
                    past_watches=list(row["past_watches"] or []),
                    watch_completion_rate=row.get("watch_completion_rate"),
                    avg_session_min=row.get("avg_session_min"),
                    preferred_mode=row.get("preferred_mode"),
                    call_response_style=row.get("call_response_style"),
                )
                for _r in range(ROLLOUTS):
                    for e in simulate_once(story, p, model=MODEL,
                                           cohort_hint=cohort_map.get(p.persona_id)):
                        rows_out.append({
                            "ts": e.ts, "user_id": e.user_id,
                            "story_id": e.story_id, "run_id": e.run_id,
                            "event_type": e.event_type,
                            "node_id": e.node_id,
                            "payload": json.dumps(e.payload),
                        })
            except Exception as ex:
                rows_out.append({
                    "ts": time.time(), "user_id": str(row["persona_id"]),
                    "story_id": story["story_id"], "run_id": "err",
                    "event_type": "sim_error", "node_id": None,
                    "payload": json.dumps({"error": str(ex)[:400]}),
                })
        yield pd.DataFrame(rows_out) if rows_out else pd.DataFrame(
            columns=["ts","user_id","story_id","run_id","event_type","node_id","payload"]
        )


schema = StructType([
    StructField("ts", DoubleType()),
    StructField("user_id", StringType()),
    StructField("story_id", StringType()),
    StructField("run_id", StringType()),
    StructField("event_type", StringType()),
    StructField("node_id", StringType()),
    StructField("payload", StringType()),
])

events_df = personas_df.repartition(8).mapInPandas(_run_shard, schema=schema)

# COMMAND ----------
# MAGIC %md ## Land in `events_log`

# COMMAND ----------
from pyspark.sql.functions import (
    col, current_timestamp, lit, from_unixtime, to_timestamp,
)

final_df = (
    events_df
    .withColumn("ts_utc", to_timestamp(from_unixtime(col("ts"))))
    .withColumn("source", lit(f"sim_iter{ITERATION}"))
    .withColumn("ingested_at", current_timestamp())
    .select("ts","ts_utc","user_id","story_id","run_id","event_type",
            "node_id","payload","source","ingested_at")
)
final_df.write.mode("append").saveAsTable("billifm.eval.events_log")

# COMMAND ----------
display(spark.sql(f"""
  SELECT event_type, COUNT(*) AS n
  FROM billifm.eval.events_log
  WHERE source = 'sim_iter{ITERATION}'
  GROUP BY event_type ORDER BY n DESC
"""))
