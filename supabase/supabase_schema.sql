-- ============================================================================
-- NYSC Survival: database setup for REAL-TIME CHAT and BATCHES (Supabase)
-- Run this ONCE: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again (it uses "if not exists" / "or replace").
-- Before running, enable: Authentication -> Providers -> Anonymous Sign-Ins.
-- ============================================================================

-- ---- tables ---------------------------------------------------------------
create table if not exists public.batches (
  id         int generated always as identity primary key,
  seats      int not null default 0,
  cap        int not null default 40,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  uid        uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) <= 18),
  skin       int  not null default 0,
  batch_id   int  not null references public.batches(id),
  seat       int  not null,
  lga_i      int  not null,   -- index into the game's LGA list (0..7)
  ppa_i      int  not null,   -- index into the game's PPA list (0..11)
  created_at timestamptz not null default now()
);
create index if not exists players_batch_idx on public.players (batch_id, lga_i, ppa_i);

create table if not exists public.messages (
  id      bigint generated always as identity primary key,
  channel text   not null check (char_length(channel) between 1 and 90),
  ts      bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  uid     uuid   not null default auth.uid(),
  n       text   not null check (char_length(n) between 1 and 18),
  sk      int    not null default 0,
  tx      text   not null check (char_length(tx) between 1 and 240)
);
create index if not exists messages_channel_ts_idx on public.messages (channel, ts desc);

-- ---- server-side rules for every new message --------------------------------
-- The server (not the browser) decides who sent it and when. One message per
-- ~1 second per person (chat channels). Inbox pings are not rate limited.
create or replace function public.messages_before_insert() returns trigger
language plpgsql as $$
begin
  new.uid := auth.uid();
  new.ts  := (extract(epoch from now()) * 1000)::bigint;
  new.tx  := btrim(new.tx);
  if new.uid is null then raise exception 'not signed in'; end if;
  if new.channel not like 'inbox-%' and exists (
       select 1 from public.messages m
       where m.uid = new.uid and m.channel not like 'inbox-%' and m.ts > new.ts - 900) then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ---- who may do what (Row Level Security) -----------------------------------
alter table public.batches  enable row level security;
alter table public.players  enable row level security;
alter table public.messages enable row level security;
-- batches and players have NO direct policies: the browser can only use the two
-- functions below. Messages:
drop policy if exists messages_read   on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
-- Public channels (camp hall, LGA, PPA) are readable by everyone signed in.
-- Private DMs (dm-a--b) and inboxes (inbox-<uid>) only by people whose id is in the name.
create policy messages_read on public.messages for select to authenticated using (
  (channel not like 'dm-%' and channel not like 'inbox-%') or position(auth.uid()::text in channel) > 0);
create policy messages_insert on public.messages for insert to authenticated with check (
  uid = auth.uid() and (channel not like 'dm-%' or position(auth.uid()::text in channel) > 0));
-- You can delete your own messages; anyone can clean messages older than 48 hours.
create policy messages_delete on public.messages for delete to authenticated using (
  uid = auth.uid() or ts < ((extract(epoch from now()) * 1000)::bigint - 172800000));

