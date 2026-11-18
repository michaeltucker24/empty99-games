-- Hourly Resend usage check: emails Mike when either Resend account gets close to the free plan's limits,
-- the signal to upgrade to Resend Pro and merge the accounts.
-- Free plan: 100 emails/day (UTC day, sent + received) and 3,000/month.
-- Warns at 60/day or 2,000/month, at most once per account per UTC day.
--
-- Needs Vault secrets (Supabase → Integrations → Vault). Mike pastes the keys himself:
--   resend_usage_key_empty99     : FULL ACCESS key from the Empty 99 Resend account (usage needs full access)
--   resend_usage_key_glowtique   : FULL ACCESS key from the Glowtique Resend account
--   resend_api_key, notify_email : already there (from 0002)
-- A missing usage key is skipped. Run once in the SQL editor. Safe to re-run.
--
-- How it works: pg_net requests are asynchronous, so each run first reads the replies to the previous
-- run's requests (an hour old), alerts if needed, then sends new requests.

create table if not exists ops.resend_usage (
  account    text primary key,
  daily_used int,
  daily_limit int,
  monthly_used int,
  monthly_limit int,
  checked_at timestamptz,
  alerted_day date
);
alter table ops.resend_usage enable row level security;
revoke all on ops.resend_usage from public, anon, authenticated;

create or replace function ops.check_resend_usage() returns void
language plpgsql security definer set search_path = '' as $$
declare
  acct      record;
  req_id    bigint;
  resp      record;
  body      jsonb;
  d_used    int; d_limit int; m_used int; m_limit int;
  api_key   text := (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key');
  to_addr   text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_email');
  usage_key text;
  today     date := (now() at time zone 'UTC')::date;
begin
  for acct in select * from (values ('empty99', 'resend_usage_key_empty99', 'Empty 99 (Rock Paper Streak + Mental Math)'),
                                    ('glowtique', 'resend_usage_key_glowtique', 'Glowtique')) as t(name, secret, label)
  loop
    -- 1) Read the reply to last run's request
    req_id := (select value::bigint from ops.kv where key = 'usage_req_' || acct.name);
    if req_id is not null then
      select status_code, content into resp from net._http_response where id = req_id;
      if found and resp.status_code = 200 then
        body    := resp.content::jsonb;
        d_used  := (body #>> '{emails,daily,used}')::int;
        d_limit := (body #>> '{emails,daily,limit}')::int;
        m_used  := (body #>> '{emails,monthly,used}')::int;
        m_limit := (body #>> '{emails,monthly,limit}')::int;
        insert into ops.resend_usage (account, daily_used, daily_limit, monthly_used, monthly_limit, checked_at)
        values (acct.name, d_used, d_limit, m_used, m_limit, now())
        on conflict (account) do update set daily_used = excluded.daily_used, daily_limit = excluded.daily_limit,
          monthly_used = excluded.monthly_used, monthly_limit = excluded.monthly_limit, checked_at = excluded.checked_at;

        if (coalesce(d_used, 0) >= 60 or coalesce(m_used, 0) >= 2000)
           and coalesce((select alerted_day from ops.resend_usage where account = acct.name), '1970-01-01') <> today
           and api_key is not null and to_addr is not null then
          perform net.http_post(
            url     := 'https://api.resend.com/emails',
            headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
            body    := jsonb_build_object(
              'from', 'Empty 99 Studios <play@empty99studios.com>',
              'to', jsonb_build_array(to_addr),
              'subject', '⚠️ Resend: ' || acct.label || ' at ' || coalesce(d_used, 0) || '/' || coalesce(d_limit, 100) || ' today',
              'text', acct.label || ' Resend account is close to the free plan limit.' || E'\n\n'
                      || 'Today (UTC day): ' || coalesce(d_used, 0) || ' of ' || coalesce(d_limit, 100) || E'\n'
                      || 'This month: ' || coalesce(m_used, 0) || ' of ' || coalesce(m_limit, 3000) || E'\n\n'
                      || 'Time to upgrade to Resend Pro ($20/mo) and merge both Resend accounts into one. '
                      || 'At 100/day, sign-in codes start failing.'
            )
          );
          update ops.resend_usage set alerted_day = today where account = acct.name;
        end if;
      elsif found then
        raise warning 'resend usage check (%): HTTP %', acct.name, resp.status_code;
      end if;
    end if;

    -- 2) Ask again for next run
    usage_key := (select decrypted_secret from vault.decrypted_secrets where name = acct.secret);
    if usage_key is not null then
      req_id := net.http_get(url := 'https://api.resend.com/usage',
                             headers := jsonb_build_object('Authorization', 'Bearer ' || usage_key));
      insert into ops.kv (key, value) values ('usage_req_' || acct.name, req_id::text)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
end;
$$;
revoke all on function ops.check_resend_usage() from public, anon, authenticated;

-- Every hour at :05.
select cron.unschedule(jobid) from cron.job where jobname = 'resend-usage-check';
select cron.schedule('resend-usage-check', '5 * * * *', 'select ops.check_resend_usage()');

-- See the latest numbers: select * from ops.resend_usage;
