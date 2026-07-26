# Databricks notebook source
# MAGIC %md
# MAGIC # 60 · Generate image assets (per cohort)
# MAGIC
# MAGIC For each cohort's directed_story in `billifm.eval.directed_stories`,
# MAGIC produce one portrait phone-aspect image per key segment via
# MAGIC `gpt-image-1`. Images land in a Unity Catalog Volume so the demo
# MAGIC notebook can render them inline.
# MAGIC
# MAGIC ~14 images per full run, ~$0.60 at medium quality, ~2 min per image.
# MAGIC Plan for a 30-minute run when you kick this off.

# COMMAND ----------
dbutils.widgets.text("iteration_tag", "sim_iter0", "Which sim iteration to render")
dbutils.widgets.text("iteration", "1", "Which director iteration to render")
dbutils.widgets.dropdown("quality", "medium", ["low", "medium", "high"], "Image quality")
dbutils.widgets.text("volume_dir", "/Volumes/billifm/eval/raw_events/assets_v1",
                     "Volume path to write into")
ITER_TAG = dbutils.widgets.get("iteration_tag")
ITER = int(dbutils.widgets.get("iteration"))
QUALITY = dbutils.widgets.get("quality")
VOLUME_DIR = dbutils.widgets.get("volume_dir")

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if not repo_root.startswith("/Workspace/"):
    repo_root = "/Workspace" + repo_root
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

os.environ["OPENAI_API_KEY"] = dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")

# Load gen_images by file path (content/ isn't a package)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "gen_images", f"{repo_root}/content/gen_images.py"
)
gi = importlib.util.module_from_spec(spec); spec.loader.exec_module(gi)

# COMMAND ----------
# MAGIC %md ## Ensure volume subfolder exists

# COMMAND ----------
dbutils.fs.mkdirs(VOLUME_DIR)
print(f"Writing to {VOLUME_DIR}")

# COMMAND ----------
# MAGIC %md ## Load directed_stories for the iteration

# COMMAND ----------
rows = spark.sql(f"""
  SELECT cohort, story_json
  FROM billifm.eval.directed_stories
  WHERE iteration_tag = '{ITER_TAG}' AND iteration = {ITER}
""").collect()
print(f"{len(rows)} cohorts to render:", [r['cohort'] for r in rows])

# COMMAND ----------
# MAGIC %md ## Volume writer wrapper (uses REST inside the executor)

# COMMAND ----------
# gen_images writes to Volumes via the Databricks Files API, which needs
# DATABRICKS_HOST / DATABRICKS_TOKEN. Notebooks have host in the SparkContext
# and can mint a temp token — but simplest is to use dbutils.fs.put on the
# bytes directly, avoiding the network hop.
import base64, time

manifest_rows = []
for r in rows:
    story = json.loads(r["story_json"])
    cohort = r["cohort"]
    print(f"\n=== {cohort} ===")
    for seg in story.get("segments", []):
        sid = seg.get("seg_id","")
        if sid not in gi.DEMO_SEGMENT_ALLOWLIST:
            continue
        t0 = time.time()
        try:
            img_bytes = gi.generate_one(seg, cohort, quality=QUALITY)
            path = f"{VOLUME_DIR}/{sid}__{cohort}.png"
            # base64 to string, write via dbutils.fs (small binaries)
            # dbutils.fs.put accepts strings only, so use urllib-free path:
            # write via native filesystem — /Volumes/... is mounted.
            with open(path, "wb") as f:
                f.write(img_bytes)
            manifest_rows.append({
                "iteration_tag": ITER_TAG, "iteration": ITER,
                "cohort": cohort, "seg_id": sid,
                "volume_path": path,
                "bytes": len(img_bytes),
                "elapsed_s": round(time.time()-t0, 1),
                "quality": QUALITY,
            })
            print(f"  ✓ {sid}  {len(img_bytes)//1024}KB  {time.time()-t0:.1f}s")
        except Exception as ex:
            manifest_rows.append({
                "iteration_tag": ITER_TAG, "iteration": ITER,
                "cohort": cohort, "seg_id": sid,
                "volume_path": None, "bytes": 0,
                "elapsed_s": round(time.time()-t0, 1),
                "quality": QUALITY, "error": str(ex)[:400],
            })
            print(f"  ✗ {sid}  {ex}")

# COMMAND ----------
# MAGIC %md ## Manifest → Delta

# COMMAND ----------
# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS billifm.eval.image_assets (
# MAGIC   iteration_tag STRING,
# MAGIC   iteration     INT,
# MAGIC   cohort        STRING,
# MAGIC   seg_id        STRING,
# MAGIC   volume_path   STRING,
# MAGIC   bytes         BIGINT,
# MAGIC   elapsed_s     DOUBLE,
# MAGIC   quality       STRING,
# MAGIC   error         STRING,
# MAGIC   built_at      TIMESTAMP
# MAGIC ) USING DELTA
# MAGIC COMMENT 'Manifest of images produced by 60_generate_assets. One row per (iteration, cohort, seg_id).';

# COMMAND ----------
from pyspark.sql.functions import current_timestamp
if manifest_rows:
    (spark.createDataFrame(manifest_rows)
     .withColumn("built_at", current_timestamp())
     .write.mode("append").saveAsTable("billifm.eval.image_assets"))
display(spark.sql(f"""
  SELECT cohort, seg_id, bytes, elapsed_s, error
  FROM billifm.eval.image_assets
  WHERE iteration_tag = '{ITER_TAG}' AND iteration = {ITER}
  ORDER BY cohort, seg_id
"""))
