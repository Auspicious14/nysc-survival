-- ============================================================================
-- KOPA LIFE: Supabase schema (run the whole file in the SQL Editor on a fresh project; safe to re-run)
-- Stores no names: random device ids, the state/LGA you play in, timestamps, survey answers, player reports.
-- The website only reaches the data through the functions below; every table has RLS on and no policies.
-- ============================================================================
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

-- what players see: totals, online now, and your state
create or replace function public.public_stats(p_state text default null)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'players', (select count(*) from player_pings),
    'online', (select count(*) from player_pings where last_seen > now() - interval '3 minutes'),
    'state_players', (select count(*) from player_pings where state = p_state),
    'state_online', (select count(*) from player_pings where state = p_state and last_seen > now() - interval '3 minutes'));
$$;

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;     -- nobody can read it directly
-- SET YOUR ADMIN KEY (at least 12 characters; stored hashed):
-- insert into public.app_secrets (name, value) values ('admin_key', extensions.crypt('change-me-to-a-long-secret', extensions.gen_salt('bf', 10))) on conflict (name) do update set value = excluded.value;

create table if not exists public.survey_answers (
  uid        text primary key check (char_length(uid) between 6 and 40),
  state      text not null default '' check (char_length(state) <= 4),
  lga        text not null default '' check (char_length(lga) <= 60),
  again      text not null default '' check (char_length(again) <= 300),
  wants      text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.survey_answers enable row level security;   -- no direct access; only the functions below


-- ============================================================================
-- KOPA LIFE SECURITY UPDATE (November 2026). Run once in the Supabase SQL Editor. Safe to run again.
-- Fixes from the security review: retire the classic game's tables, per-IP rate limits on the public
-- functions, strict input checks, hashed admin key with lockout, player reports, test-data cleanup.
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;

-- 1) The classic game is retired (anonymous sign-ins are off): remove its tables and functions.
drop function if exists public.join_batch(text, int, boolean);
drop function if exists public.get_mates();
drop table if exists public.messages cascade;
drop table if exists public.players cascade;
drop table if exists public.batches cascade;
drop function if exists public.messages_before_insert();

-- 2) Helpers (not callable from the website)
-- the caller's IP as seen by Supabase's edge (Cloudflare sets cf-connecting-ip; clients cannot fake it through the edge)
create or replace function public.client_ip() returns text language sql stable as $$
  with h as (select nullif(current_setting('request.headers', true), '')::json j)
  select coalesce(nullif(j->>'cf-connecting-ip', ''), nullif(j->>'x-real-ip', ''),
                  nullif(btrim(split_part(coalesce(j->>'x-forwarded-for', ''), ',', 1)), ''), '') from h;
$$;

create table if not exists public.rate_hits (
  ip text not null, fn text not null, win timestamptz not null, n int not null default 0,
  primary key (ip, fn, win));
alter table public.rate_hits enable row level security;

-- true while this network (IP) is under p_max calls of p_fn in the current window
create or replace function public.rate_ok(p_fn text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ip text := public.client_ip(); v_secs double precision := extract(epoch from p_window); v_win timestamptz; v_n int;
begin
  if v_ip = '' then return true; end if;
  v_win := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);
  insert into rate_hits as h (ip, fn, win, n) values (v_ip, p_fn, v_win, 1)
  on conflict (ip, fn, win) do update set n = h.n + 1 returning n into v_n;
  if random() < 0.01 then delete from rate_hits where win < now() - interval '2 days'; end if;
  return v_n <= p_max;
end $$;

create or replace function public.valid_states() returns text[] language sql immutable as $$
  select array['AB','AD','AK','AN','BA','BY','BE','BO','CR','DT','EB','ED','EK','EN','FC','GB','IM','JG','KD','KN','KT','KB','KG','KW','LA','NR','NG','OG','OD','OS','OY','PL','RV','SO','TR','YB','ZA'];
$$;
create or replace function public.clean_text(t text, n int) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(t, ''), '[<>"`\\[:cntrl:]]', '', 'g')), n);
$$;

-- 3) Player counts: real-looking ids only, known states only, limited per network
create or replace function public.track_player(p_uid text, p_state text, p_lga text default '', p_area text default '', p_new_session boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_new boolean;
begin
  if p_uid is null or p_uid !~ '^p[a-z0-9]{10,30}$' then return; end if;
  if p_state is null or not (p_state = any(public.valid_states())) then return; end if;
  if coalesce(p_area, '') !~ '^[a-z]{0,12}$' then p_area := ''; end if;
  v_new := not exists (select 1 from player_pings where uid = p_uid);
  if v_new and not public.rate_ok('new_player', 30, interval '1 hour') then return; end if;
  if not public.rate_ok('ping', 600, interval '10 minutes') then return; end if;
  insert into player_pings (uid, state, lga, area) values (p_uid, p_state, public.clean_text(p_lga, 60), coalesce(p_area, ''))
  on conflict (uid) do update set
    state = excluded.state, lga = excluded.lga, area = excluded.area,
    sessions = player_pings.sessions + case when p_new_session then 1 else 0 end,
    minutes = player_pings.minutes + case when now() - player_pings.last_seen < interval '3 minutes' then greatest(1, extract(epoch from now() - player_pings.last_seen)::int / 60) else 0 end,
    last_seen = now();
  if random() < 0.001 then delete from player_pings where last_seen < now() - interval '12 months'; end if; -- retention: 12 months
end $$;

-- 4) Survey: one answer per device (replaces), limited per network
create or replace function public.submit_survey(p_uid text, p_state text, p_lga text, p_again text, p_wants text[])
returns void language plpgsql security definer set search_path = public as $$
declare allowed text[] := array['cds','friends','leaderboards','minigames','meetups'];
begin
  if p_uid is null or p_uid !~ '^p[a-z0-9]{10,30}$' then return; end if;
  if not public.rate_ok('survey', 20, interval '1 hour') then return; end if;
  insert into survey_answers (uid, state, lga, again, wants)
  values (p_uid, case when p_state = any(public.valid_states()) then p_state else '' end, public.clean_text(p_lga, 60), public.clean_text(p_again, 300),
          array(select distinct w from unnest(coalesce(p_wants, '{}')) w where w = any(allowed) limit 5))
  on conflict (uid) do update set state = excluded.state, lga = excluded.lga, again = excluded.again, wants = excluded.wants, created_at = now();
