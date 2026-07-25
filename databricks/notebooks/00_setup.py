# Databricks notebook source
# MAGIC %md
# MAGIC # 00 · Sutradhar setup
# MAGIC
# MAGIC Run once per new cluster. Installs Python deps and verifies the
# MAGIC OpenAI secret is reachable.

# COMMAND ----------
# MAGIC %pip install -q -r ../../eval/requirements.txt
# MAGIC dbutils.library.restartPython()

# COMMAND ----------
# MAGIC %md ## Verify secret + basic OpenAI call

# COMMAND ----------
key = dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")
assert key.startswith("sk-"), "secret shape looks wrong"
print("OPENAI_API_KEY is present in the sutradhar scope")

# COMMAND ----------
import sys, os
os.environ["OPENAI_API_KEY"] = key
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from eval.openai_client import chat_json
r = chat_json("Reply with {\"ok\":true} and nothing else.", model="gpt-4o-mini",
              max_tokens=20, temperature=0)
print("OpenAI reachable:", r)

# COMMAND ----------
# MAGIC %md ## Verify Unity Catalog + Delta tables

# COMMAND ----------
display(spark.sql("SHOW TABLES IN billifm.eval"))

# COMMAND ----------
# MAGIC %md You should see: `events_log`, `personas`, `stories`.
# MAGIC If missing, run `eval/databricks/setup.sql` first.
