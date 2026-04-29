-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveys
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  location TEXT,
  engineer_name TEXT,
  surveyed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('uploading','queued','processing','complete','failed')) DEFAULT 'uploading',
  r2_key TEXT,
  r2_upload_id TEXT,
  srt_path TEXT,
  report_path TEXT,
  total_length_m FLOAT,
  average_pci FLOAT,
  coverage_area_m2 FLOAT
);

-- Upload parts (resumable upload tracking)
CREATE TABLE upload_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_id, part_number)
);

-- Road sections (~10m segments)
CREATE TABLE road_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  section_index INTEGER,
  geom GEOMETRY(LINESTRING, 4326),
  pci_score FLOAT,
  condition_category TEXT CHECK (condition_category IN ('good','satisfactory','fair','poor','very_poor')),
  recommended_intervention TEXT,
  priority_rank INTEGER,
  length_m FLOAT
);

-- Detections (one per crack)
CREATE TABLE detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  section_id UUID REFERENCES road_sections(id),
  frame_index INTEGER,
  crack_type TEXT,
  severity TEXT CHECK (severity IN ('low','medium','high')),
  bbox JSONB,
  mask_rle JSONB,
  depth_m FLOAT,
  confidence FLOAT,
  location GEOMETRY(POINT, 4326),
  gsd_cm_per_px FLOAT
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('queued','extracting_frames','running_detection','scoring','generating_report','complete','failed')) DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  current_frame INTEGER DEFAULT 0,
  total_frames INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
