-- Partial IRC:82-2023 output contract. Legacy average_pci is retained only so
-- historical rows remain readable; current jobs write bounds and leave it NULL.
alter table public.jobs
  add column if not exists pci_lower double precision check (pci_lower between 0 and 100),
  add column if not exists pci_upper double precision check (pci_upper between 0 and 100),
  add column if not exists pci_complete double precision check (pci_complete between 0 and 100),
  add column if not exists partial_pci_sections_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_pci_bounds_ordered'
  ) then
    alter table public.jobs
      add constraint jobs_pci_bounds_ordered
      check (
        (pci_lower is null and pci_upper is null)
        or (pci_lower is not null and pci_upper is not null and pci_lower <= pci_upper)
      );
  end if;
end $$;

comment on column public.jobs.pci_lower is 'Lower bound of partial IRC:82-2023 PCI; NULL when no calibrated section assessment exists.';
comment on column public.jobs.pci_upper is 'Upper bound of partial IRC:82-2023 PCI; NULL when no calibrated section assessment exists.';
comment on column public.jobs.pci_complete is 'Point PCI only when all six IRC functional inputs are measured; current imagery-only workflow writes NULL.';
