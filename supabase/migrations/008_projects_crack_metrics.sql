-- Projects, soft-delete lifecycle, and crack-width engineering metrics.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  road_name text,
  package_code text,
  agency text,
  corridor text,
  location text,
  description text,
  start_chainage_km real,
  end_chainage_km real,
  combined_report_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table projects enable row level security;

create policy "users_select_own_projects"
  on projects for select
  using (user_id = auth.uid());

create policy "users_insert_own_projects"
  on projects for insert
  with check (user_id = auth.uid());

create policy "users_update_own_projects"
  on projects for update
  using (user_id = auth.uid());

create policy "users_delete_own_projects"
  on projects for delete
  using (user_id = auth.uid());

alter table jobs
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table surveys
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table profiles
  add column if not exists avatar_url text,
  add column if not exists notifications_enabled boolean not null default true;

alter table road_sections
  add column if not exists avg_crack_width_mm real,
  add column if not exists max_crack_width_mm real,
  add column if not exists crack_length_m_by_type jsonb not null default '{}'::jsonb,
  add column if not exists dominant_crack_type text,
  add column if not exists civil_severity text check (civil_severity in ('Low','Medium','High')),
  add column if not exists maintenance_priority text check (maintenance_priority in ('Immediate','Preventive','Routine')),
  add column if not exists possible_causes text[],
  add column if not exists recommended_mitigation text;

alter table detections
  add column if not exists avg_width_mm real,
  add column if not exists max_width_mm real,
  add column if not exists length_m real,
  add column if not exists density_pct real;

create index if not exists projects_user_id_created_at_idx
  on projects(user_id, created_at desc)
  where deleted_at is null;

create index if not exists jobs_project_id_created_at_idx
  on jobs(project_id, created_at desc)
  where deleted_at is null;

create index if not exists surveys_project_id_created_at_idx
  on surveys(project_id, created_at desc)
  where deleted_at is null;

create index if not exists road_sections_width_idx
  on road_sections(survey_id, max_crack_width_mm desc);
