# Databricks notebook source
# MAGIC %md
# MAGIC # 10 · Generate persona corpus
# MAGIC
# MAGIC Samples N personas across the two declared cohorts and lands them in
# MAGIC `billifm.eval.personas`. Also writes a persona_id → cohort map to a
# MAGIC Volume for the simulator.

# COMMAND ----------
dbutils.widgets.text("n_personas", "200", "How many personas")
dbutils.widgets.text("seed", "42", "RNG seed")
N = int(dbutils.widgets.get("n_personas"))
SEED = int(dbutils.widgets.get("seed"))

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from eval.generate_personas import generate, COHORTS

# COMMAND ----------
personas = list(generate(N, seed=SEED))
print(f"Generated {len(personas)} personas across {len(COHORTS)} cohorts")

# COMMAND ----------
# MAGIC %md ## Land in Delta

# COMMAND ----------
from pyspark.sql import Row
from pyspark.sql.functions import current_timestamp

rows = [Row(
    persona_id=p["persona_id"],
    age_band=p["age_band"], gender=p["gender"], region=p["region"],
    big5_o=p["big5_o"], big5_c=p["big5_c"], big5_e=p["big5_e"],
    big5_a=p["big5_a"], big5_n=p["big5_n"],
    nature_tags=p["nature_tags"],
    content_pref_vec=[float(x) for x in p["content_pref_vec"]],
    past_watches=p["past_watches"],
    watch_completion_rate=p["watch_completion_rate"],
    avg_session_min=p["avg_session_min"],
    preferred_mode=p["preferred_mode"],
    call_response_style=p["call_response_style"],
) for p in personas]

df = spark.createDataFrame(rows).withColumn("ingested_at", current_timestamp())
df.createOrReplaceTempView("_new_personas")
spark.sql("""
  MERGE INTO billifm.eval.personas AS t
  USING _new_personas AS s
  ON t.persona_id = s.persona_id
  WHEN MATCHED THEN UPDATE SET *
  WHEN NOT MATCHED THEN INSERT *
""")
display(spark.sql(
  "SELECT COUNT(*) AS n FROM billifm.eval.personas"))

# COMMAND ----------
# MAGIC %md ## Save cohort map for the simulator

# COMMAND ----------
volume_dir = "/Volumes/billifm/eval/raw_events"
dbutils.fs.mkdirs(volume_dir)
cohort_map = {p["persona_id"]: p["cohort"] for p in personas}
dbutils.fs.put(
    f"{volume_dir}/cohort_map.json",
    json.dumps(cohort_map),
    overwrite=True,
)
print(f"Cohort map: {sum(1 for c in cohort_map.values() if c=='thriller_binger_IN_night')} thriller, "
      f"{sum(1 for c in cohort_map.values() if c=='slow_burn_drama_IN_evening')} slow-burn")
