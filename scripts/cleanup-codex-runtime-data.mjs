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
const shouldIncludeContentNotifications = argv.includes('--include-content-notifications');

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

function dedupeRows(rows, keyFn = (row) => row.id) {
  const unique = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key || unique.has(key)) continue;
    unique.set(key, row);
  }
  return Array.from(unique.values());
}

async function listAuthUsersByEmailPattern(pattern) {
  const users = [];
  const seenIds = new Set();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data } = await runQuery(`auth.users page ${page}`, () =>
      supabase.auth.admin.listUsers({ page, perPage })
    );
    const pageUsers = data?.users || [];

    for (const user of pageUsers) {
      const email = user.email || null;
      if (!email || !pattern.test(email) || seenIds.has(user.id)) continue;
      seenIds.add(user.id);
      users.push({ id: user.id, email });
    }

    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

async function selectByInChunks(label, table, select, column, values, size = 100) {
  if (!values.length) return [];

  const rows = [];
  for (const valueChunk of chunk(values, size)) {
    const { data } = await runQuery(`${label} (${column})`, () =>
      supabase
        .from(table)
        .select(select)
        .in(column, valueChunk)
    );
    rows.push(...(data || []));
  }
  return rows;
}

async function collectCleanupTargets() {
  const authUsers = await listAuthUsersByEmailPattern(/^codex\..*@example\.com$/i);
  const authUserIds = authUsers.map((user) => user.id);

  const profileEmailRows = (
    await runQuery('profiles by email', () =>
      supabase.from('profiles').select('id,email').ilike('email', 'codex.%@example.com')
    )
  ).data || [];
  const profileIdRows = await selectByInChunks('profiles by auth ids', 'profiles', 'id,email', 'id', authUserIds, 100);
  const profileRows = dedupeRows([...profileEmailRows, ...profileIdRows]);

  const adminWhitelistRes = await runQuery('admin_whitelist by email', () =>
    supabase.from('admin_whitelist').select('id,email').ilike('email', 'codex.%@example.com')
  );

  const adminAuditLogsRes = await runQuery('admin_audit_logs by email', () =>
    supabase.from('admin_audit_logs').select('id,admin_email').ilike('admin_email', 'codex.%@example.com')
  );

  const hostApplicationsByEmail = (
    await runQuery('host_applications by email', () =>
      supabase.from('host_applications').select('id,user_id,email').ilike('email', 'codex.%@example.com')
    )
  ).data || [];
  const hostApplicationsByUserId = await selectByInChunks(
    'host_applications by auth ids',
    'host_applications',
    'id,user_id,email',
    'user_id',
    authUserIds,
    100
  );
  const hostApplicationRows = dedupeRows([...hostApplicationsByEmail, ...hostApplicationsByUserId]);

  const adminTasksRes = await runQuery('admin_tasks by content', () =>
    supabase.from('admin_tasks').select('id,content').ilike('content', '코덱스%')
  );

  const adminTaskCommentsRes = await runQuery('admin_task_comments by content', () =>
    supabase.from('admin_task_comments').select('id,content').ilike('content', '코덱스%')
  );

  const codexUserIds = Array.from(
    new Set([
      ...authUserIds,
      ...profileRows.map((row) => row.id),
      ...hostApplicationRows.map((row) => row.user_id).filter(Boolean),
    ])
  );

  const codexEmails = Array.from(
    new Set([
      ...authUsers.map((row) => row.email).filter(Boolean),
      ...profileRows.map((row) => row.email).filter(Boolean),
      ...hostApplicationRows.map((row) => row.email).filter(Boolean),
      ...(adminWhitelistRes.data || []).map((row) => row.email).filter(Boolean),
    ])
  );

  const experienceRows = dedupeRows(
    await selectByInChunks('experiences by host ids', 'experiences', 'id,host_id', 'host_id', codexUserIds, 25)
  );
  const experienceIds = experienceRows.map((row) => row.id);

  const bookingsByPrefixRes = await runQuery('bookings by order_id prefixes', () =>
    supabase
      .from('bookings')
      .select('id,order_id,user_id,experience_id')
      .or('order_id.like.HOST-REV-BOOKING-%,order_id.like.REV-HOST-NOTI-%,order_id.like.USR-BOOK-%,order_id.like.TEST-BOOKING-%')
  );
  const bookingsByUserRows = await selectByInChunks('bookings by user ids', 'bookings', 'id,order_id,user_id,experience_id', 'user_id', codexUserIds, 25);
  const bookingsByExperienceRows = await selectByInChunks('bookings by experience ids', 'bookings', 'id,order_id,user_id,experience_id', 'experience_id', experienceIds, 25);
  const bookingRows = dedupeRows([
    ...(bookingsByPrefixRes.data || []),
    ...bookingsByUserRows,
    ...bookingsByExperienceRows,
  ]);

  const reviewRows = dedupeRows([
    ...(await selectByInChunks('reviews by user ids', 'reviews', 'id,user_id,experience_id,booking_id', 'user_id', codexUserIds, 25)),
    ...(await selectByInChunks('reviews by experience ids', 'reviews', 'id,user_id,experience_id,booking_id', 'experience_id', experienceIds, 25)),
  ]);

  const guestReviewRows = dedupeRows([
    ...(await selectByInChunks('guest_reviews by guest ids', 'guest_reviews', 'id,guest_id,host_id', 'guest_id', codexUserIds, 25)),
    ...(await selectByInChunks('guest_reviews by host ids', 'guest_reviews', 'id,guest_id,host_id', 'host_id', codexUserIds, 25)),
  ]);

  const wishlistRows = dedupeRows([
    ...(await selectByInChunks('wishlists by user ids', 'wishlists', 'id,user_id,experience_id', 'user_id', codexUserIds, 25)),
    ...(await selectByInChunks('wishlists by experience ids', 'wishlists', 'id,user_id,experience_id', 'experience_id', experienceIds, 25)),
  ]);

  const experienceAvailabilityRows = dedupeRows(
    await selectByInChunks('experience availability by experience ids', 'experience_availability', 'id,experience_id', 'experience_id', experienceIds, 25)
  );

  const serviceRequestRows = dedupeRows([
    ...(await selectByInChunks('service_requests by user ids', 'service_requests', 'id,user_id,selected_host_id', 'user_id', codexUserIds, 25)),
    ...(await selectByInChunks('service_requests by selected_host ids', 'service_requests', 'id,user_id,selected_host_id', 'selected_host_id', codexUserIds, 25)),
  ]);
  const serviceRequestIds = serviceRequestRows.map((row) => row.id);

  const serviceApplicationRows = dedupeRows([
    ...(await selectByInChunks('service_applications by host ids', 'service_applications', 'id,request_id,host_id', 'host_id', codexUserIds, 25)),
    ...(await selectByInChunks('service_applications by request ids', 'service_applications', 'id,request_id,host_id', 'request_id', serviceRequestIds, 25)),
  ]);

  const serviceBookingRows = dedupeRows([
    ...(await selectByInChunks('service_bookings by customer ids', 'service_bookings', 'id,request_id,application_id,customer_id,host_id', 'customer_id', codexUserIds, 25)),
    ...(await selectByInChunks('service_bookings by host ids', 'service_bookings', 'id,request_id,application_id,customer_id,host_id', 'host_id', codexUserIds, 25)),
    ...(await selectByInChunks('service_bookings by request ids', 'service_bookings', 'id,request_id,application_id,customer_id,host_id', 'request_id', serviceRequestIds, 25)),
  ]);

  const inquiryRows = dedupeRows([
    ...(await selectByInChunks('inquiries by user ids', 'inquiries', 'id,user_id,host_id,experience_id', 'user_id', codexUserIds, 25)),
    ...(await selectByInChunks('inquiries by host ids', 'inquiries', 'id,user_id,host_id,experience_id', 'host_id', codexUserIds, 25)),
    ...(await selectByInChunks('inquiries by experience ids', 'inquiries', 'id,user_id,host_id,experience_id', 'experience_id', experienceIds, 25)),
  ]);
  const inquiryIds = inquiryRows.map((row) => row.id);

  const inquiryMessageRows = dedupeRows([
    ...(await selectByInChunks('inquiry_messages by sender ids', 'inquiry_messages', 'id,inquiry_id,sender_id', 'sender_id', codexUserIds, 25)),
    ...(await selectByInChunks('inquiry_messages by inquiry ids', 'inquiry_messages', 'id,inquiry_id,sender_id', 'inquiry_id', inquiryIds, 25)),
  ]);

  const notificationContentRes = await runQuery('notifications by codex content', () =>
    supabase
      .from('notifications')
      .select('id,user_id,title,message')
      .or(CODEX_NOTIFICATION_FILTER)
  );

  const notificationRowsByContent = [...(notificationContentRes.data || [])];
  const notificationRowsByUserId = [];
  if (codexUserIds.length > 0) {
    for (const userIdChunk of chunk(codexUserIds, 25)) {
      const { data: userNotificationRows } = await runQuery('notifications by codex user ids', () =>
        supabase
          .from('notifications')
          .select('id,user_id,title,message')
          .in('user_id', userIdChunk)
      );
      notificationRowsByUserId.push(...(userNotificationRows || []));
    }
  }

  const executeNotifications = Array.from(
    new Map(notificationRowsByUserId.map((row) => [row.id, row])).values()
  );
  const executeNotificationIds = new Set(executeNotifications.map((row) => row.id));
  const reviewNotifications = Array.from(
    new Map(
      notificationRowsByContent
        .filter((row) => !executeNotificationIds.has(row.id))
        .map((row) => [row.id, row])
    ).values()
  );

  const publicUserRows = dedupeRows(
    await selectByInChunks('public users by auth ids', 'users', 'id', 'id', codexUserIds, 100)
  );

  return {
    authUsers,
    authUserIds: codexUserIds,
    authEmails: codexEmails,
    adminWhitelist: adminWhitelistRes.data || [],
    adminAuditLogs: adminAuditLogsRes.data || [],
    hostApplications: hostApplicationRows,
    adminTasks: adminTasksRes.data || [],
    adminTaskComments: adminTaskCommentsRes.data || [],
    experiences: experienceRows,
    bookings: bookingRows,
    reviews: reviewRows,
    guestReviews: guestReviewRows,
    wishlists: wishlistRows,
    experienceAvailability: experienceAvailabilityRows,
    serviceRequests: serviceRequestRows,
    serviceApplications: serviceApplicationRows,
    serviceBookings: serviceBookingRows,
    inquiries: inquiryRows,
    inquiryMessages: inquiryMessageRows,
    notificationsExecute: executeNotifications,
    notificationsReview: reviewNotifications,
    profiles: profileRows.map((row) => ({ id: row.id, email: row.email })),
    publicUsers: publicUserRows.map((row) => ({ id: row.id })),
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
    ['notifications_execute', targets.notificationsExecute.length],
    ['notifications_review', targets.notificationsReview.length],
    ['admin_tasks', targets.adminTasks.length],
    ['admin_task_comments', targets.adminTaskComments.length],
    ['experiences', targets.experiences.length],
    ['bookings', targets.bookings.length],
    ['reviews', targets.reviews.length],
    ['guest_reviews', targets.guestReviews.length],
    ['wishlists', targets.wishlists.length],
    ['experience_availability', targets.experienceAvailability.length],
    ['service_requests', targets.serviceRequests.length],
    ['service_applications', targets.serviceApplications.length],
    ['service_bookings', targets.serviceBookings.length],
    ['inquiries', targets.inquiries.length],
    ['inquiry_messages', targets.inquiryMessages.length],
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

  deleted.notifications = await deleteByIds(
    'notifications',
    [
      ...targets.notificationsExecute.map((row) => row.id),
      ...(shouldIncludeContentNotifications ? targets.notificationsReview.map((row) => row.id) : []),
    ]
  );
  deleted.inquiryMessages = await deleteByIds('inquiry_messages', targets.inquiryMessages.map((row) => row.id));
  deleted.guestReviews = await deleteByIds('guest_reviews', targets.guestReviews.map((row) => row.id));
  deleted.reviews = await deleteByIds('reviews', targets.reviews.map((row) => row.id));
  deleted.adminTaskComments = await deleteByIds('admin_task_comments', targets.adminTaskComments.map((row) => row.id));
  deleted.adminTasks = await deleteByIds('admin_tasks', targets.adminTasks.map((row) => row.id));
  deleted.bookings = await deleteByIds('bookings', targets.bookings.map((row) => row.id));
  deleted.serviceBookings = await deleteByIds('service_bookings', targets.serviceBookings.map((row) => row.id));
  deleted.serviceApplications = await deleteByIds('service_applications', targets.serviceApplications.map((row) => row.id));
  deleted.inquiries = await deleteByIds('inquiries', targets.inquiries.map((row) => row.id));
  deleted.wishlists = await deleteByIds('wishlists', targets.wishlists.map((row) => row.id));
  deleted.experienceAvailability = await deleteByIds('experience_availability', targets.experienceAvailability.map((row) => row.id));
  deleted.experiences = await deleteByIds('experiences', targets.experiences.map((row) => row.id));
  deleted.serviceRequests = await deleteByIds('service_requests', targets.serviceRequests.map((row) => row.id));
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
  if (shouldIncludeContentNotifications) {
    console.log('[codex-cleanup] content-matched notifications will also be deleted.');
  } else {
    console.log('[codex-cleanup] content-matched notifications are review-only and excluded from default execute.');
  }
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
