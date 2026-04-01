export type LoginModalLocale = 'ko' | 'en' | 'ja' | 'zh';

type LocalizedText = Record<LoginModalLocale, string>;

type LoginModalCopy = {
  signupTitle: string;
  signupSubtitle: string;
  signupHelper: string;
  emailPasswordRequired: string;
  signupFieldsRequired: string;
  birthDateInvalid: string;
  phoneInvalid: string;
  agreementsRequired: string;
  signupSuccess: string;
  signupVerificationSent: string;
  invalidCredentials: string;
  emailNotConfirmed: string;
  rateLimit: string;
  loginSuccess: string;
  unknownError: string;
  realNameLabel: string;
  phoneFieldLabel: string;
  birthDateFieldLabel: string;
  selectAll: string;
  termsAgreement: string;
  privacyAgreement: string;
  viewLabel: string;
  switchToLogin: string;
  loginHelper: string;
  returnAfterLogin: string;
  socialReturnHint: string;
  loginSuccessTitle: string;
  loginSuccessBody: string;
  signupSuccessTitle: string;
  signupSuccessBody: string;
  signupVerificationSentTitle: string;
  signupVerificationSentBody: string;
};

type LocalizedOption = {
  value: string;
  labels: LocalizedText;
};

const SUPPORTED_LOCALES: LoginModalLocale[] = ['ko', 'en', 'ja', 'zh'];

const normalizeLocale = (locale: string): LoginModalLocale => {
  return SUPPORTED_LOCALES.includes(locale as LoginModalLocale) ? (locale as LoginModalLocale) : 'ko';
};

