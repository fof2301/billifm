# Databricks notebook source
# MAGIC %md
# MAGIC # 50 · Two Genomes, Side by Side
# MAGIC
# MAGIC **The killer demo beat.** Same linear script + two genome profiles →
# MAGIC two visibly different directions. This notebook renders the
# MAGIC comparison — genome, segments, decision points, cliffhangers,
# MAGIC reasoning — side by side for the pitch.

# COMMAND ----------
dbutils.widgets.text("iteration_tag", "sim_iter0", "Which iteration_tag to show")
dbutils.widgets.text("iteration", "1", "Which director iteration to show")
ITER_TAG = dbutils.widgets.get("iteration_tag")
ITER = int(dbutils.widgets.get("iteration"))

# COMMAND ----------
import json
rows = spark.sql(f"""
  SELECT ds.cohort AS cohort,
         ds.story_json AS story_json,
         gp.profile_json AS genome_json
  FROM billifm.eval.directed_stories ds
  JOIN billifm.eval.genome_profiles gp
    ON ds.iteration_tag = gp.iteration_tag AND ds.cohort = gp.cohort
  WHERE ds.iteration_tag = '{ITER_TAG}' AND ds.iteration = {ITER}
""").collect()

assert len(rows) >= 2, f"expected ≥2 rows, got {len(rows)}"
left = {"cohort": rows[0]["cohort"],
        "story": json.loads(rows[0]["story_json"]),
        "genome": json.loads(rows[0]["genome_json"])}
right = {"cohort": rows[1]["cohort"],
         "story": json.loads(rows[1]["story_json"]),
         "genome": json.loads(rows[1]["genome_json"])}

# COMMAND ----------
# MAGIC %md ## Genome fingerprints

# COMMAND ----------
def _genome_row(g):
    return {
        "cohort": g["cohort"], "n_personas": g["n_personas"],
        "safe_zone_s": g["attention_curve"]["safe_zone_s"],
        "risk_after_s": g["attention_curve"]["risk_after_s"],
        "responds_to": ", ".join(g["responds_to"]),
        "numb_to": ", ".join(g["numb_to"]) or "—",
        "return_promise": g["cliffhanger_efficacy"]["return_promise"],
        "threat_to_listener": g["cliffhanger_efficacy"]["threat_to_listener"],
        "break_pattern": g["best_break_pattern"],
    }
import pandas as pd
display(pd.DataFrame([_genome_row(left["genome"]), _genome_row(right["genome"])]))

# COMMAND ----------
# MAGIC %md ## Segments side by side

# COMMAND ----------
def _seg_view(story):
    out = []
    for s in story["segments"]:
        dp = s.get("decision_point")
        cliff = s.get("cliffhanger")
        out.append({
            "seg_id": s["seg_id"],
            "t": f"{s['t_start']:.0f}-{s['t_end']:.0f}",
            "beat": (s.get("beat","") or "")[:60],
            "effects": ",".join(e.get("type","") for e in s.get("event_track",[])) or "—",
            "decision": dp["decision_id"] if dp else "—",
            "cliffhanger": cliff["kind"] if cliff else "—",
            "reasoning_snippet": (s.get("reasoning","") or "")[:80],
        })
    return pd.DataFrame(out)

print(f"=== LEFT: {left['cohort']} ===")
display(_seg_view(left["story"]))

# COMMAND ----------
print(f"=== RIGHT: {right['cohort']} ===")
display(_seg_view(right["story"]))

# COMMAND ----------
# MAGIC %md ## The delta — what actually differs

# COMMAND ----------
def _decisions(story):
    return {s["decision_point"]["decision_id"]: s["seg_id"]
            for s in story["segments"] if s.get("decision_point")}
def _cliffs(story):
    return [(s["seg_id"], s["cliffhanger"]["kind"])
            for s in story["segments"] if s.get("cliffhanger")]

print("Decision points (left):", _decisions(left["story"]))
print("Decision points (right):", _decisions(right["story"]))
print()
print("Cliffhangers (left):",  _cliffs(left["story"]))
print("Cliffhangers (right):", _cliffs(right["story"]))
print()
print("Reasoning (left):",  left["story"].get("reasoning",{}).get("why_this_shape","")[:250])
print("Reasoning (right):", right["story"].get("reasoning",{}).get("why_this_shape","")[:250])
