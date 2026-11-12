-- Plumbline schema for Supabase (Postgres). Run once in the Supabase SQL editor, then `npm run seed`.
-- Column names are quoted camelCase so rows map 1:1 to the TypeScript types.
-- The app talks to the database only from the server, with the service-role key.
-- Row-Level Security is ON with no public policies, so the anon key can read nothing.

create table if not exists kits (
  "id" text primary key,
  "name" text not null,
  "voice" text not null default '',
  "palette" jsonb not null default '[]',
  "imageRulesAdded" boolean not null default false
);

create table if not exists rules (
  "id" text primary key,
  "kitId" text not null references kits("id") on delete cascade,
  "section" text not null,
  "title" text not null,
  "text" text not null,
  "category" text not null check ("category" in ('terminology','tone','messaging','claim','readability','accessibility','visual','legal')),
  "severity" text not null check ("severity" in ('blocker','warning','suggestion')),
  "check" jsonb,
  "goodExample" text,
  "badExample" text
);

create table if not exists terms (
  "id" text primary key,
  "kitId" text not null references kits("id") on delete cascade,
  "preferred" text not null,
  "banned" jsonb not null default '[]',
  "note" text
);

create table if not exists facts (
  "id" text primary key,
  "kitId" text not null references kits("id") on delete cascade,
  "statement" text not null,
  "keywords" jsonb not null default '[]',
  "value" double precision,
  "source" text not null,
  "owner" text not null,
  "expiresOn" date
);

