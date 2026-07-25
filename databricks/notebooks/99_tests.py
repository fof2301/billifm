# Databricks notebook source
# MAGIC %md
# MAGIC # 99 · Sutradhar data-layer smoke tests
# MAGIC
# MAGIC Run after any code change. Each cell is a test — pass/fail printed at
# MAGIC the end. Cheap on OpenAI credits ($0.05 total).

# COMMAND ----------
import sys, os, json
nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
repo_root = "/".join(nb_path.split("/")[:-3])  # strip /databricks/notebooks/<file>
if not repo_root.startswith("/Workspace/"):
    repo_root = "/Workspace" + repo_root   # Databricks FS is /Workspace/... under Files In Repos
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)
os.environ["OPENAI_API_KEY"] = dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")

results: list[tuple[str, bool, str]] = []
def T(name, ok, note=""):
    results.append((name, ok, note))
    marker = "✓" if ok else "✗"
    print(f"{marker} {name}  {note}")

# COMMAND ----------
# MAGIC %md ## T1 · Delta tables exist

# COMMAND ----------
tables = {r["tableName"] for r in spark.sql("SHOW TABLES IN billifm.eval").collect()}
for t in ["events_log", "personas", "stories"]:
    T(f"table billifm.eval.{t}", t in tables)

# COMMAND ----------
# MAGIC %md ## T2 · OpenAI reachable via secret

# COMMAND ----------
from eval.openai_client import chat_json
try:
    r = chat_json("Reply {\"ok\":true}. Nothing else.", model="gpt-4o-mini",
                  max_tokens=20, temperature=0)
    T("openai gpt-4o-mini reachable", r.get("ok") is True, str(r))
except Exception as e:
    T("openai gpt-4o-mini reachable", False, str(e))

# COMMAND ----------
# MAGIC %md ## T3 · Manual v0 directed_story validates

# COMMAND ----------
# director/ isn't a Python package (annotate.py relies on flat imports),
# so we load its files via importlib rather than adding it to sys.path.
import importlib.util
def _load(mod_name, file_rel):
    spec = importlib.util.spec_from_file_location(
        mod_name, f"{repo_root}/{file_rel}"
    )
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

dss = _load("directed_story_schema", "director/directed_story_schema.py")
v0 = json.load(open(f"{repo_root}/content/directed_story_v0.json"))
errs = dss.validate_directed_story(v0)
T("directed_story_v0.json validates", len(errs) == 0,
  f"segments={len(v0['segments'])} endings={len(v0['endings'])} errors={errs}")

# COMMAND ----------
# MAGIC %md ## T4 · Persona generator produces both cohorts

# COMMAND ----------
from eval.generate_personas import generate
ps = list(generate(20, seed=1))
cohorts = {p["cohort"] for p in ps}
T("persona generator, both cohorts present", len(cohorts) == 2, str(cohorts))

# COMMAND ----------
# MAGIC %md ## T5 · Sim traversal produces all Sutradhar events (5 personas)

# COMMAND ----------
from eval.schemas import Persona
from eval.sim import simulate

story = json.load(open(f"{repo_root}/content/directed_story_v0.json"))
personas = [Persona(**{k: v for k, v in p.items() if k != "cohort"})
            for p in generate(5, seed=2)]
cohort_hints = {p["persona_id"]: p["cohort"] for p in generate(5, seed=2)}

events = simulate(story, personas, model="gpt-4o-mini",
                  rollouts=1, cohort_hints=cohort_hints, verbose=False)
from collections import Counter
ec = Counter(e.event_type for e in events)
required = {"story_started", "segment_entered", "effect_fired",
            "sensory_reaction", "session_ended"}
missing = required - set(ec.keys())
T("sim emits all required event types", len(missing) == 0,
  f"events={len(events)} types={dict(ec)} missing={missing}")

# COMMAND ----------
# MAGIC %md ## T6 · Genome clustering produces k=2 profiles

# COMMAND ----------
from eval.genome import build_profiles
events_d = [e.model_dump() for e in events]
profiles, pmap = build_profiles(events_d, k=2, seed=0)
T("genome build_profiles → 2 profiles", len(profiles) == 2)
for p in profiles:
    T(f"  profile shape · {p['cohort']}",
      set(p.keys()) >= {"cohort", "attention_curve", "responds_to",
                        "numb_to", "cliffhanger_efficacy",
                        "decision_point_tolerance", "best_break_pattern"})

# COMMAND ----------
# MAGIC %md ## T7 · Director agent produces schema-valid output for one genome

# COMMAND ----------
dv2 = _load("director_v2", "director/director_v2.py")
try:
    script = open(f"{repo_root}/files/story.md").read()[:6000]  # slim for cost
    ds = dv2.direct(script, profiles[0], baseline=v0, model="gpt-4o-mini",
                    iteration=1)
    errs = dss.validate_directed_story(ds)
    T("director → schema-valid directed_story", len(errs) == 0,
      f"segments={len(ds.get('segments',[]))} errors={errs[:2]}")
except Exception as e:
    T("director → schema-valid directed_story", False, str(e)[:200])

# COMMAND ----------
# MAGIC %md ## Summary

# COMMAND ----------
n = len(results); passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{n} tests passed")
for name, ok, note in results:
    if not ok:
        print(f"  ✗ {name}  {note}")

summary = json.dumps({
    "passed": passed, "total": n,
    "failed": [{"name": name, "note": note}
               for name, ok, note in results if not ok],
    "results": [{"name": name, "ok": ok, "note": note}
                for name, ok, note in results],
})
# Emit via notebook.exit so the job API can read it, regardless of pass/fail
dbutils.notebook.exit(summary)
