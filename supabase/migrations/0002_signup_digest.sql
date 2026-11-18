-- Daily "new accounts" email to Mike (Mental Math Sprint and any future game on this project).
-- An account = a row in public.profiles (email code confirmed + nickname chosen).
-- Runs every day at 00:00 UTC (8 AM Manila). No email on days with no new accounts.
--
-- Needs two Vault secrets (Supabase → Project Settings → Vault → Add new secret). Mike pastes these himself:
--   resend_api_key  : a Resend API key, sending access, domain empty99studios.com
--   notify_email    : the inbox the digest goes to
-- Run once in the Supabase SQL editor. Safe to re-run.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Private bookkeeping, never exposed to the API.
create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

create table if not exists ops.kv (key text primary key, value text not null);
revoke all on ops.kv from public, anon, authenticated;

create or replace function ops.send_signup_digest() returns int
language plpgsql security definer set search_path = '' as $$
declare
  since    timestamptz := coalesce((select value::timestamptz from ops.kv where key = 'signup_digest_at'), now() - interval '1 day');
  run_at   timestamptz := now();
  api_key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key');
  to_addr  text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_email');
  n        int;
  total    int;
  rows_txt text;
  rows_htm text;
begin
  if api_key is null or to_addr is null then
    raise warning 'signup digest: resend_api_key / notify_email missing from Vault';
    return 0;
  end if;

  select count(*),
         string_agg(p.nickname || ' (' || coalesce(u.email, '?') || '), '
                    || to_char(p.created_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM'), E'\n' order by p.created_at),
         string_agg('<li><b>' || p.nickname || '</b> (' || replace(replace(coalesce(u.email, '?'), '<', '&lt;'), '>', '&gt;') || '), '
                    || to_char(p.created_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM') || '</li>', '' order by p.created_at)
    into n, rows_txt, rows_htm
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.created_at > since and p.created_at <= run_at;

  if n > 0 then
    select count(*) into total from public.profiles;
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'from', 'Empty 99 Studios <play@empty99studios.com>',
        'to', jsonb_build_array(to_addr),
        'subject', '🎉 Mental Math Sprint: ' || n || ' new account' || case when n = 1 then '' else 's' end,
        'text', 'New accounts since the last digest (Manila time):' || E'\n\n' || rows_txt || E'\n\nTotal accounts: ' || total,
        'html', '<div style="font-family:system-ui,sans-serif"><p><b>' || n || ' new account' || case when n = 1 then '' else 's' end
                || '</b> since the last digest (Manila time):</p><ul>' || rows_htm
                || '</ul><p style="color:#555">Total accounts: ' || total || '</p></div>'
      )
    );
  end if;

  insert into ops.kv (key, value) values ('signup_digest_at', run_at::text)
  on conflict (key) do update set value = excluded.value;
  return n;
end;
$$;
revoke all on function ops.send_signup_digest() from public, anon, authenticated;

-- Every day at 00:00 UTC = 8:00 AM Manila.
select cron.unschedule(jobid) from cron.job where jobname = 'signup-digest';
select cron.schedule('signup-digest', '0 0 * * *', 'select ops.send_signup_digest()');

-- To test right away: select ops.send_signup_digest();   (returns how many accounts it emailed about)
-- To see if Resend accepted it: select status_code, content from net._http_response order by created desc limit 5;
