export type LoginModalLocale = 'ko' | 'en' | 'ja' | 'zh';

type LocalizedText = Record<LoginModalLocale, string>;

type LoginModalCopy = {
  signupTitle: string;
  signupSubtitle: string;
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
    signupTitle: '계정 생성하기',
    signupSubtitle: '빠르고 간편하게 가입하세요.',
    emailPasswordRequired: '이메일과 비밀번호를 입력해주세요.',
    signupFieldsRequired: '이름, 국적, 연락처, 생년월일, 성별을 모두 입력해주세요.',
    birthDateInvalid: '생년월일 8자리(YYYYMMDD)를 올바르게 입력해주세요.',
    phoneInvalid: '올바른 연락처를 입력해주세요.',
    agreementsRequired: '필수 약관에 동의해주세요.',
    signupSuccess: '회원가입이 완료되었습니다!',
    signupVerificationSent: '가입 인증 메일을 보냈습니다! 이메일을 확인해주세요.',
    invalidCredentials: '이메일 또는 비밀번호가 일치하지 않습니다.',
    emailNotConfirmed: '이메일 인증이 완료되지 않았습니다.',
    rateLimit: '너무 많은 가입 요청이 감지되었습니다. 잠시 후 다시 시도하거나 소셜 로그인을 이용해주세요.',
    loginSuccess: '환영합니다! 로그인 되었습니다.',
    unknownError: '로그인 처리 중 오류가 발생했습니다.',
    realNameLabel: '이름 (실명)',
    phoneFieldLabel: '휴대폰 번호 (- 없이 입력)',
    birthDateFieldLabel: '생년월일 (8자리)',
    selectAll: '전체 동의',
    termsAgreement: '[필수] 서비스 이용약관 동의',
    privacyAgreement: '[필수] 개인정보 수집 및 이용 동의',
    viewLabel: '보기',
    switchToLogin: '이미 계정이 있으신가요? 로그인',
  },
  en: {
    signupTitle: 'Create your account',
    signupSubtitle: 'Sign up in a few simple steps.',
    emailPasswordRequired: 'Please enter your email and password.',
    signupFieldsRequired: 'Please fill in your name, nationality, phone number, birth date, and gender.',
    birthDateInvalid: 'Please enter a valid 8-digit birth date (YYYYMMDD).',
    phoneInvalid: 'Please enter a valid phone number.',
    agreementsRequired: 'Please agree to the required terms.',
    signupSuccess: 'Your account has been created.',
    signupVerificationSent: 'Verification email sent. Please check your inbox.',
    invalidCredentials: 'Your email or password is incorrect.',
    emailNotConfirmed: 'Your email address has not been verified yet.',
    rateLimit: 'Too many sign-up attempts were detected. Please try again later or use social login.',
    loginSuccess: 'Welcome back. You are now logged in.',
    unknownError: 'An error occurred while processing your request.',
    realNameLabel: 'Full name',
    phoneFieldLabel: 'Phone number (numbers only)',
    birthDateFieldLabel: 'Birth date (YYYYMMDD)',
    selectAll: 'Agree to all',
    termsAgreement: '[Required] Agree to Terms of Service',
    privacyAgreement: '[Required] Agree to Privacy Policy',
    viewLabel: 'View',
    switchToLogin: 'Already have an account? Log in',
  },
  ja: {
    signupTitle: 'アカウントを作成',
    signupSubtitle: '数ステップで簡単に登録できます。',
    emailPasswordRequired: 'メールアドレスとパスワードを入力してください。',
    signupFieldsRequired: '氏名、国籍、連絡先、生年月日、性別をすべて入力してください。',
    birthDateInvalid: '生年月日8桁（YYYYMMDD）を正しく入力してください。',
    phoneInvalid: '有効な連絡先を入力してください。',
    agreementsRequired: '必須規約への同意が必要です。',
    signupSuccess: '会員登録が完了しました。',
    signupVerificationSent: '認証メールを送信しました。メールをご確認ください。',
    invalidCredentials: 'メールアドレスまたはパスワードが一致しません。',
    emailNotConfirmed: 'メール認証がまだ完了していません。',
    rateLimit: '登録リクエストが多すぎます。しばらくしてから再試行するか、ソーシャルログインをご利用ください。',
    loginSuccess: 'ログインしました。ようこそ。',
    unknownError: 'ログイン処理中にエラーが発生しました。',
    realNameLabel: '氏名（実名）',
    phoneFieldLabel: '電話番号（ハイフンなし）',
    birthDateFieldLabel: '生年月日（8桁）',
    selectAll: 'すべて同意',
    termsAgreement: '[必須] 利用規約に同意する',
    privacyAgreement: '[必須] 個人情報の収集および利用に同意する',
    viewLabel: '表示',
    switchToLogin: 'すでにアカウントをお持ちですか？ ログイン',
  },
  zh: {
    signupTitle: '创建账号',
    signupSubtitle: '只需几步即可快速注册。',
    emailPasswordRequired: '请输入邮箱和密码。',
    signupFieldsRequired: '请填写姓名、国籍、联系方式、出生日期和性别。',
    birthDateInvalid: '请输入正确的 8 位出生日期（YYYYMMDD）。',
    phoneInvalid: '请输入有效的联系电话。',
    agreementsRequired: '请同意必选条款。',
    signupSuccess: '注册已完成。',
    signupVerificationSent: '验证邮件已发送，请检查邮箱。',
    invalidCredentials: '邮箱或密码不正确。',
    emailNotConfirmed: '邮箱验证尚未完成。',
    rateLimit: '检测到过多注册请求。请稍后再试，或使用社交登录。',
    loginSuccess: '欢迎回来，您已登录。',
    unknownError: '处理登录时发生错误。',
    realNameLabel: '姓名（实名）',
    phoneFieldLabel: '手机号（仅输入数字）',
    birthDateFieldLabel: '出生日期（YYYYMMDD）',
    selectAll: '全部同意',
    termsAgreement: '[必选] 同意服务条款',
    privacyAgreement: '[必选] 同意隐私政策',
    viewLabel: '查看',
    switchToLogin: '已有账号？去登录',
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
