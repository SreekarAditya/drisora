CREATE INDEX idx_road_sections_geom ON road_sections USING GIST (geom);
CREATE INDEX idx_detections_location ON detections USING GIST (location);
