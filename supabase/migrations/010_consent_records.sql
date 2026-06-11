-- Consent audit trail for registration (ToS + Privacy + 18+ age gate + professional capacity).
-- One row per accepted document version per user, giving an immutable, queryable
-- record for compliance under the IT Act / SPDI Rules / DPDP Act and the GDPR.

create table if not exists consent_records (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  dob                      date not null,
  age_verified             boolean not null default false,
  professional_capacity    boolean not null default false,
  tos_version              text not null,
  tos_accepted_at          timestamptz not null default now(),
  pp_version               text not null,
  pp_accepted_at           timestamptz not null default now(),
  ip_at_registration       inet,
  training_opt_in          boolean not null default false,
  created_at               timestamptz not null default now()
);

create index if not exists idx_consent_records_user_id on consent_records (user_id);
create index if not exists idx_consent_records_versions on consent_records (tos_version, pp_version);

-- A user keeps a row per (tos_version, pp_version) acceptance event; new versions
-- append new rows so the full history is preserved.
create unique index if not exists uq_consent_user_versions
  on consent_records (user_id, tos_version, pp_version);

alter table consent_records enable row level security;

-- Users may read their own consent history.
drop policy if exists "users_select_own_consent" on consent_records;
create policy "users_select_own_consent"
  on consent_records for select
  using (auth.uid() = user_id);

-- Users may insert consent rows for themselves only.
drop policy if exists "users_insert_own_consent" on consent_records;
create policy "users_insert_own_consent"
  on consent_records for insert
  with check (auth.uid() = user_id);

-- Consent records are append-only: no update / delete by clients.
-- (Erasure requests are handled server-side via the service role.)