create table if not exists submissions (
  "id" text primary key,
  "title" text not null,
  "channel" text not null,
  "aiAssisted" boolean not null default false,
  "keyMessage" text,
  "status" text not null check ("status" in ('draft','in_review','changes_requested','approved')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists revisions (
  "id" text primary key,
  "submissionId" text not null references submissions("id") on delete cascade,
  "n" integer not null,
  "text" text not null,
  "image" jsonb,
  "imageReport" jsonb,
  "score" integer not null,
  "ai" jsonb not null,
  "claims" jsonb not null default '[]',
  "dropped" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  unique ("submissionId", "n")
);

-- A finding cannot exist without a link to a real Brand Kit record (plan, Fig. 11a).
-- Exactly one of ruleId / termId / factId is set, and each is a real foreign key.
-- "on delete restrict": a rule that is cited by findings can be edited but not deleted.
create table if not exists findings (
  "id" text primary key,
  "revisionId" text not null references revisions("id") on delete cascade,
  "submissionId" text not null references submissions("id") on delete cascade,
  "ruleId" text references rules("id") on delete restrict,
  "termId" text references terms("id") on delete restrict,
  "factId" text references facts("id") on delete restrict,
  "pass" text not null,
  "type" text not null,
  "severity" text not null check ("severity" in ('blocker','warning','suggestion')),
  "start" integer not null,
  "end" integer not null,
  "quote" text not null,
  "message" text not null,
  "cites" jsonb not null,
  "fix" text,
  "fixBreaksIntent" boolean default false,
  "confidence" real not null,
  "needsReview" boolean not null default false,
  "claimStatus" text,
  "ai" boolean not null default false,
  "altFix" boolean,
  "alt" boolean,
  "status" text not null check ("status" in ('open','accepted','dismissed','disputed','cleared','overridden')),
  "decidedBy" text,
  "reason" text,
  "createdAt" timestamptz not null default now(),
  constraint finding_cites_exactly_one check (num_nonnulls("ruleId", "termId", "factId") = 1),
  constraint override_needs_reason check ("status" <> 'overridden' or length(coalesce("reason", '')) >= 10)
);

create table if not exists audit (
  "id" text primary key,
  "submissionId" text references submissions("id"), -- no cascade: the audit log is never deleted
  "role" text not null,
  "action" text not null,
  "detail" text not null,
  "at" timestamptz not null default now()
);

create index if not exists findings_revision on findings ("revisionId");
create index if not exists findings_submission on findings ("submissionId");
create index if not exists revisions_submission on revisions ("submissionId");
create index if not exists audit_submission on audit ("submissionId");
create index if not exists rules_kit on rules ("kitId");
create index if not exists terms_kit on terms ("kitId");
create index if not exists facts_kit on facts ("kitId");
-- These back the "on delete restrict" checks when a Brand Kit item is deleted.
create index if not exists findings_rule on findings ("ruleId");
create index if not exists findings_term on findings ("termId");
create index if not exists findings_fact on findings ("factId");

-- Audit log is append-only: the database refuses both changes and deletions.
create or replace function audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit log is append-only';
end $$;
drop trigger if exists audit_no_update on audit;
drop trigger if exists audit_append_only on audit;
create trigger audit_append_only before update or delete on audit for each row execute function audit_append_only();

alter table kits enable row level security;
alter table rules enable row level security;
alter table terms enable row level security;
alter table facts enable row level security;
alter table submissions enable row level security;
alter table revisions enable row level security;
alter table findings enable row level security;
alter table audit enable row level security;

-- ---------- Organisations, decisions, stored AI answers ----------

alter table kits add column if not exists "logos" jsonb not null default '[]';
alter table submissions add column if not exists "kitId" text not null default 'kit_quickkart' references kits("id");
alter table submissions alter column "kitId" drop default;
alter table submissions add column if not exists "createdBy" text not null default 'creator';
alter table audit add column if not exists "kitId" text not null default 'kit_quickkart' references kits("id");
alter table audit alter column "kitId" drop default;
alter table findings add column if not exists "fingerprint" text;
alter table findings add column if not exists "carriedFrom" integer;
alter table findings add column if not exists "frameMs" integer;
alter table findings add column if not exists "reasonCode" text;
alter table revisions add column if not exists "video" jsonb;
create index if not exists submissions_kit on submissions ("kitId");
create index if not exists audit_kit on audit ("kitId");
create index if not exists findings_fingerprint on findings ("fingerprint");

-- Every decision, kept for good. Learning reads this table and never changes it.
create table if not exists finding_decisions (
  "id" text primary key,
  "kitId" text not null references kits("id"),
  "findingId" text not null references findings("id"),
  "fingerprint" text,
  "ruleKey" text not null,
  "citeKind" text not null check ("citeKind" in ('rule','term','fact')),
  "ruleVersionHash" text not null,
  "pass" text not null,
  "type" text not null,
  "baseSeverity" text not null,
  "baseConfidence" real not null,
  "fromStatus" text not null,
  "toStatus" text not null,
  "kind" text not null check ("kind" in ('explicit','implicit')),
  "reasonCode" text check ("reasonCode" in ('wrong','valid_but_exception','rule_outdated','not_useful')),
  "actorId" text not null,
  "actorRole" text not null,
  "isDraftAuthor" boolean not null default false,
  "revisionN" integer not null,
  "isSeed" boolean not null default false,
  "at" timestamptz not null default now()
);
create index if not exists decisions_kit_rule on finding_decisions ("kitId", "ruleKey", "at");
create index if not exists decisions_finding on finding_decisions ("findingId");
drop trigger if exists decisions_append_only on finding_decisions;
create trigger decisions_append_only before update or delete on finding_decisions for each row execute function audit_append_only();
alter table finding_decisions enable row level security;

create table if not exists ai_results (
  "id" text primary key,
  "result" jsonb not null,
  "model" text,
  "createdAt" timestamptz not null default now()
);
alter table ai_results enable row level security;

-- One decision, all or nothing. The row lock makes identical parallel clicks produce one ledger row.
create or replace function decide_finding(p_id text, p_kit text, p_status text, p_by text, p_reason text, p_reason_code text, p_ledger jsonb, p_audit jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_from text;
  v_sub text;
  v_sub_status text;
begin
  select f."status", f."submissionId", s."status" into v_from, v_sub, v_sub_status
  from public.findings f join public.submissions s on s."id" = f."submissionId"
  where f."id" = p_id and s."kitId" = p_kit
  for update of f;
  if not found then return jsonb_build_object('found', false, 'changed', false, 'locked', false); end if;
  if v_sub_status = 'approved' then return jsonb_build_object('found', true, 'changed', false, 'locked', true); end if;
  if v_from = p_status then return jsonb_build_object('found', true, 'changed', false, 'locked', false, 'fromStatus', v_from); end if;
  update public.findings set "status" = p_status, "decidedBy" = p_by, "reason" = p_reason, "reasonCode" = p_reason_code where "id" = p_id;
  insert into public.finding_decisions select * from jsonb_populate_record(null::public.finding_decisions, p_ledger || jsonb_build_object('fromStatus', v_from));
  insert into public.audit select * from jsonb_populate_record(null::public.audit, p_audit);
  update public.submissions set "updatedAt" = now() where "id" = v_sub;
  return jsonb_build_object('found', true, 'changed', true, 'locked', false, 'fromStatus', v_from);
end $$;
revoke execute on function decide_finding(text, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function decide_finding(text, text, text, text, text, text, jsonb, jsonb) to service_role;

-- Clears demo data before a reseed. TRUNCATE skips the append-only row triggers. Stored AI answers stay.
create or replace function reset_demo() returns void language plpgsql set search_path = '' as $$
begin
  truncate table public.finding_decisions, public.audit, public.findings, public.revisions, public.submissions, public.rules, public.terms, public.facts, public.kits;
end $$;
revoke execute on function reset_demo() from public, anon, authenticated;
grant execute on function reset_demo() to service_role;

-- Learning: which draft a decision was on, what changed a finding, and rules kept at full strength.
alter table finding_decisions add column if not exists "submissionId" text;
alter table findings add column if not exists "calibration" jsonb;
create table if not exists calibration_pins (
  "id" text primary key,
  "kitId" text not null references kits("id"),
  "ruleKey" text not null,
  "until" timestamptz not null,
  "by" text not null,
  "at" timestamptz not null default now()
);
create index if not exists calibration_pins_kit on calibration_pins ("kitId", "ruleKey");
alter table calibration_pins enable row level security;
create or replace function reset_demo() returns void language plpgsql set search_path = '' as $$
begin
  truncate table public.calibration_pins, public.finding_decisions, public.audit, public.findings, public.revisions, public.submissions, public.rules, public.terms, public.facts, public.kits;
end $$;
revoke execute on function reset_demo() from public, anon, authenticated;
grant execute on function reset_demo() to service_role;

-- One counter per key per time window, so every server instance shares the same limit.
create table if not exists rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table rate_limit_hits enable row level security;

create or replace function take_rate_limit(p_key text, p_limit integer, p_window_ms integer)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000);
  v_hits integer;
begin
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '2 days';
  end if;
  insert into public.rate_limit_hits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_limit;
end $$;
revoke execute on function take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function take_rate_limit(text, integer, integer) to service_role;
