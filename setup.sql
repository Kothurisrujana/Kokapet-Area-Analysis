-- Run once: Supabase dashboard → SQL Editor → New query → paste all → Run.

create table if not exists public.properties (
  id         text primary key,          -- fingerprint of the row (dedup key)
  area_id    text not null,
  data       jsonb not null,            -- all property fields + distances
  updated_at timestamptz default now()
);
create index if not exists properties_area_idx on public.properties (area_id);

create table if not exists public.places (
  id         text primary key,          -- distance column name
  data       jsonb not null,            -- name, category, lat, lng
  updated_at timestamptz default now()
);

create table if not exists public.areas (
  id         text primary key,
  name       text not null,
  last_file  text,
  updated_at timestamptz default now()
);

-- Security: no sign-in. Anyone can read, add, change and delete data.
alter table public.properties enable row level security;
alter table public.places     enable row level security;
alter table public.areas      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['properties','places','areas'] loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('drop policy if exists "public write" on public.%I', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
    execute format('create policy "public write" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

drop function if exists public.is_admin();

-- Handy SQL once data is in, e.g. median ₹/sqft per area:
-- select area_id, count(*), percentile_cont(0.5) within group (order by (data->>'psf')::numeric)
-- from properties group by area_id;
