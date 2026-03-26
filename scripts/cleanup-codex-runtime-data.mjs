import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, 'utf8')
    .split(/\n/)
    .reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return acc;
      acc[match[1]] = match[2];
      return acc;
    }, {});
}

const argv = process.argv.slice(2);
const shouldExecute = argv.includes('--execute');

const envFromFile = loadEnvFile(resolve('.env.local'));
const env = { ...process.env, ...envFromFile };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CODEX_NOTIFICATION_FILTER = 'title.ilike.%코덱스%,title.ilike.%codex%,message.ilike.%코덱스%,message.ilike.%codex%';

async function runQuery(label, builder) {
  try {
    const result = await builder();
    if (result?.error) throw result.error;
    return result;
  } catch (error) {
    throw new Error(`${label}: ${error.message || String(error)}`);
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function collectCleanupTargets() {
  const profileEmailRes = await runQuery('profiles by email', () =>
    supabase.from('profiles').select('id,email').ilike('email', 'codex.%@example.com')
  );

  const adminWhitelistRes = await runQuery('admin_whitelist by email', () =>
    supabase.from('admin_whitelist').select('id,email').ilike('email', 'codex.%@example.com')
  );

  const adminAuditLogsRes = await runQuery('admin_audit_logs by email', () =>
    supabase.from('admin_audit_logs').select('id,admin_email').ilike('admin_email', 'codex.%@example.com')
  );

  const hostApplicationsRes = await runQuery('host_applications by email', () =>
    supabase.from('host_applications').select('id,user_id,email').ilike('email', 'codex.%@example.com')
  );

  const adminTasksRes = await runQuery('admin_tasks by content', () =>
    supabase.from('admin_tasks').select('id,content').ilike('content', '코덱스%')
  );

  const adminTaskCommentsRes = await runQuery('admin_task_comments by content', () =>
    supabase.from('admin_task_comments').select('id,content').ilike('content', '코덱스%')
  );

  const bookingsRes = await runQuery('bookings by order_id prefixes', () =>
    supabase
      .from('bookings')
      .select('id,order_id')
      .or('order_id.like.HOST-REV-BOOKING-%,order_id.like.REV-HOST-NOTI-%,order_id.like.USR-BOOK-%,order_id.like.TEST-BOOKING-%')
  );

  const notificationContentRes = await runQuery('notifications by codex content', () =>
    supabase
      .from('notifications')
      .select('id,user_id,title,message')
      .or(CODEX_NOTIFICATION_FILTER)
  );

  const codexUserIds = Array.from(
    new Set([
      ...(profileEmailRes.data || []).map((row) => row.id),
      ...(hostApplicationsRes.data || []).map((row) => row.user_id).filter(Boolean),
    ])
  );

  const codexEmails = Array.from(
    new Set([
      ...(profileEmailRes.data || []).map((row) => row.email).filter(Boolean),
      ...(hostApplicationsRes.data || []).map((row) => row.email).filter(Boolean),
      ...(adminWhitelistRes.data || []).map((row) => row.email).filter(Boolean),
    ])
  );
  const emailByUserId = new Map(
    [
      ...(profileEmailRes.data || []).map((row) => [row.id, row.email]),
      ...(hostApplicationsRes.data || [])
        .filter((row) => row.user_id && row.email)
        .map((row) => [row.user_id, row.email]),
    ]
  );

  const notificationRows = [...(notificationContentRes.data || [])];
  if (codexUserIds.length > 0) {
    for (const userIdChunk of chunk(codexUserIds, 25)) {
      const { data: userNotificationRows } = await runQuery('notifications by codex user ids', () =>
        supabase
          .from('notifications')
          .select('id,user_id,title,message')
          .in('user_id', userIdChunk)
      );
      notificationRows.push(...(userNotificationRows || []));
    }
  }

  const uniqueNotifications = Array.from(
    new Map(notificationRows.map((row) => [row.id, row])).values()
  );

  return {
    authUsers: codexUserIds.map((id) => ({
      id,
      email: emailByUserId.get(id) || null,
    })),
    authUserIds: codexUserIds,
    authEmails: codexEmails,
    adminWhitelist: adminWhitelistRes.data || [],
    adminAuditLogs: adminAuditLogsRes.data || [],
    hostApplications: hostApplicationsRes.data || [],
    adminTasks: adminTasksRes.data || [],
    adminTaskComments: adminTaskCommentsRes.data || [],
    bookings: bookingsRes.data || [],
    notifications: uniqueNotifications,
    profiles: (profileEmailRes.data || []).map((row) => ({ id: row.id, email: row.email })),
    publicUsers: codexUserIds.map((id) => ({ id })),
  };
}

function printSummary(targets) {
  const summary = [
    ['auth_users', targets.authUsers.length],
    ['profiles', targets.profiles.length],
    ['users', targets.publicUsers.length],
    ['admin_whitelist', targets.adminWhitelist.length],
    ['admin_audit_logs', targets.adminAuditLogs.length],
    ['host_applications', targets.hostApplications.length],
    ['notifications', targets.notifications.length],
    ['admin_tasks', targets.adminTasks.length],
    ['admin_task_comments', targets.adminTaskComments.length],
    ['bookings', targets.bookings.length],
  ];

  console.log(JSON.stringify(summary.map(([table, count]) => ({ table, count })), null, 2));
}

async function deleteByIds(table, ids) {
  if (!ids.length) return 0;
  let deletedCount = 0;

  for (const idChunk of chunk(ids, 100)) {
    const { error } = await supabase.from(table).delete().in('id', idChunk);
    if (error) throw error;
    deletedCount += idChunk.length;
  }

  return deletedCount;
}

async function executeCleanup(targets) {
  const deleted = {};

  deleted.notifications = await deleteByIds('notifications', targets.notifications.map((row) => row.id));
  deleted.adminTaskComments = await deleteByIds('admin_task_comments', targets.adminTaskComments.map((row) => row.id));
  deleted.adminTasks = await deleteByIds('admin_tasks', targets.adminTasks.map((row) => row.id));
  deleted.bookings = await deleteByIds('bookings', targets.bookings.map((row) => row.id));
  deleted.hostApplications = await deleteByIds('host_applications', targets.hostApplications.map((row) => row.id));
  deleted.adminAuditLogs = await deleteByIds('admin_audit_logs', targets.adminAuditLogs.map((row) => row.id));

  let deletedAdminWhitelist = 0;
  for (const emailChunk of chunk(targets.adminWhitelist.map((row) => row.email), 100)) {
    if (!emailChunk.length) continue;
    const { error } = await supabase
      .from('admin_whitelist')
      .delete()
      .in('email', emailChunk);
    if (error) throw error;
    deletedAdminWhitelist += emailChunk.length;
  }
  deleted.adminWhitelist = deletedAdminWhitelist;

  deleted.profiles = await deleteByIds('profiles', targets.profiles.map((row) => row.id));
  deleted.publicUsers = await deleteByIds('users', targets.publicUsers.map((row) => row.id));

  let deletedAuthUsers = 0;
  for (const user of targets.authUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error && !String(error.message || '').includes('User not found')) {
      throw error;
    }
    deletedAuthUsers += 1;
  }
  deleted.authUsers = deletedAuthUsers;

  console.log(JSON.stringify(deleted, null, 2));
}

async function main() {
  const targets = await collectCleanupTargets();

  console.log(shouldExecute ? '[codex-cleanup] execute mode' : '[codex-cleanup] dry-run mode');
  printSummary(targets);

  if (!shouldExecute) {
    console.log('Run again with --execute to delete the rows above.');
    return;
  }

  await executeCleanup(targets);
}

main().catch((error) => {
  console.error('[codex-cleanup] failed:', error);
  process.exit(1);
});
