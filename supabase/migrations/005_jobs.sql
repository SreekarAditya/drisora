create table if not exists jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  mode           text not null check (mode in ('image_batch', 'handheld_video', 'drone_footage')),
  status         text not null default 'queued' check (
                   status in ('queued', 'extracting_frames', 'detecting',
                              'segmenting', 'scoring', 'complete', 'failed')
                 ),
  frame_count    int,
  gps_available  boolean not null default false,
  r2_prefix      text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  error_message  text
);

alter table jobs enable row level security;

create policy "users_select_own_jobs"
  on jobs for select
  using (user_id = auth.uid());

create policy "users_update_own_jobs"
  on jobs for update
  using (user_id = auth.uid());

create policy "users_insert_own_jobs"
  on jobs for insert
  with check (user_id = auth.uid());
