-- ThaliFit sync schema: one generic table, protected by Row Level Security.
create table if not exists public.records (
  user_id    uuid   not null references auth.users(id) on delete cascade,
  entity     text   not null,
  id         text   not null,
  data       jsonb  not null,
  updated_at bigint not null,
  device_id  text   not null,
  deleted_at bigint,
  server_seq bigint not null default 0,
  primary key (user_id, entity, id)
);

create sequence if not exists public.records_seq;

-- Monotonic server sequence used as the pull cursor (immune to device clock skew).
create or replace function public.records_bump_seq() returns trigger language plpgsql as $$
begin
  new.server_seq := nextval('public.records_seq');
  return new;
end $$;

drop trigger if exists records_seq_trg on public.records;
create trigger records_seq_trg before insert or update on public.records
  for each row execute function public.records_bump_seq();

create index if not exists records_user_seq on public.records (user_id, server_seq);

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
