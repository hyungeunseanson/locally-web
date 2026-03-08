export type HostRegisterLocale = 'ko' | 'en' | 'ja' | 'zh';

export type LocalizedText = Record<HostRegisterLocale, string>;

export type HostRegisterLanguageOption = {
  value: string;
  flag: string;
  labels: LocalizedText;
  codeLabels: LocalizedText;
};

type SafetyPolicyItem = {
  icon: 'shield' | 'lock' | 'user' | 'creditCard' | 'checkCircle';
  accentClass: string;
  title: string;
  description: string;
};

type HostRegisterCopy = {
  step1Badge: string;
  step1Title: string;
  step1Desc: string;
  nationalityKorea: string;
  nationalityJapan: string;
  step2Badge: string;
  step2Title: string;
  step2Desc: string;
  languageCertLabel: string;
  languageCertPlaceholder: string;
  step3Badge: string;
  step3Title: string;
  nameLabel: string;
  namePlaceholder: string;
  dobLabel: string;
  dobPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  instagramLabel: string;
  instagramPlaceholder: string;
  sourceLabel: string;
  sourcePlaceholder: string;
  step4Badge: string;
  step4Title: string;
  selfIntroLabel: string;
  selfIntroPlaceholder: string;
  step5Badge: string;
  step5Title: string;
  step5Desc: string;
  idUploadTitle: string;
  idUploadDesc: string;
  chooseFileButton: string;
  uploadDone: string;
  idSecurityNote: string;
  step6Badge: string;
  step6Title: string;
  step6Desc: string;
  bankNameLabel: string;
  bankNamePlaceholder: string;
  accountNumberLabel: string;
  accountNumberPlaceholder: string;
  accountHolderLabel: string;
  accountHolderPlaceholder: string;
  step7Badge: string;
  step7Title: string;
  step7Desc: string;
  motivationPlaceholder: string;
  pledgeText: string;
  step8Badge: string;
  step8Title: string;
  step8Desc: string;
  policyReadCheckbox: string;
  policyAgreeCheckbox: string;
  prevButton: string;
  nextButton: string;
  submitButton: string;
  submittingButton: string;
  validationLanguages: string;
  validationLanguageLevels: string;
  validationAgreements: string;
  loginRequired: string;
  submitSuccess: string;
  submitFailPrefix: string;
  unknownError: string;
  safetyPolicies: SafetyPolicyItem[];
};

export const HOST_REGISTER_LANGUAGE_OPTIONS: HostRegisterLanguageOption[] = [
  {
    value: '한국어',
    flag: '🇰🇷',
    labels: { ko: '한국어', en: 'Korean', ja: '韓国語', zh: '韩语' },
    codeLabels: { ko: '한국어', en: 'Korean', ja: 'Korean', zh: 'Korean' },
  },
  {
    value: '영어',
    flag: '🇺🇸',
    labels: { ko: '영어', en: 'English', ja: '英語', zh: '英语' },
    codeLabels: { ko: '영어', en: 'English', ja: 'English', zh: 'English' },
  },
  {
    value: '일본어',
    flag: '🇯🇵',
    labels: { ko: '일본어', en: 'Japanese', ja: '日本語', zh: '日语' },
    codeLabels: { ko: '일본어', en: 'Japanese', ja: 'Japanese', zh: 'Japanese' },
  },
  {
    value: '중국어',
    flag: '🇨🇳',
    labels: { ko: '중국어', en: 'Chinese', ja: '中国語', zh: '中文' },
    codeLabels: { ko: '중국어', en: 'Chinese', ja: 'Chinese', zh: 'Chinese' },
  },
];

