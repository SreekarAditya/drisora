-- Multi-video survey support: per-video tracking, processed zones, and PCI segments.

create table if not exists survey_videos (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references surveys(id) on delete cascade,
  video_filename text not null,
  srt_filename text,
  storage_path text not null,
  flight_bounds jsonb,
  frame_count int,
  processed_frame_count int,
  skipped_frame_count int,
  status text default 'pending' check (status in ('pending','processing','done','error')),
  created_at timestamptz default now()
);

alter table survey_videos enable row level security;

create policy "users_select_own_survey_videos"
  on survey_videos for select
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_insert_own_survey_videos"
  on survey_videos for insert
  with check (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_update_own_survey_videos"
  on survey_videos for update
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_delete_own_survey_videos"
  on survey_videos for delete
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

alter table detections
  add column if not exists source_video_id uuid references survey_videos(id);

create table if not exists processed_zones (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references surveys(id) on delete cascade,
  source_video_id uuid references survey_videos(id) on delete cascade,
  lat float not null,
  lon float not null,
  altitude float,
  footprint_radius_m float,
  frame_index int,
  created_at timestamptz default now()
);

alter table processed_zones enable row level security;

create policy "users_select_own_processed_zones"
  on processed_zones for select
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_insert_own_processed_zones"
  on processed_zones for insert
  with check (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_update_own_processed_zones"
  on processed_zones for update
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_delete_own_processed_zones"
  on processed_zones for delete
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create table if not exists pci_segments (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references surveys(id) on delete cascade,
  segment_index int not null,
  start_distance_m float not null,
  end_distance_m float not null,
  total_length_m float not null,
  pci_score float,
  pci_grade text,
  is_relative boolean default false,
  detection_count int default 0,
  deduct_values jsonb,
  source_video_ids jsonb,
  created_at timestamptz default now()
);

alter table pci_segments enable row level security;

create policy "users_select_own_pci_segments"
  on pci_segments for select
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_insert_own_pci_segments"
  on pci_segments for insert
  with check (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_update_own_pci_segments"
  on pci_segments for update
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create policy "users_delete_own_pci_segments"
  on pci_segments for delete
  using (
    survey_id in (
      select id from surveys where user_id = auth.uid()
    )
  );

create index if not exists survey_videos_survey_id_idx
  on survey_videos(survey_id);

create index if not exists processed_zones_survey_id_idx
  on processed_zones(survey_id);

create index if not exists processed_zones_survey_id_lat_lon_idx
  on processed_zones(survey_id, lat, lon);

create index if not exists pci_segments_survey_id_segment_index_idx
  on pci_segments(survey_id, segment_index);
