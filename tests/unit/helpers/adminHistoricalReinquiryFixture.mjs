// Synthetic historical rows are inserted BEFORE Phase 1's future-send trigger.
// This fixture runs in both PGlite and an isolated native PostgreSQL cluster.
export const historyActors = {
  guest: '11111111-1111-4111-8111-111111111111',
  host: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
  whitelist: '44444444-4444-4444-8444-444444444444',
  outsider: '55555555-5555-4555-8555-555555555555',
};
export const repairedHistoryIds = [201, 202, 213];
const { guest, admin, whitelist, outsider } = historyActors;
export function historicalReinquirySeedSql() {
  return `
    CREATE TABLE public.admin_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_id uuid, admin_email text,
      action_type text NOT NULL, target_type text, target_id text,
      details jsonb DEFAULT '{}', ip_address text, created_at timestamptz DEFAULT now()
    );
    INSERT INTO inquiries(id,user_id,host_id,type,status,content,updated_at)
    SELECT id,'${guest}',null,'admin_support','resolved','historical','2026-09-01T00:20Z'
    FROM generate_series(201,226) id;
    UPDATE inquiries SET user_id='${admin}',host_id='${guest}',type='admin' WHERE id=202;
    UPDATE inquiries SET type='general' WHERE id=207;
    UPDATE inquiries SET status='open' WHERE id=208;
    UPDATE inquiries SET updated_at='2026-09-01T00:40Z' WHERE id=223;
    UPDATE inquiries SET updated_at=null WHERE id=226;
    INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,created_at,is_read,read_at)
    SELECT id*100,id,'${guest}','historical customer','2026-09-01T00:30Z',true,'2026-09-01T00:35Z'
    FROM generate_series(201,226) id WHERE id<>219;
    INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,created_at)
    VALUES(20099,201,'${guest}','first follow-up','2026-09-01T00:11Z');
    INSERT INTO admin_audit_logs(action_type,target_type,target_id,details,created_at)
    SELECT 'ADMIN_INQUIRY_STATUS_UPDATE','inquiries',id::text,
           '{"before_status":"open","after_status":"resolved"}','2026-09-01T00:10Z'
    FROM generate_series(201,226) id WHERE id<>203;
    UPDATE admin_audit_logs SET created_at=null WHERE target_id='204';
    UPDATE inquiry_messages SET sender_id='${admin}' WHERE inquiry_id=205;
    UPDATE inquiry_messages SET sender_id='${whitelist}' WHERE inquiry_id=206;
    UPDATE inquiry_messages SET created_at='2026-09-01T00:10Z' WHERE inquiry_id=209;
    UPDATE admin_audit_logs SET action_type='OTHER_ACTION' WHERE target_id='211';
    UPDATE inquiry_messages SET sender_id='${outsider}' WHERE inquiry_id=212;
    INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,type,created_at)
    VALUES(21301,213,'${admin}','removed staff message','deleted','2026-09-01T00:40Z');
    UPDATE inquiry_messages SET created_at=null WHERE inquiry_id=214;
    INSERT INTO inquiry_messages(id,inquiry_id,sender_id,content,created_at)
    VALUES(21499,215,'${guest}','lower id later timestamp','2026-09-01T00:40Z'),
          (21701,217,'${admin}','final staff reply','2026-09-01T00:40Z'),
          (22499,225,'${guest}','older undated message',null);
    UPDATE admin_audit_logs SET target_type='bookings' WHERE target_id='216';
    UPDATE inquiry_messages SET created_at='2026-09-01T00:09Z' WHERE inquiry_id=218;
    UPDATE inquiry_messages SET created_at='2099-01-01T00:30Z' WHERE inquiry_id=224;
    INSERT INTO admin_audit_logs(action_type,target_type,target_id,details,created_at) VALUES
      ('ADMIN_INQUIRY_STATUS_UPDATE','inquiries','210','{"after_status":"resolved"}','2026-09-01T00:35Z'),
      ('ADMIN_INQUIRY_STATUS_UPDATE','inquiries','220','{"after_status":"in_progress"}','2026-09-01T00:20Z'),
      ('ADMIN_INQUIRY_STATUS_UPDATE','inquiries','221','{"after_status":"open"}','2026-09-01T00:10Z'),
      ('ADMIN_INQUIRY_STATUS_UPDATE','inquiries','222','{"after_status":"resolved"}',null);
  `;
}

// Exact unchanged snapshots catch receipt changes, guessed reopen timestamps,
// duplicate audit writes and changes to rows that lack sufficient evidence.
export async function captureHistory(db) {
  return {
    inquiries: (await db.query('SELECT * FROM inquiries WHERE id>=201 ORDER BY id')).rows,
    messages: (await db.query('SELECT * FROM inquiry_messages WHERE inquiry_id>=201 ORDER BY id')).rows,
    audit: (await db.query("SELECT * FROM admin_audit_logs ORDER BY target_id,created_at NULLS FIRST,id")).rows,
  };
}
