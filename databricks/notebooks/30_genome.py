# Databricks notebook source
# MAGIC %md
# MAGIC # 30 · Build Genome Profiles
# MAGIC
# MAGIC Reads events for a sim iteration → per-persona behavior vector →
# MAGIC k-means k=2 → writes two Genome Profile JSON rows to
# MAGIC `billifm.eval.genome_profiles`.

# COMMAND ----------
dbutils.widgets.text("source_tag", "sim_iter0", "events_log source tag to read")
dbutils.widgets.text("k", "2", "Number of clusters (spec: 2)")
SOURCE = dbutils.widgets.get("source_tag")
K = int(dbutils.widgets.get("k"))

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

# COMMAND ----------
# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS billifm.eval.genome_profiles (
# MAGIC   iteration_tag STRING,
# MAGIC   cluster_id    INT,
# MAGIC   cohort        STRING,
# MAGIC   n_personas    INT,
# MAGIC   profile_json  STRING,
# MAGIC   built_at      TIMESTAMP
# MAGIC ) USING DELTA
# MAGIC COMMENT 'Genome Profile JSONs (agents.md §1) — one row per (iteration, cluster)';

# COMMAND ----------
# MAGIC %md ## Load events for this iteration

# COMMAND ----------
rows = spark.sql(f"""
  SELECT ts, user_id, story_id, run_id, event_type, node_id, payload
  FROM billifm.eval.events_log
  WHERE source = '{SOURCE}'
""").collect()

events = [{
    "ts": r["ts"], "user_id": r["user_id"], "story_id": r["story_id"],
    "run_id": r["run_id"], "event_type": r["event_type"],
    "node_id": r["node_id"],
    "payload": json.loads(r["payload"]) if r["payload"] else {},
} for r in rows]
print(f"Loaded {len(events)} events for source={SOURCE}")

# COMMAND ----------
# MAGIC %md ## Cluster + build profiles

# COMMAND ----------
from eval.genome import build_profiles
profiles, pmap = build_profiles(events, k=K, seed=0)
for p in profiles:
    print(f"{p['cohort']} (n={p['n_personas']}):")
    print(f"  attention: {p['attention_curve']}")
    print(f"  responds_to: {p['responds_to']}")
    print(f"  numb_to:     {p['numb_to']}")
    print(f"  cliff:       {p['cliffhanger_efficacy']}")
    print(f"  break:       {p['best_break_pattern']}")

# COMMAND ----------
# MAGIC %md ## Write profiles to Delta

# COMMAND ----------
from pyspark.sql import Row
from pyspark.sql.functions import current_timestamp

prof_rows = [Row(
    iteration_tag=SOURCE,
    cluster_id=p["cluster_id"], cohort=p["cohort"],
    n_personas=p["n_personas"],
    profile_json=json.dumps(p),
) for p in profiles]
(spark.createDataFrame(prof_rows)
 .withColumn("built_at", current_timestamp())
 .write.mode("append").saveAsTable("billifm.eval.genome_profiles"))

display(spark.sql(f"""
  SELECT iteration_tag, cohort, n_personas
  FROM billifm.eval.genome_profiles
  WHERE iteration_tag = '{SOURCE}'
"""))

# COMMAND ----------
# MAGIC %md
# MAGIC The Director notebook (`40_director.py`) reads the JSON from this
# MAGIC table by `iteration_tag` + `cluster_id` and feeds one profile at a
# MAGIC time.
