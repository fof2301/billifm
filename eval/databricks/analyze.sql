-- Billifm eval — analysis queries.
--
-- All queries run against billifm.eval.events_log and can be filtered
-- by source='sim' (persona simulations) or source='prod' (real users).
-- Because the schema is shared, the same SQL works for both.

-- ============================================================
-- 1. Retention curve — fraction of runs that reached each node
-- ============================================================
WITH runs AS (
  SELECT COUNT(DISTINCT run_id) AS n
  FROM billifm.eval.events_log
  WHERE story_id = :story_id AND source = :source
),
hits AS (
  SELECT node_id, COUNT(DISTINCT run_id) AS reached
  FROM billifm.eval.events_log
  WHERE story_id = :story_id
    AND source = :source
    AND event_type = 'node_entered'
  GROUP BY node_id
)
SELECT h.node_id,
       h.reached,
       ROUND(h.reached * 1.0 / r.n, 3) AS retention
FROM hits h CROSS JOIN runs r
ORDER BY retention DESC;

-- ============================================================
-- 2. Completion rate
-- ============================================================
SELECT
  COUNT(*)                                                      AS total_runs,
  SUM(CASE WHEN get_json_object(payload,'$.reason')='complete'
           THEN 1 ELSE 0 END)                                   AS completed,
  ROUND(
    SUM(CASE WHEN get_json_object(payload,'$.reason')='complete'
             THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 3)            AS completion_rate
FROM billifm.eval.events_log
WHERE story_id = :story_id
  AND source = :source
  AND event_type = 'session_ended';

-- ============================================================
-- 3. Drop-off hotspots
-- ============================================================
SELECT node_id,
       COUNT(*) AS dropoffs,
       AVG(CAST(get_json_object(payload,'$.engagement') AS DOUBLE)) AS avg_engagement
FROM billifm.eval.events_log
WHERE story_id = :story_id
  AND source = :source
  AND event_type = 'session_ended'
  AND get_json_object(payload,'$.reason') = 'dropoff'
GROUP BY node_id
ORDER BY dropoffs DESC;

-- ============================================================
-- 4. Choice distribution per decision node
-- ============================================================
SELECT node_id,
       get_json_object(payload,'$.choice_id') AS choice_id,
       COUNT(*)                               AS times_chosen
FROM billifm.eval.events_log
WHERE story_id = :story_id
  AND source = :source
  AND event_type = 'decision_made'
GROUP BY node_id, get_json_object(payload,'$.choice_id')
ORDER BY node_id, times_chosen DESC;

-- ============================================================
-- 5. Callback label distribution
-- ============================================================
SELECT node_id,
       get_json_object(payload,'$.classified_label') AS label,
       COUNT(*)                                       AS n
FROM billifm.eval.events_log
WHERE story_id = :story_id
  AND source = :source
  AND event_type = 'callback_answered'
GROUP BY node_id, get_json_object(payload,'$.classified_label')
ORDER BY node_id, n DESC;

-- ============================================================
-- 6. Trait fit by drop-off — who's bouncing where
-- ============================================================
SELECT e.node_id,
       COUNT(*) AS n,
       ROUND(AVG(p.big5_o), 2) AS avg_o,
       ROUND(AVG(p.big5_c), 2) AS avg_c,
       ROUND(AVG(p.big5_e), 2) AS avg_e,
       ROUND(AVG(p.big5_a), 2) AS avg_a,
       ROUND(AVG(p.big5_n), 2) AS avg_neu,
       flatten(collect_list(p.nature_tags)) AS all_nature_tags
FROM billifm.eval.events_log e
JOIN billifm.eval.personas p ON e.user_id = p.persona_id
WHERE e.story_id = :story_id
  AND e.source = :source
  AND e.event_type = 'session_ended'
  AND get_json_object(e.payload,'$.reason') = 'dropoff'
GROUP BY e.node_id
ORDER BY n DESC;

-- ============================================================
-- 7. Genome delta — declared vs. actual audience
-- Compares the target_traits the writer declared for a story with
-- the average traits of personas who actually completed it.
-- ============================================================
WITH completers AS (
  SELECT DISTINCT run_id, user_id
  FROM billifm.eval.events_log
  WHERE story_id = :story_id
    AND source = :source
    AND event_type = 'session_ended'
    AND get_json_object(payload,'$.reason') = 'complete'
)
SELECT
  s.story_id, s.title,
  get_json_object(s.genome, '$.target_traits') AS declared_target_traits,
  ROUND(AVG(p.big5_o), 2) AS actual_avg_o,
  ROUND(AVG(p.big5_c), 2) AS actual_avg_c,
  ROUND(AVG(p.big5_e), 2) AS actual_avg_e,
  ROUND(AVG(p.big5_a), 2) AS actual_avg_a,
  ROUND(AVG(p.big5_n), 2) AS actual_avg_neu,
  COUNT(DISTINCT c.user_id) AS n_completers
FROM completers c
JOIN billifm.eval.personas p ON c.user_id = p.persona_id
JOIN billifm.eval.stories  s ON s.story_id = :story_id
GROUP BY s.story_id, s.title, s.genome;
