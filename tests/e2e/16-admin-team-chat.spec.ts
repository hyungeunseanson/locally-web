import { test } from '@playwright/test';

test.describe.serial('Admin team chat smoke', () => {
  test('sends a global team chat message through admin routes', async () => {
    test.skip(
      true,
      'GlobalTeamChat is not mounted in the current Team Workspace surface; the TEAM_CHAT_ROOM_ID route path is tracked separately in the admin route-owner audit.'
    );
  });
});