end $$;

-- 5) Player reports from the in-game 🚩 Report button
create table if not exists public.player_reports (
  id bigint generated always as identity primary key,
  reporter text not null, target text not null, name text not null default '', msg text not null default '', room text not null default '',
  created_at timestamptz not null default now());
alter table public.player_reports enable row level security;
create or replace function public.report_player(p_uid text, p_target text, p_name text, p_text text, p_room text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_uid is null or p_uid !~ '^p[a-z0-9]{10,30}$' or p_target is null or p_target !~ '^[a-z0-9]{6,40}$' then return; end if;
  if not public.rate_ok('report', 15, interval '1 hour') then return; end if;
  insert into player_reports (reporter, target, name, msg, room) values (p_uid, p_target, public.clean_text(p_name, 24), public.clean_text(p_text, 200), public.clean_text(p_room, 80));
  delete from player_reports where created_at < now() - interval '6 months';
end $$;

-- 6) Admin: the key is stored hashed (bcrypt); 8 wrong keys from one network locks it out for 15 minutes.
--    Wrong keys return {"error": ...} instead of failing, so the failed attempt is recorded.
create table if not exists public.admin_fails (ip text not null, at timestamptz not null default now());
alter table public.admin_fails enable row level security;
update public.app_secrets set value = extensions.crypt(value, extensions.gen_salt('bf', 10))
  where name = 'admin_key' and value !~ '^\$2[aby]\$';

create or replace function public.admin_ok(p_key text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_ip text := public.client_ip(); v_hash text;
begin
  if (select count(*) from admin_fails where ip = v_ip and at > now() - interval '15 minutes') >= 8 then return 'locked'; end if;
  select value into v_hash from app_secrets where name = 'admin_key';
  if v_hash ~ '^\$2[aby]\$' and p_key is not null and char_length(p_key) between 12 and 200 and extensions.crypt(p_key, v_hash) = v_hash then return 'ok'; end if;
  insert into admin_fails (ip) values (v_ip);
  delete from admin_fails where at < now() - interval '1 day';
  return 'denied';
end $$;

drop function if exists public.admin_stats(text);
create or replace function public.admin_stats(p_key text)
returns json language plpgsql security definer set search_path = public as $$
declare v text := public.admin_ok(p_key);
begin
  if v <> 'ok' then return json_build_object('error', v); end if;
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

drop function if exists public.admin_survey(text);
create or replace function public.admin_survey(p_key text)
returns json language plpgsql security definer set search_path = public as $$
declare v text := public.admin_ok(p_key);
begin
  if v <> 'ok' then return json_build_object('error', v); end if;
  return json_build_object(
    'total', (select count(*) from survey_answers),
    'wants', (select coalesce(json_object_agg(w, n), '{}') from (select w, count(*) n from survey_answers, unnest(wants) w group by w) t),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]') from (
        select state, lga, again, wants, created_at from survey_answers where again <> '' order by created_at desc limit 100) r));
end $$;

create or replace function public.admin_reports(p_key text)
returns json language plpgsql security definer set search_path = public as $$
declare v text := public.admin_ok(p_key);
begin
  if v <> 'ok' then return json_build_object('error', v); end if;
  return json_build_object(
    'total', (select count(*) from player_reports),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]') from (
        select target, name, msg, room, created_at, (select count(*) from player_reports p2 where p2.target = p.target) as times
        from player_reports p order by created_at desc limit 100) r));
end $$;

-- 7) Who may call what: the website (anon) only gets the public entry points.
revoke all on function public.client_ip() from public, anon, authenticated;
revoke all on function public.rate_ok(text, int, interval) from public, anon, authenticated;
revoke all on function public.admin_ok(text) from public, anon, authenticated;
revoke all on function public.valid_states() from public, anon, authenticated;
revoke all on function public.clean_text(text, int) from public, anon, authenticated;
grant execute on function public.track_player(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.public_stats(text) to anon, authenticated;
grant execute on function public.submit_survey(text, text, text, text, text[]) to anon, authenticated;
grant execute on function public.report_player(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_stats(text) to anon, authenticated;
grant execute on function public.admin_survey(text) to anon, authenticated;
grant execute on function public.admin_reports(text) to anon, authenticated;
revoke all on public.rate_hits, public.admin_fails, public.player_reports, public.player_pings, public.survey_answers, public.app_secrets from anon, authenticated;

-- 8) Remove the security tester's data (ids that the game never creates)
delete from public.survey_answers where uid !~ '^p[a-z0-9]{10,30}$';
delete from public.player_pings where uid !~ '^p[a-z0-9]{10,30}$';
