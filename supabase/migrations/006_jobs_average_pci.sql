alter table jobs
  add column if not exists average_pci   real,
  add column if not exists processed_count int not null default 0;
