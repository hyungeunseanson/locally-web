import { test, expect } from '@playwright/test';

test.describe('Scenario 2: Experience Booking & Bank Transfer Flow', () => {

    test('Guest books an experience and admin confirms bank transfer', async ({ browser }) => {
        // 1. Guest session
        const guestContext = await browser.newContext();
        const guestPage = await guestContext.newPage();

        await guestPage.goto('/login');

        // 이메일과 비밀번호 입력
        await guestPage.locator('input[type="email"]').fill('guest@test.com');
        await guestPage.locator('input[type="password"]').fill('00000000');
        // 로그인 제출 버튼(유일한 submit 버튼)
        await guestPage.locator('button[type="submit"]').click();

        // 메인 홈 이동 확실히 대기
        await guestPage.waitForURL('http://localhost:3000/');

        // 체험(Experience) 상세 페이지로 이동 (첫 번째 뜨는 체험 클릭)
        const experienceLink = guestPage.locator('a[href^="/experiences/"]:visible').first();
        await experienceLink.waitFor({ state: 'visible' });
        await experienceLink.click();

        // 예약 폼 로드 대기
        await guestPage.waitForSelector('text=예약하기');

        // 날짜 선택 (예약 가능한 날짜 클릭)
        const availableDateBtn = guestPage.locator('button.h-9.w-9:not([disabled]):visible').first();
        await availableDateBtn.waitFor({ state: 'visible', timeout: 10000 });
        await availableDateBtn.click();

        // 시간 선택 (날짜 선택 후 나타나는 시간 버튼 클릭)
        const availableTimeBtn = guestPage.locator('text=시간 선택').locator('..').locator('button:not([disabled]):visible').first();
        await availableTimeBtn.waitFor({ state: 'visible', timeout: 5000 });
        await availableTimeBtn.click();

        // 예약하기 클릭
        const reserveButton = guestPage.getByRole('button', { name: /예약하기|다음 담계/i }).first();
        await expect(reserveButton).toBeVisible();
        await reserveButton.click();

        // 결제 페이지 대기
        await guestPage.waitForURL(/\/payment/, { timeout: 10000 });

        // 결제 수단 '무통장 입금' 선택 (라디오 버튼 또는 버튼 텍스트)
        const bankTransferOption = guestPage.locator('text="무통장 입금"').first();
        await bankTransferOption.waitFor({ state: 'visible' });
        await bankTransferOption.click();

        // 결제 요청(예약 완료) 버튼 클릭
        const checkoutButton = guestPage.getByRole('button', { name: /결제하기|예약 완료|무통장 입금 신청하기/i }).first();
        await expect(checkoutButton).toBeVisible();
        await checkoutButton.click();

        // 예약 완료 또는 예약 상세 페이지에서 상태 확인 (Pending 또는 입금 대기)
        await expect(guestPage.locator('text=/Pending|입금 대기|예약 대기/i').first()).toBeVisible({ timeout: 15000 });

        await guestContext.close();

        // 2. Admin session
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        // 관리자 로그인
        await adminPage.goto('/login');
        await adminPage.locator('input[type="email"]').fill('admin@test.com');
        await adminPage.locator('input[type="password"]').fill('00000000');
        await adminPage.locator('button[type="submit"]').click();

        // 관리자 대시보드 이동
        await adminPage.goto('/admin/dashboard');

        // [예약/결제] 또는 관련 탭 대기 후 클릭 (Master Ledger 활용 예상)
        // 텍스트는 UI에 맞게 변경
        const ledgerTab = adminPage.locator('text=/예약\\/결제|결제 내역|원장|Master Ledger/i').first();
        await expect(ledgerTab).toBeVisible();
        await ledgerTab.click();

        // '입금 확인' 또는 상태 변경 버튼(Confirm) 클릭
        const confirmButton = adminPage.locator('button:has-text("입금 확인")').first();
        await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
        await confirmButton.click();

        // 승인 후 예약 상태가 'PAID' 혹은 결제 완료로 변했는지 확인
        await expect(adminPage.locator('text=/PAID|결제 완료|결제완료|승인됨/i').first()).toBeVisible({ timeout: 10000 });

        await adminContext.close();
    });
});
