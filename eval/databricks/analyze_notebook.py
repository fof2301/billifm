# Databricks notebook source
# MAGIC %md
# MAGIC # Billifm eval — Databricks analysis notebook
# MAGIC
# MAGIC End-to-end view of a story's simulated retention using Delta.
# MAGIC Runs the same aggregations as `eval/aggregate.py` but as
# MAGIC declarative SQL against `billifm.eval.events_log` — which means
# MAGIC these queries also work unchanged on real production events
# MAGIC (just switch `source = 'sim'` to `'prod'`).
# MAGIC
# MAGIC Attach to a Serverless SQL warehouse or any Photon-enabled cluster.

# COMMAND ----------
# MAGIC %md
# MAGIC ## Config

# COMMAND ----------
dbutils.widgets.text("story_id", "s001", "Story ID")
dbutils.widgets.dropdown("source", "sim", ["sim", "prod"], "Event source")
STORY_ID = dbutils.widgets.get("story_id")
SOURCE = dbutils.widgets.get("source")
print(f"Analyzing story={STORY_ID} source={SOURCE}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 1. Retention curve

# COMMAND ----------
retention = spark.sql(f"""
  WITH runs AS (
    SELECT COUNT(DISTINCT run_id) AS n
    FROM billifm.eval.events_log
    WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
  ),
  hits AS (
    SELECT node_id, COUNT(DISTINCT run_id) AS reached
    FROM billifm.eval.events_log
    WHERE story_id = '{STORY_ID}'
      AND source = '{SOURCE}'
      AND event_type = 'node_entered'
    GROUP BY node_id
  )
  SELECT h.node_id, h.reached,
         ROUND(h.reached * 1.0 / r.n, 3) AS retention
  FROM hits h CROSS JOIN runs r
  ORDER BY retention DESC
""")
display(retention)

# COMMAND ----------
# MAGIC %md
# MAGIC ## 2. Completion rate + drop-off hotspots

# COMMAND ----------
display(spark.sql(f"""
  SELECT COUNT(*) AS total_runs,
         SUM(CASE WHEN get_json_object(payload,'$.reason')='complete'
                  THEN 1 ELSE 0 END) AS completed,
         ROUND(SUM(CASE WHEN get_json_object(payload,'$.reason')='complete'
                        THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 3) AS completion_rate
  FROM billifm.eval.events_log
  WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
    AND event_type = 'session_ended'
"""))

# COMMAND ----------
display(spark.sql(f"""
  SELECT node_id, COUNT(*) AS dropoffs,
         ROUND(AVG(CAST(get_json_object(payload,'$.engagement') AS DOUBLE)), 3) AS avg_engagement
  FROM billifm.eval.events_log
  WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
    AND event_type = 'session_ended'
    AND get_json_object(payload,'$.reason') = 'dropoff'
  GROUP BY node_id
  ORDER BY dropoffs DESC
"""))

# COMMAND ----------
# MAGIC %md
# MAGIC ## 3. Choice + callback distributions

# COMMAND ----------
display(spark.sql(f"""
  SELECT node_id,
         get_json_object(payload,'$.choice_id') AS choice_id,
         COUNT(*) AS times_chosen
  FROM billifm.eval.events_log
  WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
    AND event_type = 'decision_made'
  GROUP BY node_id, get_json_object(payload,'$.choice_id')
  ORDER BY node_id, times_chosen DESC
"""))

# COMMAND ----------
display(spark.sql(f"""
  SELECT node_id,
         get_json_object(payload,'$.classified_label') AS label,
         COUNT(*) AS n
  FROM billifm.eval.events_log
  WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
    AND event_type = 'callback_answered'
  GROUP BY node_id, get_json_object(payload,'$.classified_label')
  ORDER BY node_id, n DESC
"""))

# COMMAND ----------
# MAGIC %md
# MAGIC ## 4. Who's dropping off where (trait fit)

# COMMAND ----------
display(spark.sql(f"""
  SELECT e.node_id, COUNT(*) AS n,
         ROUND(AVG(p.big5_o), 2) AS avg_o,
         ROUND(AVG(p.big5_c), 2) AS avg_c,
         ROUND(AVG(p.big5_e), 2) AS avg_e,
         ROUND(AVG(p.big5_a), 2) AS avg_a,
         ROUND(AVG(p.big5_n), 2) AS avg_neu
  FROM billifm.eval.events_log e
  JOIN billifm.eval.personas p ON e.user_id = p.persona_id
  WHERE e.story_id = '{STORY_ID}' AND e.source = '{SOURCE}'
    AND e.event_type = 'session_ended'
    AND get_json_object(e.payload,'$.reason') = 'dropoff'
  GROUP BY e.node_id
  ORDER BY n DESC
"""))

# COMMAND ----------
# MAGIC %md
# MAGIC ## 5. Declared vs. actual audience (genome delta)

# COMMAND ----------
display(spark.sql(f"""
  WITH completers AS (
    SELECT DISTINCT run_id, user_id
    FROM billifm.eval.events_log
    WHERE story_id = '{STORY_ID}' AND source = '{SOURCE}'
      AND event_type = 'session_ended'
      AND get_json_object(payload,'$.reason') = 'complete'
  )
  SELECT s.story_id, s.title,
         get_json_object(s.genome, '$.target_traits') AS declared_target_traits,
         ROUND(AVG(p.big5_o), 2) AS actual_avg_o,
         ROUND(AVG(p.big5_c), 2) AS actual_avg_c,
         ROUND(AVG(p.big5_e), 2) AS actual_avg_e,
         ROUND(AVG(p.big5_a), 2) AS actual_avg_a,
         ROUND(AVG(p.big5_n), 2) AS actual_avg_neu,
         COUNT(DISTINCT c.user_id) AS n_completers
  FROM completers c
  JOIN billifm.eval.personas p ON c.user_id = p.persona_id
  JOIN billifm.eval.stories  s ON s.story_id = '{STORY_ID}'
  GROUP BY s.story_id, s.title, s.genome
"""))
