import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const usersTabSource = readFileSync('app/admin/dashboard/components/UsersTab.tsx', 'utf8');
const usersSummarySource = readFileSync('app/api/admin/users-summary/route.ts', 'utf8');
const inquirySource = readFileSync('app/api/inquiries/thread/shared.ts', 'utf8');
const chatHookSource = readFileSync('app/hooks/useChat.ts', 'utf8');
const hostInboxSource = readFileSync('app/host/dashboard/InquiryChat.tsx', 'utf8');

test('routes exactly one non-admin member through admin support without also sending an admin alert', () => {
  assert.match(usersTabSource, /selectedMessageRecipient\.role !== 'admin'/);
  assert.match(usersTabSource, /contextType: 'admin_initiated_support'/);
  assert.match(usersTabSource, /message: notiMessage\.trim\(\)/);
  assert.match(usersTabSource, /openOnly: true/);
  assert.match(usersTabSource, /router\.push\(result\.redirectUrl/);
  assert.match(usersTabSource, /if \(isSending\) return;/);

  const directSupportBranch = usersTabSource.slice(
    usersTabSource.indexOf('if (isDirectSupportMessage && selectedMessageRecipient)'),
    usersTabSource.indexOf('const result = await sendNotification')
  );
  assert.doesNotMatch(directSupportBranch, /sendNotification/);
});

test('keeps admin and multi-recipient delivery on the existing notification path', () => {
  assert.match(usersTabSource, /recipient_ids: selectedUserIds/);
  assert.match(usersTabSource, /type: 'admin_alert'/);
  assert.match(usersTabSource, /link: '\/notifications'/);
  assert.match(usersTabSource, /!isDirectSupportMessage && !notiTitle\.trim\(\)/);
});

test('treats whitelist-only members as administrators before host or guest roles', () => {
  assert.equal(usersSummarySource.match(/\.from\('admin_whitelist'\)/g)?.length, 1);
  assert.match(usersSummarySource, /\.from\('admin_whitelist'\)\.select\('email'\)/);
  assert.match(usersSummarySource, /adminWhitelistEmails\.has\(profile\.email\)/);
  assert.match(
    usersSummarySource,
    /resolveDashboardUserRole\([\s\S]*Boolean\(profile\.email && adminWhitelistEmails\.has\(profile\.email\)\)/
  );
  assert.match(usersTabSource, /selectedMessageRecipient\.role !== 'admin'/);
});

test('applies the exact host inbox scope to both the list and deep-link fallback', () => {
  assert.match(
    chatHookSource,
    /and\(host_id\.eq\.\$\{userId\},type\.eq\.general\),and\(user_id\.eq\.\$\{userId\},type\.in\.\(admin_support,admin\)\)/
  );
  assert.equal(
    chatHookSource.match(/\.or\(getHostInboxInquiryFilter\(user\.id\)\)/g)?.length,
    2
  );
  assert.match(chatHookSource, /filter: `host_id=eq\.\$\{currentUser\.id\}`/);
  assert.match(chatHookSource, /filter: `user_id=eq\.\$\{currentUser\.id\}`/);
});

test('uses one role-aware delivery resolver for initial and follow-up support messages', () => {
  assert.equal(
    inquirySource.match(/resolveAdminSupportRecipientDelivery\(\{/g)?.length,
    3
  );
  assert.match(
    inquirySource,
    /resolveAdminAccess\(supabaseAdmin, \{\s*userId: recipientId,\s*email: profileResult\.data\?\.email/
  );
  assert.match(inquirySource, /if \(adminAccess\.isAdmin\) \{\s*return \{\s*link: buildAdminChatLink\(inquiryId\),\s*audience: 'admin'/);
  assert.match(
    inquirySource,
    /const recipientId = contextType === 'admin_initiated_support'\s*\? resolved\.guestId/
  );
  assert.match(inquirySource, /recipientRole === 'host'/);
  assert.match(inquirySource, /link: buildHostInquiryLink\(inquiryId\)/);
  assert.match(inquirySource, /audience: 'host'/);
});

test('treats every support-side participant as an authenticated admin', () => {
  assert.match(
    inquirySource,
    /if \(isAdminSupport\) \{\s*const adminAccess = await resolveAdminAccess\(supabaseAdmin, \{\s*userId: actor\.id,\s*email: actor\.email/
  );
  assert.match(inquirySource, /actorIsAdmin = adminAccess\.isAdmin/);
  assert.match(inquirySource, /if \(!isParticipant && !actorIsAdmin\)/);
  assert.match(inquirySource, /await assertAdminActor\(actor\);/);
  assert.match(inquirySource, /useOfficialSenderName: actorIsAdmin/);
  assert.match(inquirySource, /if \(isAdminSupport && !actorIsAdmin\)/);
  assert.match(inquirySource, /if \(String\(actor\.id\) === String\(inquiry\.user_id\)\) return inquiry\.host_id/);
  assert.match(inquirySource, /actorIsAdmin &&\s*!actorIsStoredParticipant &&\s*recipientDelivery\?\.audience === 'admin'/);
});

test('does not hydrate administrator profile details into participant support chat state', () => {
  assert.match(chatHookSource, /filter\(\(item\) => !isAdminSupportInquiry\(item\.type\)\)/);
  assert.match(chatHookSource, /filter\(\(senderId\) => !isOfficialSupportSender\(senderId\)\)/);
  assert.match(chatHookSource, /OFFICIAL_SUPPORT_SENDER_NAME/);
  assert.match(chatHookSource, /OFFICIAL_SUPPORT_AVATAR_SRC/);
  assert.match(hostInboxSource, /selectedIsAdminSupport \? t\('admin_chat_title'\)/);
  assert.match(hostInboxSource, /selectedIsAdminSupport \? undefined : \(\) => setModalUserId/);
});
