import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();

const bootstrap = `
  create role authenticated;
  create role anon;
  create role service_role;

  create schema auth;

  create table auth.users (
    instance_id uuid,
    id uuid primary key,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    confirmation_token text,
    email_change text,
    email_change_token_new text,
    recovery_token text
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(
      current_setting('request.jwt.claim.sub', true),
      ''
    )::uuid;
  $$;
`;

try {
  await database.exec(bootstrap);

  const schema = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );
  await database.exec(schema);

  await database.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete
      on all tables in schema public to authenticated;
    grant usage, select
      on all sequences in schema public to authenticated;
    grant execute
      on all functions in schema public, auth to authenticated;
  `);

  const test = await readFile(
    new URL("../supabase/tests/organization_isolation.sql", import.meta.url),
    "utf8",
  );
  await database.exec(test);

  console.log("RLS organization isolation tests passed.");
} finally {
  await database.close();
}
