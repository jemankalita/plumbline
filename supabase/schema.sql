-- Plumbline schema for Supabase (Postgres). Run once in the Supabase SQL editor.
-- Column names are quoted camelCase so rows map 1:1 to the TypeScript types.
-- The app talks to the database only from the server, with the service-role key.
-- Row-Level Security is ON with no public policies, so the anon key can read nothing.

create table if not exists kits (
  "id" text primary key,
  "name" text not null,
  "voice" text not null default '',
  "palette" jsonb not null default '[]'
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
  "status" text not null check ("status" in ('open','accepted','dismissed','disputed','cleared','overridden')),
  "decidedBy" text,
  "reason" text,
  "createdAt" timestamptz not null default now(),
  constraint finding_cites_exactly_one check (num_nonnulls("ruleId", "termId", "factId") = 1),
  constraint override_needs_reason check ("status" <> 'overridden' or length(coalesce("reason", '')) >= 10)
);

create table if not exists audit (
  "id" text primary key,
  "submissionId" text references submissions("id") on delete cascade,
  "role" text not null,
  "action" text not null,
  "detail" text not null,
  "at" timestamptz not null default now()
);

create index if not exists findings_revision on findings ("revisionId");
create index if not exists findings_submission on findings ("submissionId");
create index if not exists revisions_submission on revisions ("submissionId");
create index if not exists audit_submission on audit ("submissionId");

-- Audit log is append-only.
create or replace function audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit log is append-only';
end $$;
drop trigger if exists audit_no_update on audit;
create trigger audit_no_update before update on audit for each row execute function audit_append_only();

alter table kits enable row level security;
alter table rules enable row level security;
alter table terms enable row level security;
alter table facts enable row level security;
alter table submissions enable row level security;
alter table revisions enable row level security;
alter table findings enable row level security;
alter table audit enable row level security;

-- Image checks (safe to run on an existing project)
alter table kits add column if not exists "imageRulesAdded" boolean not null default false;
alter table revisions add column if not exists "imageReport" jsonb;
alter table findings add column if not exists "altFix" boolean;
alter table findings add column if not exists "alt" boolean;