const COPY: Record<LoginModalLocale, LoginModalCopy> = {
  ko: {
    signupTitle: '가입하고 바로 시작하기',
    signupSubtitle: '필요한 정보만 입력하면 바로 이어서 사용할 수 있어요.',
    signupHelper: '가입하면 예약 내역, 메시지, 위시리스트가 같은 계정에 바로 저장돼요.',
    emailPasswordRequired: '이메일과 비밀번호를 입력해주세요.',
    signupFieldsRequired: '이름, 국적, 연락처, 생년월일, 성별을 모두 입력해주세요.',
    birthDateInvalid: '생년월일 8자리(YYYYMMDD)를 올바르게 입력해주세요.',
    phoneInvalid: '올바른 연락처를 입력해주세요.',
    agreementsRequired: '필수 약관에 동의해주세요.',
    signupSuccess: '환영합니다! 회원가입이 완료되었어요. 체험을 둘러보세요!',
    signupVerificationSent: '인증 메일을 보냈어요! 이메일을 확인하면 모든 기능을 사용할 수 있습니다.',
    invalidCredentials: '이메일 또는 비밀번호가 일치하지 않습니다.',
    emailNotConfirmed: '이메일 인증이 완료되지 않았습니다.',
    rateLimit: '너무 많은 가입 요청이 감지되었습니다. 잠시 후 다시 시도하거나 소셜 로그인을 이용해주세요.',
    loginSuccess: '환영합니다! 로그인 되었습니다.',
    unknownError: '로그인 처리 중 오류가 발생했습니다.',
    realNameLabel: '이름 (실명)',
    phoneFieldLabel: '휴대폰 번호 (- 없이 입력)',
    birthDateFieldLabel: '생년월일 (예: 19900115)',
    selectAll: '전체 동의',
    termsAgreement: '[필수] 서비스 이용약관 동의',
    privacyAgreement: '[필수] 개인정보 수집 및 이용 동의',
    viewLabel: '보기',
    switchToLogin: '이미 계정이 있으신가요? 로그인',
    loginHelper: '로그인하면 지금 보던 내용과 저장한 정보를 바로 이어서 확인할 수 있어요.',
    returnAfterLogin: '로그인 후 지금 보던 화면으로 돌아가 바로 이어서 진행해요.',
    socialReturnHint: '소셜 로그인 후에도 같은 화면으로 돌아와 이어서 진행해요.',
    loginSuccessTitle: '로그인 완료',
    loginSuccessBody: '계정 확인이 끝났어요. 이어서 이동하고 있어요.',
    signupSuccessTitle: '가입 완료',
    signupSuccessBody: '계정이 저장됐어요. 바로 이어서 사용할 수 있어요.',
    signupVerificationSentTitle: '인증 메일 전송 완료',
    signupVerificationSentBody: '이메일 인증을 마치면 바로 로그인해 이어서 사용할 수 있어요.',
  },
  en: {
    signupTitle: 'Sign up and start right away',
    signupSubtitle: 'Enter a few details and continue without losing your place.',
    signupHelper: 'Once you sign up, your bookings, messages, and wishlist are saved in one account.',
    emailPasswordRequired: 'Please enter your email and password.',
    signupFieldsRequired: 'Please fill in your name, nationality, phone number, birth date, and gender.',
    birthDateInvalid: 'Please enter a valid 8-digit birth date (YYYYMMDD).',
    phoneInvalid: 'Please enter a valid phone number.',
    agreementsRequired: 'Please agree to the required terms.',
    signupSuccess: 'Welcome! Your account is ready. Start exploring experiences!',
    signupVerificationSent: 'Verification email sent! Confirm your email to unlock all features.',
    invalidCredentials: 'Your email or password is incorrect.',
    emailNotConfirmed: 'Your email address has not been verified yet.',
    rateLimit: 'Too many sign-up attempts were detected. Please try again later or use social login.',
    loginSuccess: 'Welcome back. You are now logged in.',
    unknownError: 'An error occurred while processing your request.',
    realNameLabel: 'Full name',
    phoneFieldLabel: 'Phone number (numbers only)',
    birthDateFieldLabel: 'Birth date (e.g. 19900115)',
    selectAll: 'Agree to all',
    termsAgreement: '[Required] Agree to Terms of Service',
    privacyAgreement: '[Required] Agree to Privacy Policy',
    viewLabel: 'View',
    switchToLogin: 'Already have an account? Log in',
    loginHelper: 'Log in to keep going with what you were viewing and what you already saved.',
    returnAfterLogin: 'After login, you will return to the screen you were viewing and continue right away.',
    socialReturnHint: 'Even after social login, you will come back to the same screen and continue.',
    loginSuccessTitle: 'Login complete',
    loginSuccessBody: 'Your account is ready. Taking you back now.',
    signupSuccessTitle: 'Sign-up complete',
    signupSuccessBody: 'Your account has been saved. You can continue right away.',
    signupVerificationSentTitle: 'Verification email sent',
    signupVerificationSentBody: 'Finish email verification, then log in and continue right away.',
  },
  ja: {
    signupTitle: '登録してすぐ始める',
    signupSubtitle: '必要な情報だけ入力すれば、そのまま続けて使えます。',
    signupHelper: '登録すると、予約履歴、メッセージ、お気に入りが同じアカウントにすぐ保存されます。',
    emailPasswordRequired: 'メールアドレスとパスワードを入力してください。',
    signupFieldsRequired: '氏名、国籍、連絡先、生年月日、性別をすべて入力してください。',
    birthDateInvalid: '生年月日8桁（YYYYMMDD）を正しく入力してください。',
    phoneInvalid: '有効な連絡先を入力してください。',
    agreementsRequired: '必須規約への同意が必要です。',
    signupSuccess: 'ようこそ！登録が完了しました。体験を探してみましょう！',
    signupVerificationSent: '認証メールを送信しました！確認するとすべての機能が使えます。',
    invalidCredentials: 'メールアドレスまたはパスワードが一致しません。',
    emailNotConfirmed: 'メール認証がまだ完了していません。',
    rateLimit: '登録リクエストが多すぎます。しばらくしてから再試行するか、ソーシャルログインをご利用ください。',
    loginSuccess: 'ログインしました。ようこそ。',
    unknownError: 'ログイン処理中にエラーが発生しました。',
    realNameLabel: '氏名（実名）',
    phoneFieldLabel: '電話番号（ハイフンなし）',
    birthDateFieldLabel: '生年月日（例: 19900115）',
    selectAll: 'すべて同意',
    termsAgreement: '[必須] 利用規約に同意する',
    privacyAgreement: '[必須] 個人情報の収集および利用に同意する',
    viewLabel: '表示',
    switchToLogin: 'すでにアカウントをお持ちですか？ ログイン',
    loginHelper: 'ログインすると、今見ていた内容や保存済みの情報をすぐに続けて確認できます。',
    returnAfterLogin: 'ログイン後は、今見ていた画面に戻ってそのまま続けられます。',
    socialReturnHint: 'ソーシャルログイン後も、同じ画面に戻って続けられます。',
    loginSuccessTitle: 'ログイン完了',
    loginSuccessBody: 'アカウントの確認が終わりました。続けて移動しています。',
    signupSuccessTitle: '登録完了',
    signupSuccessBody: 'アカウントが保存されました。すぐに続けて使えます。',
    signupVerificationSentTitle: '認証メール送信完了',
    signupVerificationSentBody: 'メール認証を完了すると、すぐにログインして続けられます。',
  },
  zh: {
    signupTitle: '注册后马上开始',
    signupSubtitle: '填写必要信息后，就能直接继续使用。',
    signupHelper: '注册后，预订、消息和心愿单会立即保存到同一账号中。',
    emailPasswordRequired: '请输入邮箱和密码。',
    signupFieldsRequired: '请填写姓名、国籍、联系方式、出生日期和性别。',
    birthDateInvalid: '请输入正确的 8 位出生日期（YYYYMMDD）。',
    phoneInvalid: '请输入有效的联系电话。',
    agreementsRequired: '请同意必选条款。',
    signupSuccess: '欢迎！注册已完成，快来探索体验吧！',
    signupVerificationSent: '验证邮件已发送！确认后即可使用所有功能。',
    invalidCredentials: '邮箱或密码不正确。',
    emailNotConfirmed: '邮箱验证尚未完成。',
    rateLimit: '检测到过多注册请求。请稍后再试，或使用社交登录。',
    loginSuccess: '欢迎回来，您已登录。',
    unknownError: '处理登录时发生错误。',
    realNameLabel: '姓名（实名）',
    phoneFieldLabel: '手机号（仅输入数字）',
    birthDateFieldLabel: '出生日期（例: 19900115）',
    selectAll: '全部同意',
    termsAgreement: '[必选] 同意服务条款',
    privacyAgreement: '[必选] 同意隐私政策',
    viewLabel: '查看',
    switchToLogin: '已有账号？去登录',
    loginHelper: '登录后，你刚刚查看的内容和已保存的信息都可以马上继续。',
    returnAfterLogin: '登录后会回到刚才的页面，直接继续操作。',
    socialReturnHint: '使用社交登录后，也会回到同一页面继续操作。',
    loginSuccessTitle: '登录完成',
    loginSuccessBody: '账号已确认，正在为你继续跳转。',
    signupSuccessTitle: '注册完成',
    signupSuccessBody: '账号已保存，你现在可以直接继续使用。',
    signupVerificationSentTitle: '验证邮件已发送',
    signupVerificationSentBody: '完成邮箱验证后，即可登录并继续使用。',
  },
};