-- ---- batches: put players into the same LGA / PPA -----------------------------
-- Seats are handed out in order. Every 5 players share an LGA; inside an LGA the
-- first 3 share one PPA and the next 2 share another. So 10 players = 2 LGAs of 5,
-- each split 3 + 2 (the example from the game design).
create or replace function public.join_batch(p_name text, p_skin int, p_fresh boolean default false)
returns table (o_batch int, o_seat int, o_lga int, o_ppa int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  b public.batches%rowtype;
  s int; slot int; grp int; ppa int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not p_fresh then
    return query select pl.batch_id, pl.seat, pl.lga_i, pl.ppa_i from public.players pl where pl.uid = v_uid;
    if found then return; end if;
  end if;
  select * into b from public.batches where seats < cap order by id limit 1 for update skip locked;
  if not found then insert into public.batches default values returning * into b; end if;
  s := b.seats;
  update public.batches set seats = seats + 1 where id = b.id;
  slot := (s / 5) % 8;           -- which LGA (0..7)
  grp  := (s % 5) / 3;           -- 0 for the first three, 1 for the other two
  ppa  := (slot * 2 + grp) % 12; -- which PPA (0..11)
  insert into public.players (uid, name, skin, batch_id, seat, lga_i, ppa_i)
  values (v_uid, left(coalesce(nullif(btrim(p_name), ''), 'Corper'), 18), coalesce(p_skin, 0), b.id, s, slot, ppa)
  on conflict (uid) do update set name = excluded.name, skin = excluded.skin, batch_id = excluded.batch_id,
     seat = excluded.seat, lga_i = excluded.lga_i, ppa_i = excluded.ppa_i, created_at = now();
  return query select b.id, s, slot, ppa;
end $$;

-- Who else is in my LGA (same PPA first)?
create or replace function public.get_mates()
returns table (o_uid uuid, o_name text, o_skin int, o_lga int, o_ppa int, o_same_ppa boolean)
language sql security definer set search_path = public stable as $$
  select p.uid, p.name, p.skin, p.lga_i, p.ppa_i, (p.ppa_i = me.ppa_i)
  from public.players p
  join public.players me on me.uid = auth.uid()
  where p.batch_id = me.batch_id and p.lga_i = me.lga_i and p.uid <> me.uid
  order by (p.ppa_i = me.ppa_i) desc, p.seat
  limit 20;
$$;

revoke all on function public.join_batch(text, int, boolean) from public, anon;
revoke all on function public.get_mates() from public, anon;
grant execute on function public.join_batch(text, int, boolean) to authenticated;
grant execute on function public.get_mates() to authenticated;

-- ---- live updates -----------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---- optional housekeeping --------------------------------------------------
create or replace function public.prune_messages() returns void
language sql security definer set search_path = public as $$
  delete from public.messages where ts < ((extract(epoch from now()) * 1000)::bigint - 172800000);
$$;
revoke all on function public.prune_messages() from public, anon, authenticated;

-- ---- keep-alive (stops the free project from pausing) -----------------------
-- /api/keepalive (Vercel Cron, daily) reads this one-row table.
create table if not exists public.keepalive (id int primary key default 1, note text default 'NYSC Survival keep-alive');
insert into public.keepalive (id) values (1) on conflict (id) do nothing;
alter table public.keepalive enable row level security;
drop policy if exists "keepalive readable" on public.keepalive;
create policy "keepalive readable" on public.keepalive for select to anon, authenticated using (true);

-- ============================================================================
-- PLAYER STATS for the 3D game (how many players, who is online, per state)
-- Stores no names or personal data: a random device id, the state/LGA/area you are in, and timestamps.
-- ============================================================================
create table if not exists public.player_pings (
  uid        text primary key check (char_length(uid) between 6 and 40),
  state      text not null default 'LA' check (char_length(state) <= 4),
  lga        text not null default '' check (char_length(lga) <= 60),
  area       text not null default '' check (char_length(area) <= 12),
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  sessions   int not null default 1,
  minutes    int not null default 0
);
create index if not exists player_pings_seen_idx on public.player_pings (last_seen desc);
create index if not exists player_pings_state_idx on public.player_pings (state);
alter table public.player_pings enable row level security;   -- no direct access; only the functions below

-- the game calls this about once a minute while you play
create or replace function public.track_player(p_uid text, p_state text, p_lga text default '', p_area text default '', p_new_session boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_uid is null or char_length(p_uid) < 6 or char_length(p_uid) > 40 then return; end if;
  insert into player_pings (uid, state, lga, area) values (p_uid, left(coalesce(p_state,'LA'),4), left(coalesce(p_lga,''),60), left(coalesce(p_area,''),12))
  on conflict (uid) do update set
    state = excluded.state, lga = excluded.lga, area = excluded.area,
    sessions = player_pings.sessions + case when p_new_session then 1 else 0 end,
    minutes = player_pings.minutes + case when now() - player_pings.last_seen < interval '3 minutes' then greatest(1, extract(epoch from now() - player_pings.last_seen)::int / 60) else 0 end,
    last_seen = now();
end $$;

-- what players see: totals, online now, and your state
create or replace function public.public_stats(p_state text default null)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'players', (select count(*) from player_pings),
    'online', (select count(*) from player_pings where last_seen > now() - interval '3 minutes'),
    'state_players', (select count(*) from player_pings where state = p_state),
    'state_online', (select count(*) from player_pings where state = p_state and last_seen > now() - interval '3 minutes'));
$$;

-- the admin page: needs the key you set below
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;     -- nobody can read it directly
-- SET YOUR ADMIN KEY (change the text, then run this line):
-- insert into public.app_secrets (name, value) values ('admin_key', 'change-me-to-a-long-secret') on conflict (name) do update set value = excluded.value;

create or replace function public.admin_stats(p_key text)
returns json language plpgsql security definer set search_path = public stable as $$
declare ok boolean;
begin
  select exists(select 1 from app_secrets where name = 'admin_key' and value = p_key and char_length(value) >= 12) into ok;
  if not ok then raise exception 'not allowed'; end if;
  return json_build_object(
    'players', (select count(*) from player_pings),
    'online', (select count(*) from player_pings where last_seen > now() - interval '3 minutes'),
    'today', (select count(*) from player_pings where last_seen > now() - interval '24 hours'),
    'week', (select count(*) from player_pings where last_seen > now() - interval '7 days'),
    'new_today', (select count(*) from player_pings where first_seen > now() - interval '24 hours'),
    'minutes', (select coalesce(sum(minutes),0) from player_pings),
    'sessions', (select coalesce(sum(sessions),0) from player_pings),
    'by_state', (select coalesce(json_agg(r order by r.players desc), '[]') from (
        select state, count(*) players, count(*) filter (where last_seen > now() - interval '3 minutes') online,
               count(*) filter (where last_seen > now() - interval '24 hours') today from player_pings group by state) r),
    'top_lgas', (select coalesce(json_agg(r order by r.players desc), '[]') from (
        select state, lga, count(*) players, count(*) filter (where last_seen > now() - interval '3 minutes') online from player_pings where lga <> '' group by state, lga order by count(*) desc limit 25) r),
    'daily', (select coalesce(json_agg(r order by r.day), '[]') from (
        select date_trunc('day', first_seen)::date as day, count(*) as new_players from player_pings where first_seen > now() - interval '30 days' group by 1) r));
end $$;

grant execute on function public.track_player(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.public_stats(text) to anon, authenticated;
grant execute on function public.admin_stats(text) to anon, authenticated;