const COPY: Record<HostRegisterLocale, HostRegisterCopy> = {
  ko: {
    step1Badge: 'Step 1. 국적 선택',
    step1Title: '호스트님의 국적은\n어디인가요?',
    step1Desc: '신분증 확인 및 정산 통화 기준이 됩니다.',
    nationalityKorea: '한국인',
    nationalityJapan: '일본인',
    step2Badge: 'Step 2. 구사 언어 및 레벨',
    step2Title: '어떤 언어로 소통이\n가능하신가요?',
    step2Desc: '선택한 각 언어의 레벨을 함께 설정해 주세요.',
    languageCertLabel: '어학 자격증 (선택사항)',
    languageCertPlaceholder: '예) JLPT N1, TOEIC 900',
    step3Badge: 'Step 3. 기본 정보',
    step3Title: '호스트님의\n연락처를 알려주세요',
    nameLabel: '성함 (실명)',
    namePlaceholder: '홍길동',
    dobLabel: '생년월일',
    dobPlaceholder: 'YYYY.MM.DD',
    phoneLabel: '휴대전화 번호',
    phonePlaceholder: '010-1234-5678',
    emailLabel: '이메일 주소',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '가입 경로',
    sourcePlaceholder: '예) 인스타, 지인 추천',
    step4Badge: 'Step 4. 프로필 설정',
    step4Title: '게스트에게 보여질\n모습을 꾸며보세요',
    selfIntroLabel: '자기소개',
    selfIntroPlaceholder: '안녕하세요! 저는 여행과 사진을 좋아하는 호스트입니다. (최소 50자 이상)',
    step5Badge: 'Step 5. 신뢰 인증',
    step5Title: '인증된 호스트\n배지를 받아보세요',
    step5Desc: '신분증을 제출하면 프로필에 인증 배지가 표시됩니다.',
    idUploadTitle: '신분증 업로드',
    idUploadDesc: '주민등록증, 운전면허증, 여권 중 택 1',
    chooseFileButton: '파일 선택하기',
    uploadDone: '업로드 완료',
    idSecurityNote: '* 제출된 신분증 정보는 본인 확인 용도로만 사용되며, 확인 즉시 안전하게 파기됩니다.',
    step6Badge: 'Step 6. 정산 계좌',
    step6Title: '수익을 지급받을\n계좌를 알려주세요',
    step6Desc: '본인 명의의 계좌만 등록 가능합니다.',
    bankNameLabel: '은행명',
    bankNamePlaceholder: '예) 카카오뱅크, 신한은행',
    accountNumberLabel: '계좌번호',
    accountNumberPlaceholder: '- 없이 숫자만 입력',
    accountHolderLabel: '예금주',
    accountHolderPlaceholder: '본인 실명',
    step7Badge: 'Step 7. 신청 사유',
    step7Title: '마지막 질문입니다!',
    step7Desc: '로컬리 호스트가 되고 싶은 이유를 적어주세요.',
    motivationPlaceholder: '예) 외국인 친구들과 교류하는 것을 좋아해서 지원하게 되었습니다.',
    pledgeText: '본인은 로컬리 호스트로서 투명하고 정직하게 활동할 것을 약속하며,\n위 기재된 정보가 사실과 다를 경우 승인이 취소될 수 있음을 확인합니다.',
    step8Badge: 'Step 8. 필수 교육 숙지',
    step8Title: '안전하고 올바른\n호스팅을 위한 서약',
    step8Desc: '제출하기 전 아래 안전 가이드라인을 반드시 정독해 주세요.',
    policyReadCheckbox: '[필수] 위 호스트 안전 가이드라인 및 플랫폼 이용 수칙을 모두 정독하고 숙지하였습니다.',
    policyAgreeCheckbox: '[필수] 위반 시 계정 영구 정지 및 법적 책임이 따를 수 있음에 동의하며,\n로컬리의 정직한 파트너로 활동할 것을 서약합니다.',
    prevButton: '이전',
    nextButton: '다음',
    submitButton: '신청 완료하기',
    submittingButton: '신청 중...',
    validationLanguages: '구사 가능한 언어를 1개 이상 선택해주세요.',
    validationLanguageLevels: '선택한 각 언어의 레벨을 설정해주세요.',
    validationAgreements: '모든 필수 교육 시청 및 서약에 동의해주세요.',
    loginRequired: '로그인이 필요합니다.',
    submitSuccess: '신청이 완료되었습니다! 관리자 승인을 기다려주세요.',
    submitFailPrefix: '신청 중 오류가 발생했습니다: ',
    unknownError: '알 수 없는 오류가 발생했습니다.',
    safetyPolicies: [
      {
        icon: 'shield',
        accentClass: 'text-red-500',
        title: '1. 플랫폼 외부 결제 유도 금지',
        description: '수수료 회피를 목적으로 게스트에게 개인 계좌 이체, 현금 결제, 타 플랫폼 링크를 요구하는 행위는 엄격히 금지됩니다. 적발 시 즉각적인 계정 영구 정지 조치가 내려지며, 누적 예약금을 몰수당할 수 있습니다.',
      },
      {
        icon: 'lock',
        accentClass: 'text-red-500',
        title: '2. 개인정보 교환 제한 및 스팸 차단',
        description: '예약이 확정되기 전(결제 완료 전) 개인 연락처, 카카오톡 아이디, 이메일 등을 사전 교환할 수 없습니다. 안전한 거래를 위해 초기 문의 소통은 모두 로컬리 내부 메시지로 진행하십시오.',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '3. 게스트 상호 안전 매뉴얼',
        description: '활동 중 발생할 수 있는 사고를 대비하여 게스트에게 적절한 안전 장비와 가이드라인을 제공할 책임이 있습니다. 상호 존중 없는 부적절한 차별은 허용되지 않습니다.',
      },
      {
        icon: 'creditCard',
        accentClass: 'text-red-500',
        title: '4. 예약 확정 후 무단 취소 및 노쇼 금지',
        description: '호스트는 예약이 확정된 체험에 대해 정당한 사유 없이 일방적으로 취소하거나, 약속된 시간과 장소에 나타나지 않는 행위를 해서는 안 됩니다. 호스트의 무단 취소 및 노쇼는 게스트의 여행 일정에 큰 피해를 줄 수 있으며, 적발 시 정산 보류, 계정 정지 등의 조치가 이루어질 수 있습니다.',
      },
      {
        icon: 'checkCircle',
        accentClass: 'text-blue-500',
        title: '5. 예약 후 응답 및 일정 안내 의무',
        description: '호스트는 예약 확정 후 게스트의 문의, 일정 확인, 집합 장소 안내 등에 성실히 응답해야 합니다. 핵심 안내를 누락하거나 장시간 응답하지 않아 혼선을 주는 경우 운영상 불이익이 발생할 수 있습니다.',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '6. 체험 내용의 성실 이행 의무',
        description: '호스트는 등록한 체험 설명, 진행 시간, 포함 사항 등의 내용을 실제와 최대한 일치하도록 운영해야 합니다. 고의로 과장된 설명을 등록하거나, 현장에서 사전 안내 없이 체험 내용을 축소·변경하는 행위는 신뢰 위반으로 간주됩니다.',
      },
    ],
  },
  en: {
    step1Badge: 'Step 1. Nationality',
    step1Title: 'What is your\nnationality?',
    step1Desc: 'This is used for identity verification and payout currency.',
    nationalityKorea: 'Korean',
    nationalityJapan: 'Japanese',
    step2Badge: 'Step 2. Languages & Levels',
    step2Title: 'Which languages can\nyou communicate in?',
    step2Desc: 'Please set a level for each selected language.',
    languageCertLabel: 'Language certificate (optional)',
    languageCertPlaceholder: 'e.g. JLPT N1, TOEIC 900',
    step3Badge: 'Step 3. Basic Information',
    step3Title: 'Tell us how to\nreach you',
    nameLabel: 'Full name',
    namePlaceholder: 'John Doe',
    dobLabel: 'Date of birth',
    dobPlaceholder: 'YYYY.MM.DD',
    phoneLabel: 'Phone number',
    phonePlaceholder: '010-1234-5678',
    emailLabel: 'Email address',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: 'How did you hear about us?',
    sourcePlaceholder: 'e.g. Instagram, friend referral',
    step4Badge: 'Step 4. Profile Setup',
    step4Title: 'Shape the profile\nguests will see',
    selfIntroLabel: 'Self introduction',
    selfIntroPlaceholder: 'Hi! I am a host who loves travel and photography. (At least 50 characters)',
    step5Badge: 'Step 5. Verification',
    step5Title: 'Earn a verified host\nbadge',
    step5Desc: 'Upload your ID to show a verified badge on your profile.',
    idUploadTitle: 'Upload your ID',
    idUploadDesc: 'Choose one: ID card, driver’s license, or passport',
    chooseFileButton: 'Choose file',
    uploadDone: 'Uploaded',
    idSecurityNote: '* Submitted ID information is used only for identity verification and will be securely destroyed immediately after review.',
    step6Badge: 'Step 6. Payout Account',
    step6Title: 'Tell us which account\nshould receive payouts',
    step6Desc: 'Only an account under your own name can be registered.',
    bankNameLabel: 'Bank name',
    bankNamePlaceholder: 'e.g. KakaoBank, Shinhan Bank',
    accountNumberLabel: 'Account number',
    accountNumberPlaceholder: 'Numbers only, no dashes',
    accountHolderLabel: 'Account holder',
    accountHolderPlaceholder: 'Your legal name',
    step7Badge: 'Step 7. Motivation',
    step7Title: 'One last question!',
    step7Desc: 'Tell us why you want to become a Locally host.',
    motivationPlaceholder: 'e.g. I love meeting international travelers and sharing local spots.',
    pledgeText: 'I promise to act as a transparent and honest Locally host,\nand I understand that approval may be revoked if any information above is false.',
    step8Badge: 'Step 8. Required Training',
    step8Title: 'Pledge for safe and\nresponsible hosting',
    step8Desc: 'Please read the safety guidelines below carefully before submitting.',
    policyReadCheckbox: '[Required] I have read and understood all host safety guidelines and platform rules above.',
    policyAgreeCheckbox: '[Required] I agree that violations may lead to permanent account suspension and legal responsibility,\nand I pledge to act as an honest Locally partner.',
    prevButton: 'Back',
    nextButton: 'Next',
    submitButton: 'Submit application',
    submittingButton: 'Submitting...',
    validationLanguages: 'Please select at least one language you can speak.',
    validationLanguageLevels: 'Please set a level for each selected language.',
    validationAgreements: 'Please agree to all required training and pledges.',
    loginRequired: 'Login is required.',
    submitSuccess: 'Your application has been submitted! Please wait for admin approval.',
    submitFailPrefix: 'An error occurred while submitting: ',
    unknownError: 'An unknown error occurred.',
    safetyPolicies: [
      {
        icon: 'shield',
        accentClass: 'text-red-500',
        title: '1. No off-platform payment requests',
        description: 'Asking guests to pay by personal transfer, cash, or via another platform to avoid fees is strictly prohibited. Violations can lead to immediate permanent suspension and payout forfeiture.',
      },
      {
        icon: 'lock',
        accentClass: 'text-red-500',
        title: '2. Limits on personal information exchange',
        description: 'Before a booking is confirmed, you may not exchange personal phone numbers, KakaoTalk IDs, or email addresses. Initial communication must stay inside Locally messages.',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '3. Mutual safety manual for guests',
        description: 'You are responsible for providing appropriate safety equipment and guidance when needed. Any discriminatory or disrespectful behavior is not allowed.',
      },
      {
        icon: 'creditCard',
        accentClass: 'text-red-500',
        title: '4. No host no-shows or unjustified cancellations',
        description: 'Hosts must not cancel confirmed experiences without valid reason or fail to appear at the agreed time and place. This may result in payout holds or account suspension.',
      },
      {
        icon: 'checkCircle',
        accentClass: 'text-blue-500',
        title: '5. Duty to respond after booking',
        description: 'After confirmation, hosts must respond sincerely to guest questions, schedule checks, and meeting instructions. Missing key guidance or long delays may lead to operational penalties.',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '6. Faithful delivery of the listed experience',
        description: 'Hosts must operate experiences in close alignment with the listed description, timing, and inclusions. Deliberate exaggeration or unannounced reduction of content is considered a breach of trust.',
      },
    ],
  },
  ja: {
    step1Badge: 'Step 1. 国籍選択',
    step1Title: 'ホスト様の国籍は\nどちらですか？',
    step1Desc: '本人確認および精算通貨の基準になります。',
    nationalityKorea: '韓国籍',
    nationalityJapan: '日本国籍',
    step2Badge: 'Step 2. 対応言語とレベル',
    step2Title: 'どの言語で\nコミュニケーションできますか？',
    step2Desc: '選択した各言語のレベルも設定してください。',
    languageCertLabel: '語学資格（任意）',
    languageCertPlaceholder: '例）JLPT N1, TOEIC 900',
    step3Badge: 'Step 3. 基本情報',
    step3Title: '連絡先を\n教えてください',
    nameLabel: '氏名（実名）',
    namePlaceholder: '山田 太郎',
    dobLabel: '生年月日',
    dobPlaceholder: 'YYYY.MM.DD',
    phoneLabel: '携帯電話番号',
    phonePlaceholder: '010-1234-5678',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '登録経路',
    sourcePlaceholder: '例）Instagram、知人の紹介',
    step4Badge: 'Step 4. プロフィール設定',
    step4Title: 'ゲストに見える\nプロフィールを整えましょう',
    selfIntroLabel: '自己紹介',
    selfIntroPlaceholder: 'こんにちは！旅行と写真が好きなホストです。（50文字以上推奨）',
    step5Badge: 'Step 5. 信頼認証',
    step5Title: '認証済みホスト\nバッジを獲得しましょう',
    step5Desc: '身分証を提出すると、プロフィールに認証バッジが表示されます。',
    idUploadTitle: '身分証アップロード',
    idUploadDesc: '住民登録証、運転免許証、パスポートのいずれか1つ',
    chooseFileButton: 'ファイルを選択',
    uploadDone: 'アップロード完了',
    idSecurityNote: '* 提出された身分証情報は本人確認の目的にのみ使用され、確認後すぐに安全に破棄されます。',
    step6Badge: 'Step 6. 精算口座',
    step6Title: '収益を受け取る\n口座を教えてください',
    step6Desc: 'ご本人名義の口座のみ登録できます。',
    bankNameLabel: '銀行名',
    bankNamePlaceholder: '例）楽天銀行、三井住友銀行',
    accountNumberLabel: '口座番号',
    accountNumberPlaceholder: 'ハイフンなしの数字のみ',
    accountHolderLabel: '口座名義',
    accountHolderPlaceholder: '本人の実名',
    step7Badge: 'Step 7. 応募理由',
    step7Title: '最後の質問です！',
    step7Desc: 'Locally ホストになりたい理由を書いてください。',
    motivationPlaceholder: '例）海外から来る旅行者と交流し、地元の魅力を紹介したいからです。',
    pledgeText: '私は Locally ホストとして透明かつ誠実に活動することを約束し、\n上記の情報が事実と異なる場合は承認が取り消されることを確認します。',
    step8Badge: 'Step 8. 必須教育の確認',
    step8Title: '安全で正しい\nホスティングのための誓約',
    step8Desc: '提出前に、以下の安全ガイドラインを必ず熟読してください。',
    policyReadCheckbox: '[必須] 上記のホスト安全ガイドラインおよびプラットフォーム利用規則をすべて読み、理解しました。',
    policyAgreeCheckbox: '[必須] 違反時にはアカウント永久停止および法的責任が生じる可能性があることに同意し、\nLocally の誠実なパートナーとして活動することを誓います。',
    prevButton: '戻る',
    nextButton: '次へ',
    submitButton: '申請を完了する',
    submittingButton: '申請中...',
    validationLanguages: '対応可能な言語を1つ以上選択してください。',
    validationLanguageLevels: '選択した各言語のレベルを設定してください。',
    validationAgreements: 'すべての必須教育および誓約に同意してください。',
    loginRequired: 'ログインが必要です。',
    submitSuccess: '申請が完了しました！管理者の承認をお待ちください。',
    submitFailPrefix: '申請中にエラーが発生しました: ',
    unknownError: '不明なエラーが発生しました。',
    safetyPolicies: [
      {
        icon: 'shield',
        accentClass: 'text-red-500',
        title: '1. プラットフォーム外での支払い誘導の禁止',
        description: '手数料回避を目的に、個人口座振込、現金決済、他プラットフォームのリンクをゲストに要求する行為は厳しく禁止されます。発覚した場合、即時のアカウント永久停止および売上没収の対象となる場合があります。',
      },
      {
        icon: 'lock',
        accentClass: 'text-red-500',
        title: '2. 個人情報交換の制限とスパム防止',
        description: '予約確定前（決済完了前）には、個人の連絡先、カカオトーク ID、メールアドレスなどを事前交換できません。初期のやり取りは必ず Locally 内メッセージで行ってください。',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '3. ゲスト相互安全マニュアル',
        description: '活動中の事故に備え、必要に応じて適切な安全装備とガイドラインを提供する責任があります。相互尊重のない不適切な差別は認められません。',
      },
      {
        icon: 'creditCard',
        accentClass: 'text-red-500',
        title: '4. 予約確定後の無断キャンセル・ノーショー禁止',
        description: 'ホストは正当な理由なく予約確定済みの体験を一方的にキャンセルしたり、約束した時間と場所に現れなかったりしてはいけません。違反時には精算保留やアカウント停止などの措置が取られる可能性があります。',
      },
      {
        icon: 'checkCircle',
        accentClass: 'text-blue-500',
        title: '5. 予約後の応答および案内義務',
        description: 'ホストは予約確定後、ゲストからの問い合わせ、日程確認、集合場所案内などに誠実に対応しなければなりません。重要な案内の漏れや長時間の未応答は運営上の不利益につながる場合があります。',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '6. 体験内容の誠実な履行義務',
        description: '登録した体験説明、進行時間、含まれる内容などは実際の運営とできる限り一致させてください。意図的に誇張した説明や、現場で事前案内なく内容を縮小・変更する行為は信頼違反とみなされます。',
      },
    ],
  },
  zh: {
    step1Badge: 'Step 1. 国籍选择',
    step1Title: '您的国籍是\n哪里？',
    step1Desc: '这将作为身份验证和结算币种的基准。',
    nationalityKorea: '韩国籍',
    nationalityJapan: '日本籍',
    step2Badge: 'Step 2. 可使用语言与等级',
    step2Title: '您可以使用哪些语言\n进行沟通？',
    step2Desc: '请选择语言后，同时设置对应等级。',
    languageCertLabel: '语言资格证书（可选）',
    languageCertPlaceholder: '例如：JLPT N1, TOEIC 900',
    step3Badge: 'Step 3. 基本信息',
    step3Title: '请告诉我们\n您的联系方式',
    nameLabel: '姓名（实名）',
    namePlaceholder: '张三',
    dobLabel: '出生日期',
    dobPlaceholder: 'YYYY.MM.DD',
    phoneLabel: '手机号码',
    phonePlaceholder: '010-1234-5678',
    emailLabel: '电子邮箱',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '了解渠道',
    sourcePlaceholder: '例如：Instagram、朋友推荐',
    step4Badge: 'Step 4. 个人资料设置',
    step4Title: '完善房客将看到的\n个人形象',
    selfIntroLabel: '自我介绍',
    selfIntroPlaceholder: '你好！我是喜欢旅行和摄影的房东。（建议至少50字）',
    step5Badge: 'Step 5. 信任认证',
    step5Title: '获得认证房东\n徽章',
    step5Desc: '提交身份证件后，个人资料上会显示认证徽章。',
    idUploadTitle: '上传身份证件',
    idUploadDesc: '身份证、驾驶证、护照三选一',
    chooseFileButton: '选择文件',
    uploadDone: '上传完成',
    idSecurityNote: '* 提交的身份证件信息仅用于身份验证，审核完成后将立即安全销毁。',
    step6Badge: 'Step 6. 结算账户',
    step6Title: '请填写用于收款的\n账户信息',
    step6Desc: '仅可登记本人名下账户。',
    bankNameLabel: '银行名称',
    bankNamePlaceholder: '例如：KakaoBank、Shinhan Bank',
    accountNumberLabel: '账号',
    accountNumberPlaceholder: '仅输入数字，不含连字符',
    accountHolderLabel: '账户持有人',
    accountHolderPlaceholder: '本人实名',
    step7Badge: 'Step 7. 申请理由',
    step7Title: '最后一个问题！',
    step7Desc: '请写下你想成为 Locally 房东的原因。',
    motivationPlaceholder: '例如：我喜欢与外国游客交流，并介绍本地独特的地方。',
    pledgeText: '本人承诺将作为 Locally 房东以透明、诚实的方式活动，\n并确认如上述信息与事实不符，审批可能被取消。',
    step8Badge: 'Step 8. 必修培训确认',
    step8Title: '为了安全且正确的\n接待而做出的承诺',
    step8Desc: '提交前请务必仔细阅读以下安全指南。',
    policyReadCheckbox: '[必填] 我已完整阅读并理解上述房东安全指南及平台使用规则。',
    policyAgreeCheckbox: '[必填] 我同意如有违规，账号可能被永久停用并承担法律责任，\n并承诺作为 Locally 的诚信合作伙伴开展活动。',
    prevButton: '上一步',
    nextButton: '下一步',
    submitButton: '完成申请',
    submittingButton: '提交中...',
    validationLanguages: '请至少选择一种可使用语言。',
    validationLanguageLevels: '请为每种已选语言设置等级。',
    validationAgreements: '请同意所有必修培训和承诺。',
    loginRequired: '需要登录。',
    submitSuccess: '申请已提交完成！请等待管理员审核。',
    submitFailPrefix: '申请过程中发生错误：',
    unknownError: '发生未知错误。',
    safetyPolicies: [
      {
        icon: 'shield',
        accentClass: 'text-red-500',
        title: '1. 禁止引导平台外支付',
        description: '为规避手续费而要求房客进行私人账户转账、现金支付或跳转其他平台付款的行为将被严格禁止。若被发现，可能会被立即永久停用账号并没收累计预约收入。',
      },
      {
        icon: 'lock',
        accentClass: 'text-red-500',
        title: '2. 限制交换个人信息并防止骚扰',
        description: '在预约确认前（付款完成前），不得提前交换个人联系方式、KakaoTalk ID、邮箱等信息。为保证交易安全，初期沟通必须在 Locally 站内消息中进行。',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '3. 房客共同安全守则',
        description: '为应对活动中可能发生的事故，房东有责任在需要时提供适当的安全装备和说明。不尊重他人的不当歧视行为不被允许。',
      },
      {
        icon: 'creditCard',
        accentClass: 'text-red-500',
        title: '4. 预约确认后禁止无故取消或爽约',
        description: '房东不得在无正当理由的情况下单方面取消已确认的体验，也不得在约定时间地点缺席。若发生此类情况，可能会被暂停结算或停用账号。',
      },
      {
        icon: 'checkCircle',
        accentClass: 'text-blue-500',
        title: '5. 预约后的回复与行程说明义务',
        description: '预约确认后，房东必须认真回复房客的咨询、日程确认以及集合地点说明。若遗漏关键信息或长时间不回复，可能会带来运营上的不利影响。',
      },
      {
        icon: 'user',
        accentClass: 'text-blue-500',
        title: '6. 诚信履行体验内容',
        description: '房东应尽量确保实际运营与已发布的体验说明、时长、包含内容一致。故意夸大描述或现场在未提前说明的情况下缩减、变更体验内容，将被视为违背信任。',
      },
    ],
  },
};

export function normalizeHostRegisterLocale(lang: string): HostRegisterLocale {
  if (lang === 'en' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
}

export function getLocalizedText(text: LocalizedText, lang: string): string {
  return text[normalizeHostRegisterLocale(lang)];
}

export function getHostRegisterCopy(lang: string): HostRegisterCopy {
  return COPY[normalizeHostRegisterLocale(lang)];
}
