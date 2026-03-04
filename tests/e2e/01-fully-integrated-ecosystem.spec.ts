import { test, expect } from '@playwright/test';

// 가상 유저 생성기 (중복 에러 방지를 위해 난수가 붙은 계정을 생성합니다)
const generateFakeUser = (prefix: string) => {
    const timestamp = Date.now();
    return {
        email: `${prefix}_${timestamp}@test.com`,
        password: 'password123!',
        fullName: `Test ${prefix} ${timestamp}`,
        phone: `010${Math.floor(Math.random() * 90000000) + 10000000}`,
        birthDate: '19950505',
        gender: 'Male' // 'Male' or 'Female' (대문자 주의)
    };
};

test.describe.serial('Epic: Fully Integrated Ecosystem Test (End-to-End)', () => {
    // 🎭 각 등장인물의 "계정 정보"
    const hostUser = generateFakeUser('host');
    const guestUser = generateFakeUser('guest');
    const adminEmail = 'admin@test.com'; // 관리자는 기존 계정 사용
    const adminPassword = '00000000';

    let createdExperienceTitle: string;
    let createdExperienceId: string | null = null;
    let createdBookingId: string | null = null;

    test.setTimeout(120000); // 전체 시나리오를 한 번에 돌리므로 제한 시간을 2분으로 넉넉하게 잡습니다.

    test('All Scenes: Signup, Host Approval, EXP Creation, Booking, Payment, Messaging', async ({ browser }) => {
        // ==========================================
        // 🎬 브라우저 컨텍스트 준비 (동시 상호작용을 위해 3개의 창을 독립적으로 유지)
        // ==========================================
        const adminContext = await browser.newContext();
        const hostContext = await browser.newContext();
        const guestContext = await browser.newContext();

        const adminPage = await adminContext.newPage();
        const hostPage = await hostContext.newPage();
        const guestPage = await guestContext.newPage();

        // 관리자 미리 로그인 (Admin)
        await adminPage.goto('/login');
        await adminPage.locator('input[type="email"]').fill(adminEmail);
        await adminPage.locator('input[type="password"]').fill(adminPassword);
        await adminPage.locator('button[type="submit"]').click();
        await adminPage.waitForURL(/\/|\/home/);

        // ==========================================
        // 🎬 Scene 1: 새로운 Host 가입 및 관리자 승인
        console.log(`[Scene 1] Host Registration: ${hostUser.email}`);

        // 1. 호스트 가입
        await hostPage.goto('/login');

        // ==== 디버깅을 위해 브라우저 콘솔 에러를 Playwright 터미널로 전달 ====
        hostPage.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('오류') || msg.text().includes('fail')) {
                console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
            }
        });

        // '계정 생성' (모드 변경) 클릭 - 모달 하단의 텍스트 버튼
        // '계정 생성' (모드 변경) 클릭 - 모달 하단의 텍스트 버튼 (번역 혹은 하드코딩된 텍스트 변화 방어를 위해 CSS/구조로 선택)
        const toggleBtn = hostPage.locator('div.mt-6.text-center.text-sm > button');
        await toggleBtn.waitFor({ state: 'visible' });
        await toggleBtn.click();

        // 폼 작성 (라벨 텍스트 혹은 placeholder 사용)
        await hostPage.locator('input[type="email"]').fill(hostUser.email);
        await hostPage.locator('input[type="password"]').fill(hostUser.password);
        await hostPage.locator('input[placeholder*="이름"]').fill(hostUser.fullName);
        await hostPage.locator('input[type="tel"]').fill(hostUser.phone);
        await hostPage.locator('input[placeholder*="생년월일"]').fill('19900101');
        await hostPage.locator('select').selectOption('Male');

        // 가입 버튼 클릭 및 모달 닫힘/리로드 대기
        const signupResponsePromise = hostPage.waitForResponse(res => res.url().includes('/auth/v1/signup') && res.status() === 200, { timeout: 15000 }).catch(() => null);
        await hostPage.locator('button[type="submit"]').click();

        // **중요**: 회원가입 API가 성공적으로 응답하고 모달이 닫힐 때까지 대기
        await signupResponsePromise;
        await expect(hostPage.locator('button[type="submit"]')).not.toBeVisible({ timeout: 15000 });
        await hostPage.waitForTimeout(3000); // 넉넉하게 세션 안정화 대기

        // 홈 이동 후 '호스트 지원하기' 플로우
        await hostPage.goto('/become-a-host');
        await hostPage.locator('button').filter({ hasText: /시작하기|호스트 등록하기/i }).first().click();

        // URL 전환 대기
        await hostPage.waitForURL('**/host/register**', { timeout: 10000 });

        // Step 1: 국적
        await hostPage.locator('button').filter({ hasText: '한국인' }).click();
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 2: 언어
        await hostPage.locator('button').filter({ hasText: '한국어' }).click();
        await hostPage.locator('button').filter({ hasText: 'Lv.5' }).first().click();
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 3: 연락처
        await hostPage.locator('input[placeholder="홍길동"]').fill(hostUser.fullName);
        await hostPage.locator('input[placeholder="YYYY.MM.DD"]').fill('1990.01.01');
        await hostPage.locator('input[type="tel"]').fill('010-1234-5678');
        await hostPage.locator('input[type="email"]').fill(hostUser.email);
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 4: 프로필 설정
        await hostPage.locator('textarea').fill('안녕하세요 봇입니다. 자동화 테스트 중입니다.');
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 5: 신분증 (스킵 가능하므로 바로 다음)
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 6: 정산 계좌
        await hostPage.locator('input[placeholder*="은행"]').fill('오토뱅크');
        await hostPage.locator('input[placeholder*="숫자만"]').fill('1234567890');
        await hostPage.locator('input[placeholder="본인 실명"]').fill(hostUser.fullName);
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 7: 신청 사유 및 약관
        await hostPage.locator('textarea').fill('자동화 E2E 테스트 목적으로 지원합니다.');
        await hostPage.locator('label').filter({ hasText: /본인은 로컬리/i }).click();
        await hostPage.getByRole('button', { name: '다음' }).click();

        // Step 8: 서약 및 최종 제출
        await hostPage.locator('label').filter({ hasText: /정독하고 숙지하였습니다/i }).first().click();
        await hostPage.locator('label').filter({ hasText: /법적 책임이 따를 수 있음/i }).first().click();
        await hostPage.locator('button').filter({ hasText: '신청 완료하기' }).click();

        // 완료 후 대시보드 리다이렉션 대기 (토스트 메시지 포함될 수 있음)
        await hostPage.waitForURL('**/host/dashboard**', { timeout: 10000 });

        // 2. 관리자(Admin)가 대시보드에서 호스트 지원서 목록 -> '승인' 버튼 찾기
        await adminPage.goto('/admin/dashboard');

        // 사이드바 'Approvals' 탭 클릭
        await adminPage.locator('text=/Approvals/i').first().click();

        // 관리자 패널(ListPanel.tsx)에서 이름(hostUser.fullName)으로 방금 가입한 유저 항목 찾아 클릭
        const hostListItem = adminPage.locator(`div:has-text("${hostUser.fullName}")`).first();
        await expect(hostListItem).toBeVisible({ timeout: 15000 });
        await hostListItem.click();

        // 우측 DetailsPanel에서 '승인 (호스트 권한 부여)' 버튼 클릭
        const approveHostBtn = adminPage.locator('button:has-text("승인 (호스트 권한 부여)")').first();
        await expect(approveHostBtn).toBeVisible({ timeout: 10000 });
        await approveHostBtn.click();


        // ==========================================
        // 🎬 Scene 2: 호스트 모드 변환 & 신규 체험 생성
        // ==========================================
        console.log(`[Scene 2] Create Experience by Host`);
        // 승인 후 호스트 화면 리프레시 및 새 체험 등록 페이지로 바로 이동
        await hostPage.goto('/host/create');

        // [Step 1] 지역/카테고리 선택
        console.log('   - [Step 1] Selecting City & Category');
        await hostPage.locator('button').filter({ hasText: /^서울$/ }).first().click();
        await hostPage.locator('button').filter({ hasText: /^맛집 탐방$/ }).first().click();
        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 2] 언어 선택
        console.log('   - [Step 2] Selecting Languages');
        await hostPage.locator('button').filter({ hasText: /^한국어$/ }).first().click();
        await hostPage.locator('button', { hasText: 'Lv.5' }).first().click();
        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 3] 제목 및 사진
        console.log('   - [Step 3] Title & Photos');
        createdExperienceTitle = `[Playwright] E2E Automated Tour ${Date.now()}`;
        await hostPage.locator('input[placeholder*="제목"]').fill(createdExperienceTitle);

        const fileChooserPromise = hostPage.waitForEvent('filechooser');
        await hostPage.locator('label').filter({ hasText: '대표사진 추가' }).click();
        const fileChooser = await fileChooserPromise;
        const path = require('path');
        await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'e2e', 'test-image.png'));

        // 사진이 업로드되어 미리보기가 나타날 때까지 확실히 대기
        await expect(hostPage.locator('img[alt*="preview 0"]')).toBeVisible({ timeout: 10000 });

        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 4] 장소 및 동선
        console.log('   - [Step 4] Meeting Point & Itinerary');
        await hostPage.locator('input[placeholder*="예) 스타벅스"]').first().fill('테스트 만남 장소');
        await hostPage.locator('input[placeholder*="예) 서울특별시"]').first().fill('서울특별시 마포구 양화로 165');
        // 첫 번째 일정 항목
        await hostPage.locator('input[placeholder="장소 이름"]').first().fill('홍대 맛집 투어 시작점');
        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 5] 상세 소개 및 포함 사항
        console.log('   - [Step 5] Description & Inclusions');
        await hostPage.locator('textarea[placeholder*="상세 소개글을 입력하세요"]').fill('이곳은 50자 이상의 글자수를 요구하는 체험 상세 설명입니다. 봇이 작성하고 있기 때문에 아무말이나 길게 적어봅니다. 길이가 충분해야 다음으로 넘어갈 수 있습니다. 50자 채우기 위해서 열심히 적고 있습니다. 이정도면 충분히 50자가 넘었겠죠? 더 적어야 하나요?');
        // 포함/불포함 엔터키 이벤트로 등록
        await hostPage.locator('input[placeholder*="예) 음료"]').fill('음식 비용');
        await hostPage.locator('input[placeholder*="예) 음료"]').press('Enter');

        await hostPage.locator('input[placeholder*="예) 개인 교통비"]').fill('개인 경비');
        await hostPage.locator('input[placeholder*="예) 개인 교통비"]').press('Enter');
        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 6] 규칙 설정
        console.log('   - [Step 6] Rules');
        await hostPage.locator('input[placeholder*="예) 만 7세 이상"]').fill('만 19세 이상');
        await hostPage.locator('button', { hasText: '다음' }).click();

        // [Step 7] 요금 설정 및 제출
        console.log('   - [Step 7] Price & Submit');
        await hostPage.locator('input[type="number"]').first().fill('50000');
        await hostPage.locator('button', { hasText: '체험 등록하기' }).click();

        // [Success] 실제 앱은 성공 시 대시보드로 리다이렉트됨
        console.log('   - Waiting for dashboard redirect...');
        await hostPage.waitForURL('**/host/dashboard**', { timeout: 30000 });
        await hostPage.waitForLoadState('networkidle');

        // '내 체험 관리' 탭 또는 제목이 보이는지 확인 (번역 대응을 위해 정규식 사용)
        await expect(hostPage.locator('button, h1').filter({ hasText: /내 체험|My Exp/i }).first()).toBeVisible({ timeout: 15000 });
        console.log('   - [Success] Experience created and navigated to dashboard');

        // 3. 관리자(Admin)가 대시보드 - '승인 관리' 의 서브탭 '체험 등록' 에서 승인 처리
        await adminPage.goto('/admin/dashboard?tab=APPROVALS'); // 페이지가 닫혔을 수 있으므로 직접 이동

        // 서브 탭 '체험 등록' 열기
        const expsSubTab = adminPage.locator('button:has-text("체험 등록")').first();
        await expect(expsSubTab).toBeVisible();
        await expsSubTab.click();

        // 목록(ListPanel)에서 방금 생성한 체험 제목 클릭
        const expListItem = adminPage.locator(`div:has-text("${createdExperienceTitle}")`).first();
        await expect(expListItem).toBeVisible({ timeout: 15000 });
        await expListItem.click();

        // 우측 세부 패널(DetailsPanel)에서 '승인' 버튼 클릭
        const approveExpBtn = adminPage.locator('button').filter({ hasText: /^승인$/ }).first(); // '승인' 정확히 일치
        await expect(approveExpBtn).toBeVisible({ timeout: 10000 });
        await approveExpBtn.click();


        // ==========================================
        // 🎬 Scene 3: 호스트 스케줄 달력 오픈
        // ==========================================
        console.log(`[Scene 3] Open Schedule (Host)`);
        await hostPage.reload(); // 승인 상태 갱신

        // 내 체험 목록에서 방금 승인된 체험의 '일정 관리' 들어가기
        const myExpRow = hostPage.locator(`div:has-text("${createdExperienceTitle}")`).first();
        await myExpRow.locator('button:has-text("일정 관리"), button:has-text("스케줄")').first().click();

        // 달력에서 내일 날짜 클릭 시뮬레이션
        // 버튼 로직에 따라 다르지만 보통 캘린더에서 '클릭 가능한 날짜' 또는 '추가' 버튼 클릭
        // 임시로 화면에 보이는 '일정 추가' 버튼 클릭 -> "13:00, 5명" 등 저장
        const addScheduleBtn = hostPage.locator('button:has-text("일정 등록"), button:has-text("Add Schedule")').first();
        if (await addScheduleBtn.isVisible()) {
            await addScheduleBtn.click();
            await hostPage.locator('input[type="time"]').first().fill('13:00');
            await hostPage.locator('input[type="number"]').last().fill('5'); // 인원수
            await hostPage.locator('button:has-text("저장")').last().click();
        }

        // ==========================================
        // 🎬 Scene 4: 게스트 가입 및 커뮤니티 활동 (글쓰기, 댓글)
        // ==========================================
        console.log(`[Scene 4] Guest Registration & Community Activity: ${guestUser.email}`);
        await guestPage.goto('/login');
        await guestPage.locator(':text("계정 생성"), text="이미 계정이 있으신가요?"').last().click();

        // 게스트 폼 작성
        await guestPage.locator('input[type="email"]').fill(guestUser.email);
        await guestPage.locator('input[type="password"]').fill(guestUser.password);
        await guestPage.locator('input[placeholder*="이름"]').fill(guestUser.fullName);
        await guestPage.locator('input[placeholder*="휴대폰"]').fill(guestUser.phone);
        await guestPage.locator('input[placeholder*="생년월일"]').fill(guestUser.birthDate);
        await guestPage.locator('select').selectOption(guestUser.gender);
        await guestPage.locator('button[type="submit"]').click();
        await guestPage.waitForURL(/\/|\/home/);

        // 커뮤니티 이동
        await guestPage.goto('/community');
        // 아무 글이나 눌러서 '좋아요' 와 '댓글' 작성
        await guestPage.locator('a[href^="/community/"]').first().click();

        const likeBtn = guestPage.locator('button:has(svg:nth-child(1))').first(); // 좋아요 하트 아이콘 버튼
        await likeBtn.click();

        await guestPage.locator('textarea[placeholder*="댓글"]').fill('Playwright 봇이 이 생태계를 무사히 테스트하고 갑니다! 🤖');
        await guestPage.locator('button:has-text("등록"), button:has-text("작성")').first().click();

        // ==========================================
        // 🎬 Scene 5: 게스트 체험 예약 (무통장 입금) 
        // ==========================================
        console.log(`[Scene 5] Guest Book The Experience: ${createdExperienceTitle}`);
        await guestPage.goto('/experiences'); // 전체 목록에서 찾거나 url 힌트 사용
        await guestPage.locator(`text="${createdExperienceTitle}"`).first().click();

        // 상세페이지: 날짜/시간 버튼 클릭 후 예약 폼 진입
        await guestPage.waitForSelector('text=예약하기');
        const availableDateBtn = guestPage.locator('button.h-9.w-9:not([disabled]):visible').first();
        await availableDateBtn.waitFor({ state: 'visible' });
        await availableDateBtn.click();

        const availableTimeBtn = guestPage.locator('text=시간 선택').locator('..').locator('button:not([disabled]):visible').first();
        await availableTimeBtn.click();

        const reserveButton = guestPage.getByRole('button', { name: /예약하기|다음 /i }).first();
        await reserveButton.click();

        // 결제 페이지 진입 - '무통장 입금' 선택
        await guestPage.waitForURL(/\/payment/);
        await guestPage.locator('text="무통장 입금"').first().click();
        await guestPage.getByRole('button', { name: /결제하기|예약 완료/i }).first().click();

        // Pending 상태로 예약 내역 페이지 검증
        await expect(guestPage.locator('text=/Pending|입금 대기/i').first()).toBeVisible({ timeout: 15000 });


        // ==========================================
        // 🎬 Scene 6: 관리자 입금 확인 처리
        // ==========================================
        console.log(`[Scene 6] Admin Approves Payment`);
        await adminPage.reload(); // 관리자 대시보드 리스트 리프레시 
        const ledgerTab = adminPage.locator('text=/예약\\/결제|원장/i').first();
        await ledgerTab.click();

        const unconfirmedRow = adminPage.locator(`tr:has-text("입금 확인")`).first();
        await unconfirmedRow.locator('button:has-text("입금 확인")').first().click();

        // 이 후, PAID/결제 완료가 화면에 렌더링되었는지 확인
        await expect(unconfirmedRow.locator('text=/PAID|결제 완료/i').first()).toBeVisible();


        // ==========================================
        // 🎬 Scene 7: 게스트-호스트 메시지 송수신 체크
        // ==========================================
        console.log(`[Scene 7] Messaging & Notification Check`);

        // 게스트의 예약 내역 페이지 리로딩 시 상태변경 확인
        await guestPage.reload();
        await expect(guestPage.locator('text=/예약 확정|결제 완료|PAID/i').first()).toBeVisible();

        // 게스트가 호스트에게 메시지 보내기 버튼 클릭
        const messageHostBtn = guestPage.locator('button:has-text("메시지 보내기"), button:has-text("호스트에게 문의")').first();
        if (await messageHostBtn.isVisible()) {
            await messageHostBtn.click();
            await guestPage.locator('textarea[placeholder*="메시지"]').fill('입금 후 예약 확정 받았습니다. 내일 뵙겠습니다!');
            await guestPage.locator('button:has-text("전송"), button:has-text("보내기")').click();
        }

        // 호스트 대시보드 - '메시지/채팅' 탭
        await hostPage.reload();
        await hostPage.locator('text=/메시지|Inquiry Chat/i').first().click();

        // 방금 게스트가 보낸 메시지가 호스트 화면에 수신되었는지 확인
        await expect(hostPage.locator('text="입금 후 예약 확정 받았습니다. 내일 뵙겠습니다!"').first()).toBeVisible();

        // ==========================================
        // 🎉 브라우저 자원 반환
        // ==========================================
        await guestContext.close();
        await hostContext.close();
        await adminContext.close();
    });
});
