# Databricks notebook source
# MAGIC %md
# MAGIC # 40 · Director agent
# MAGIC
# MAGIC For one iteration_tag, take each Genome Profile → call the Director
# MAGIC (GPT-4o-mini w/ JSON schema) → land the directed_story JSON in
# MAGIC `billifm.eval.directed_stories`.

# COMMAND ----------
dbutils.widgets.text("iteration_tag", "sim_iter0", "Genome iteration tag to direct for")
dbutils.widgets.text("baseline_path", "content/directed_story_v0.json", "Baseline story")
dbutils.widgets.text("script_path", "files/story.md", "Linear script")
dbutils.widgets.text("iteration_out", "1", "Iteration number to stamp on output")
dbutils.widgets.text("model", "gpt-4o-mini", "OpenAI model")
ITER_TAG = dbutils.widgets.get("iteration_tag")
BASELINE = dbutils.widgets.get("baseline_path")
SCRIPT = dbutils.widgets.get("script_path")
ITER_OUT = int(dbutils.widgets.get("iteration_out"))
MODEL = dbutils.widgets.get("model")

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)
os.environ["OPENAI_API_KEY"] = dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")

import importlib.util
def _load(mod_name, file_rel):
    spec = importlib.util.spec_from_file_location(
        mod_name, f"{repo_root}/{file_rel}"
    )
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m
_dss = _load("directed_story_schema", "director/directed_story_schema.py")
_dv2 = _load("director_v2", "director/director_v2.py")
direct = _dv2.direct
validate_directed_story = _dss.validate_directed_story

# COMMAND ----------
# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS billifm.eval.directed_stories (
# MAGIC   iteration_tag STRING,
# MAGIC   iteration     INT,
# MAGIC   cohort        STRING,
# MAGIC   story_id      STRING,
# MAGIC   n_segments    INT,
# MAGIC   n_endings     INT,
# MAGIC   validation_errors ARRAY<STRING>,
# MAGIC   story_json    STRING,
# MAGIC   built_at      TIMESTAMP
# MAGIC ) USING DELTA
# MAGIC COMMENT 'Director-v2 outputs. Two per iteration_tag (one per cohort).';

# COMMAND ----------
# MAGIC %md ## Load inputs

# COMMAND ----------
linear_script = open(f"{repo_root}/{SCRIPT}").read()
baseline = json.load(open(f"{repo_root}/{BASELINE}"))
print(f"Script: {len(linear_script)} chars  Baseline: {len(baseline['segments'])} segments")

profiles = spark.sql(f"""
  SELECT cohort, profile_json
  FROM billifm.eval.genome_profiles
  WHERE iteration_tag = '{ITER_TAG}'
""").collect()
print(f"Loaded {len(profiles)} genome profiles for tag {ITER_TAG!r}")

# COMMAND ----------
# MAGIC %md ## Direct once per cohort

# COMMAND ----------
from pyspark.sql import Row
from pyspark.sql.functions import current_timestamp

out_rows = []
for r in profiles:
    genome = json.loads(r["profile_json"])
    print(f"\n=== Directing for cohort {genome['cohort']} ===")
    story = direct(linear_script, genome, baseline=baseline,
                   model=MODEL, iteration=ITER_OUT)
    errors = validate_directed_story(story)
    print(f"  segments={len(story.get('segments',[]))} "
          f"endings={len(story.get('endings',[]))} errors={len(errors)}")
    if errors:
        for e in errors[:3]:
            print(f"    ✗ {e}")
    out_rows.append(Row(
        iteration_tag=ITER_TAG,
        iteration=ITER_OUT,
        cohort=genome["cohort"],
        story_id=story.get("story_id", "?"),
        n_segments=len(story.get("segments", [])),
        n_endings=len(story.get("endings", [])),
        validation_errors=errors,
        story_json=json.dumps(story, ensure_ascii=False),
    ))

# COMMAND ----------
(spark.createDataFrame(out_rows)
 .withColumn("built_at", current_timestamp())
 .write.mode("append").saveAsTable("billifm.eval.directed_stories"))

display(spark.sql(f"""
  SELECT cohort, n_segments, n_endings, size(validation_errors) AS errs
  FROM billifm.eval.directed_stories
  WHERE iteration_tag = '{ITER_TAG}' AND iteration = {ITER_OUT}
"""))
