import { readFileSync } from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { expect, test } from '@playwright/test';

const migration = readFileSync(
  'supabase/migrations/20261011030643_restrict_host_application_writes.sql',
  'utf8'
);

test('client roles cannot approve applications; server moderation and public projection remain intact', async () => {
  const db = new PGlite();
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const firstId = '00000000-0000-4000-8000-000000000001';
  const secondId = '00000000-0000-4000-8000-000000000002';

  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE public.host_applications (
        id uuid PRIMARY KEY, user_id uuid NOT NULL, status text DEFAULT 'pending',
        name text, created_at timestamptz DEFAULT now(), is_superhost boolean DEFAULT false
      );
      ALTER TABLE public.host_applications ENABLE ROW LEVEL SECURITY;
      CREATE POLICY ha_select_own ON public.host_applications FOR SELECT
        USING (auth.uid() = user_id);
      CREATE POLICY ha_insert_own ON public.host_applications FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      CREATE POLICY ha_update_own ON public.host_applications FOR UPDATE
        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
      CREATE POLICY ha_delete_own ON public.host_applications FOR DELETE
        USING (auth.uid() = user_id);
      GRANT ALL ON public.host_applications TO anon, authenticated, service_role;
      INSERT INTO public.host_applications (id, user_id, status, name, created_at)
        VALUES ('${firstId}', '${owner}', 'approved', 'Approved', '2026-10-01');
      CREATE VIEW public.public_host_applications WITH (security_invoker=false, security_barrier=true) AS
        WITH latest_per_user AS (
          SELECT DISTINCT ON (user_id) id, user_id, status, name, created_at
          FROM public.host_applications ORDER BY user_id, created_at DESC, id DESC
        )
        SELECT * FROM latest_per_user WHERE status = 'approved';
      GRANT SELECT ON public.public_host_applications TO anon, authenticated, service_role;
    `);

    const viewBefore = (await db.query<{ definition: string }>(
      "SELECT pg_get_viewdef('public.public_host_applications'::regclass, true) AS definition"
    )).rows[0].definition;
    await db.exec(migration);
    const viewAfter = (await db.query<{ definition: string }>(
      "SELECT pg_get_viewdef('public.public_host_applications'::regclass, true) AS definition"
    )).rows[0].definition;
    expect(viewAfter).toBe(viewBefore);

    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${owner}', false); SET ROLE authenticated;`);
    expect((await db.query<{ status: string }>(
      `SELECT status FROM public.host_applications WHERE id = '${firstId}'`
    )).rows[0].status).toBe('approved');
    await expect(db.exec(
      `INSERT INTO public.host_applications (id, user_id, status) VALUES ('${secondId}', '${owner}', 'approved')`
    )).rejects.toThrow();
    await expect(db.exec(
      `UPDATE public.host_applications SET status = 'rejected' WHERE id = '${firstId}'`
    )).rejects.toThrow();
    await expect(db.exec(
      `DELETE FROM public.host_applications WHERE id = '${firstId}'`
    )).rejects.toThrow();
    await db.exec('RESET ROLE;');

    await db.exec('SET ROLE service_role;');
    await db.exec(`
      INSERT INTO public.host_applications (id, user_id, status, name, created_at)
      VALUES ('${secondId}', '${owner}', 'pending', 'Latest', '2026-10-02');
    `);
    expect((await db.query('SELECT id FROM public.public_host_applications')).rows).toHaveLength(0);
    for (const status of ['revision', 'rejected']) {
      await db.exec(`UPDATE public.host_applications SET status = '${status}' WHERE id = '${secondId}'`);
      expect((await db.query('SELECT id FROM public.public_host_applications')).rows).toHaveLength(0);
    }
    await db.exec(`UPDATE public.host_applications SET status = 'approved' WHERE id = '${secondId}'`);
    expect((await db.query<{ id: string }>('SELECT id FROM public.public_host_applications')).rows)
      .toEqual([{ id: secondId }]);
    await db.exec('RESET ROLE;');

    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${other}', false); SET ROLE authenticated;`);
    expect((await db.query('SELECT id FROM public.host_applications')).rows).toHaveLength(0);
    expect((await db.query<{ id: string }>('SELECT id FROM public.public_host_applications')).rows)
      .toEqual([{ id: secondId }]);
    await db.exec('RESET ROLE;');
  } finally {
    await db.close();
  }
});
