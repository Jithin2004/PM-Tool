-- 1. Trigger to automatically roll up Task PERT metrics to the parent Project
CREATE OR REPLACE FUNCTION trigger_update_project_pert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proj_id UUID;
  v_total_expected NUMERIC := 0;
  v_total_variance NUMERIC := 0;
  v_new_best NUMERIC;
  v_new_likely NUMERIC;
  v_new_worst NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_proj_id := OLD.project_id;
  ELSE
    v_proj_id := NEW.project_id;
  END IF;
  
  -- Aggregate active PERT tasks
  SELECT 
    COALESCE(SUM((pert_best + 4 * pert_likely + pert_worst) / 6.0), 0),
    COALESCE(SUM(POWER((pert_worst - pert_best) / 6.0, 2)), 0)
  INTO v_total_expected, v_total_variance
  FROM tasks
  WHERE project_id = v_proj_id 
    AND pert_best > 0 
    AND pert_likely > 0 
    AND pert_worst > 0;
    
  v_new_best := GREATEST(0, v_total_expected - (2 * SQRT(v_total_variance)));
  v_new_likely := v_total_expected;
  v_new_worst := v_total_expected + (2 * SQRT(v_total_variance));
  
  UPDATE projects
  SET 
    pert_best = ROUND(v_new_best, 1),
    pert_likely = ROUND(v_new_likely, 1),
    pert_worst = ROUND(v_new_worst, 1)
  WHERE id = v_proj_id;
  
  -- Handle project reassignment
  IF TG_OP = 'UPDATE' AND OLD.project_id != NEW.project_id THEN
    SELECT 
      COALESCE(SUM((pert_best + 4 * pert_likely + pert_worst) / 6.0), 0),
      COALESCE(SUM(POWER((pert_worst - pert_best) / 6.0, 2)), 0)
    INTO v_total_expected, v_total_variance
    FROM tasks
    WHERE project_id = OLD.project_id 
      AND pert_best > 0 
      AND pert_likely > 0 
      AND pert_worst > 0;
      
    v_new_best := GREATEST(0, v_total_expected - (2 * SQRT(v_total_variance)));
    v_new_likely := v_total_expected;
    v_new_worst := v_total_expected + (2 * SQRT(v_total_variance));
    
    UPDATE projects
    SET 
      pert_best = ROUND(v_new_best, 1),
      pert_likely = ROUND(v_new_likely, 1),
      pert_worst = ROUND(v_new_worst, 1)
    WHERE id = OLD.project_id;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_pert_trigger ON tasks;
CREATE TRIGGER tasks_pert_trigger
AFTER INSERT OR UPDATE OF pert_best, pert_likely, pert_worst, project_id, status OR DELETE
ON tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_update_project_pert();

-- 2. RPC to compute mathematically valid global intelligence metrics
CREATE OR REPLACE FUNCTION get_operational_intelligence(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery_confidence NUMERIC;
  v_execution_pressure NUMERIC;
  v_daily_fatigue NUMERIC;
  v_risk_forecast NUMERIC;
  v_total_decay_hours NUMERIC := 0;
  v_pressure_score NUMERIC := 0;
  
  v_active_project RECORD;
  v_expected NUMERIC;
  v_spread NUMERIC;
  
  v_active_tasks INT;
  v_blocked_tasks INT;
  
  v_confidence_risk NUMERIC;
  v_fatigue_risk NUMERIC;
BEGIN
  -- 1. Delivery Confidence & Daily Fatigue across active projects
  FOR v_active_project IN
    SELECT * FROM projects
    WHERE workspace_id = p_workspace_id 
      AND status NOT IN ('deployed', 'done', 'archived')
  LOOP
    v_expected := (v_active_project.pert_best + 4 * v_active_project.pert_likely + v_active_project.pert_worst) / 6.0;
    
    IF v_active_project.pert_worst > v_expected THEN
      v_total_decay_hours := v_total_decay_hours + (v_active_project.pert_worst - v_expected);
    END IF;
    
    v_spread := GREATEST(0, v_active_project.pert_worst - v_active_project.pert_best);
    IF v_spread > 0 AND v_expected > 0 THEN
      v_pressure_score := v_pressure_score + ((v_spread / GREATEST(v_expected, 1.0)) * 10);
    END IF;
  END LOOP;
  
  v_delivery_confidence := GREATEST(0, 100 - (v_total_decay_hours * 0.5));
  v_daily_fatigue := v_total_decay_hours;
  
  -- 2. Execution Pressure (Uses GLOBAL tasks count, bypassing frontend pagination limitations)
  SELECT 
    COUNT(*) FILTER (WHERE status = 'blocked' OR status = 'triage'),
    COUNT(*) FILTER (WHERE status != 'done')
  INTO v_blocked_tasks, v_active_tasks
  FROM tasks
  WHERE workspace_id = p_workspace_id;
  
  IF v_active_tasks > 0 THEN
    v_pressure_score := v_pressure_score + ((v_blocked_tasks::NUMERIC / v_active_tasks::NUMERIC) * 40);
  END IF;
  
  v_execution_pressure := LEAST(100, v_pressure_score);
  
  -- 3. Risk Forecast
  v_confidence_risk := 100 - v_delivery_confidence;
  v_fatigue_risk := LEAST(100, v_daily_fatigue * 2);
  v_risk_forecast := LEAST(100, (v_confidence_risk * 0.45) + (v_execution_pressure * 0.35) + (v_fatigue_risk * 0.2));
  
  RETURN jsonb_build_object(
    'deliveryConfidence', ROUND(v_delivery_confidence, 1),
    'executionPressure', ROUND(v_execution_pressure, 1),
    'dailyFatigue', ROUND(v_daily_fatigue, 1),
    'riskForecast', ROUND(v_risk_forecast, 1)
  );
END;
$$;
