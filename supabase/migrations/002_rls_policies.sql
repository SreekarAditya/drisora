ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE road_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own surveys" ON surveys FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own upload parts" ON upload_parts FOR ALL USING (
  survey_id IN (SELECT id FROM surveys WHERE user_id = auth.uid())
);

CREATE POLICY "own road sections" ON road_sections FOR ALL USING (
  survey_id IN (SELECT id FROM surveys WHERE user_id = auth.uid())
);

CREATE POLICY "own detections" ON detections FOR ALL USING (
  survey_id IN (SELECT id FROM surveys WHERE user_id = auth.uid())
);

CREATE POLICY "own jobs" ON jobs FOR ALL USING (
  survey_id IN (SELECT id FROM surveys WHERE user_id = auth.uid())
);
