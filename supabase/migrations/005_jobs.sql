-- Migrate the legacy survey-job table from 001_initial_schema.sql to the
-- current upload/job lifecycle expected by the app.

alter table jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists mode text,
  add column if not exists frame_count int,
  add column if not exists processed_count int not null default 0,
  add column if not exists gps_available boolean not null default false,
  add column if not exists r2_prefix text,
  add column if not exists average_pci real;

alter table jobs
  drop constraint if exists jobs_status_check,
  drop constraint if exists jobs_mode_check;

update jobs
set user_id = surveys.user_id
from surveys
where jobs.user_id is null
  and jobs.survey_id = surveys.id;

update jobs
set mode = 'drone_footage'
where mode is null;

update jobs
set status = case status
  when 'running_detection' then 'detecting'
  when 'generating_report' then 'scoring'
  else status
end
where status in ('running_detection', 'generating_report');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'total_frames'
  ) then
    execute 'update jobs set frame_count = coalesce(frame_count, total_frames, 0)';
  end if;
end $$;

update jobs
set frame_count = coalesce(frame_count, 0),
    processed_count = coalesce(processed_count, 0),
    status = coalesce(status, 'queued');

alter table jobs
  alter column user_id set not null,
  alter column mode set not null,
  alter column status set default 'queued',
  alter column status set not null,
  alter column frame_count set default 0,
  alter column frame_count set not null,
  alter column processed_count set default 0,
  alter column processed_count set not null;

alter table jobs
  add constraint jobs_mode_check
  check (mode in ('image_batch', 'handheld_video', 'drone_footage'));

alter table jobs
  add constraint jobs_status_check
  check (
    status in (
      'uploading',
      'queued',
      'extracting_frames',
      'detecting',
      'segmenting',
      'scoring',
      'complete',
      'failed'
    )
  );

alter table jobs enable row level security;

drop policy if exists "own jobs" on jobs;
drop policy if exists "users_select_own_jobs" on jobs;
drop policy if exists "users_update_own_jobs" on jobs;
drop policy if exists "users_insert_own_jobs" on jobs;

create policy "users_select_own_jobs"
  on jobs for select
  using (user_id = auth.uid());

create policy "users_update_own_jobs"
  on jobs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users_insert_own_jobs"
  on jobs for insert
  with check (user_id = auth.uid());