const NATIONALITY_OPTIONS: LocalizedOption[] = [
  {
    value: 'KR',
    labels: { ko: '대한민국', en: 'South Korea', ja: '韓国', zh: '韩国' },
  },
  {
    value: 'JP',
    labels: { ko: '일본', en: 'Japan', ja: '日本', zh: '日本' },
  },
  {
    value: 'US',
    labels: { ko: '미국', en: 'United States', ja: 'アメリカ', zh: '美国' },
  },
  {
    value: 'CN',
    labels: { ko: '중국', en: 'China', ja: '中国', zh: '中国' },
  },
  {
    value: 'TW',
    labels: { ko: '대만', en: 'Taiwan', ja: '台湾', zh: '台湾' },
  },
  {
    value: 'HK',
    labels: { ko: '홍콩', en: 'Hong Kong', ja: '香港', zh: '香港' },
  },
  {
    value: 'SG',
    labels: { ko: '싱가포르', en: 'Singapore', ja: 'シンガポール', zh: '新加坡' },
  },
  {
    value: 'MY',
    labels: { ko: '말레이시아', en: 'Malaysia', ja: 'マレーシア', zh: '马来西亚' },
  },
  {
    value: 'Other',
    labels: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' },
  },
];

export function getLoginModalCopy(locale: string): LoginModalCopy {
  return COPY[normalizeLocale(locale)];
}

export function getLoginModalNationalityOptions(locale: string) {
  const normalizedLocale = normalizeLocale(locale);

  return NATIONALITY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.labels[normalizedLocale],
  }));
}
