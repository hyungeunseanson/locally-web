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
  step3Desc: string;
  nameLabel: string;
  namePlaceholder: string;
  nameHelp: string;
  dobLabel: string;
  dobPlaceholder: string;
  dobHelp: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneHelp: string;
  emailLabel: string;
  emailPlaceholder: string;
  instagramLabel: string;
  instagramPlaceholder: string;
  sourceLabel: string;
  sourcePlaceholder: string;
  step4Badge: string;
  step4Title: string;
  step4Desc: string;
  profilePhotoHelp: string;
  selfIntroLabel: string;
  selfIntroHelp: string;
  selfIntroGuideTitle: string;
  selfIntroGuideBody: string;
  selfIntroPlaceholder: string;
  step5Badge: string;
  step5Title: string;
  step5Desc: string;
  idUploadTitle: string;
  idUploadDesc: string;
  idUploadHelpTitle: string;
  idUploadHelpBody: string;
  chooseFileButton: string;
  uploadDone: string;
  idSecurityNote: string;
  step6Badge: string;
  step6Title: string;
  step6Desc: string;
  bankNameLabel: string;
  bankNamePlaceholder: string;
  bankNameHelp: string;
  bankNameInlineShort: string;
  accountNumberLabel: string;
  accountNumberPlaceholder: string;
  accountNumberHelp: string;
  accountNumberInlineShort: string;
  accountHolderLabel: string;
  accountHolderPlaceholder: string;
  accountHolderHelp: string;
  accountHolderInlineShort: string;
  payoutGuideTitle: string;
  payoutGuideBody: string;
  step7Badge: string;
  step7Title: string;
  step7Desc: string;
  motivationHelp: string;
  motivationInlineShort: string;
  motivationInlineReady: string;
  motivationGuideTitle: string;
  motivationGuideBody: string;
  motivationPlaceholder: string;
  pledgeText: string;
  step8Badge: string;
  step8Title: string;
  step8Desc: string;
  step8Summary1: string;
  step8Summary2: string;
  step8Summary3: string;
  step8DetailsToggle: string;
  policyReadCheckbox: string;
  policyAgreeCheckbox: string;
  prevButton: string;
  nextButton: string;
  submitButton: string;
  submittingButton: string;
  validationLanguages: string;
  validationLanguageLevels: string;
  validationNationality: string;
  validationName: string;
  validationDob: string;
  validationDobFormat: string;
  validationPhone: string;
  validationPhoneFormat: string;
  validationEmail: string;
  validationEmailFormat: string;
  validationSelfIntro: string;
  validationIdCard: string;
  validationBankName: string;
  validationAccountNumber: string;
  validationAccountHolder: string;
  validationMotivation: string;
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
    step3Desc: '정확한 기본 정보는 승인 검토와 중요한 일정 안내에 사용됩니다.',
    nameLabel: '성함 (실명)',
    namePlaceholder: '홍길동',
    nameHelp: '정산과 신원 확인에 사용되는 이름입니다. 신분증 정보와 일치하게 입력해주세요.',
    dobLabel: '생년월일',
    dobPlaceholder: 'YYYY.MM.DD',
    dobHelp: '성인 확인과 기본 신원 검토에 사용됩니다.',
    phoneLabel: '휴대전화 번호',
    phonePlaceholder: '010-1234-5678',
    phoneHelp: '운영팀과 게스트가 중요한 일정 변경 시 연락할 수 있는 번호예요.',
    emailLabel: '이메일 주소',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '가입 경로',
    sourcePlaceholder: '예) 인스타, 지인 추천',
    step4Badge: 'Step 4. 프로필 설정',
    step4Title: '게스트에게 보여질\n모습을 꾸며보세요',
    step4Desc: '게스트가 안심하고 예약할 수 있도록, 믿음 가는 첫인상을 만들어주세요.',
    profilePhotoHelp: '게스트가 가장 먼저 보는 사진이에요. 얼굴이 잘 보이는 밝은 사진을 권장합니다.',
    selfIntroLabel: '자기소개',
    selfIntroHelp: '보여주고 싶은 게스트의 언어로 작성해주세요. 예: 한국인 게스트에게 보여주고 싶다면 한국어로 작성하면 됩니다.',
    selfIntroGuideTitle: '어떤 소개가 좋은가요?',
    selfIntroGuideBody: '내가 어떤 분위기의 호스트인지, 어떤 게스트와 잘 맞는지, 체험에서 어떤 시간을 만들어주고 싶은지를 짧고 자연스럽게 적어주세요. 너무 짧거나 추상적인 소개보다 실제로 함께할 장면이 떠오르는 소개가 더 좋습니다.',
    selfIntroPlaceholder: '안녕하세요! 저는 여행과 사진을 좋아하는 호스트입니다. (최소 50자 이상)',
    step5Badge: 'Step 5. 신뢰 인증',
    step5Title: '인증된 호스트\n배지를 받아보세요',
    step5Desc: '신분증을 제출하면 프로필에 인증 배지가 표시됩니다.',
    idUploadTitle: '신분증 업로드',
    idUploadDesc: '주민등록증, 운전면허증, 여권 중 택 1',
    idUploadHelpTitle: '왜 신분증이 필요한가요?',
    idUploadHelpBody: '신분증은 승인 검토와 본인 확인에만 사용되며 게스트에게 공개되지 않습니다. 이름과 사진이 잘 보이도록 올려주시면 검토가 더 빠르고 정확해집니다.',
    chooseFileButton: '파일 선택하기',
    uploadDone: '업로드 완료',
    idSecurityNote: '* 제출된 신분증 정보는 본인 확인 용도로만 사용되며, 확인 즉시 안전하게 파기됩니다.',
    step6Badge: 'Step 6. 정산 계좌',
    step6Title: '수익을 지급받을\n계좌를 알려주세요',
    step6Desc: '본인 명의의 계좌만 등록 가능합니다.',
    bankNameLabel: '은행명',
    bankNamePlaceholder: '예) 카카오뱅크, 신한은행 / みずほ銀行(渋谷支店)',
    bankNameHelp: '정산 지급에 사용됩니다. 지점명이 필요한 계좌는 은행명 칸에 함께 적어주세요.',
    bankNameInlineShort: '은행명을 조금 더 정확하게 적어주세요.',
    accountNumberLabel: '계좌번호',
    accountNumberPlaceholder: '- 없이 숫자만 입력',
    accountNumberHelp: '숫자만 정확히 입력해주세요. 잘못 입력하면 재확인이 필요할 수 있습니다.',
    accountNumberInlineShort: '계좌번호 숫자를 다시 확인해주세요.',
    accountHolderLabel: '예금주',
    accountHolderPlaceholder: '본인 실명',
    accountHolderHelp: '신분증과 동일한 본인 실명으로 입력해주세요.',
    accountHolderInlineShort: '예금주명은 신분증과 같은 실명으로 입력해주세요.',
    payoutGuideTitle: '정산 계좌 입력 전 확인해주세요',
    payoutGuideBody: '계좌 정보는 수익 정산에 바로 연결됩니다. 은행명, 계좌번호, 예금주가 실제 정보와 다르면 지급이 지연될 수 있어요. 본인 명의 계좌를 정확히 입력하는 것이 가장 중요합니다.',
    step7Badge: 'Step 7. 신청 사유',
    step7Title: '마지막 질문입니다!',
    step7Desc: '로컬리 호스트가 되고 싶은 이유를 적어주세요.',
    motivationHelp: '어떤 게스트에게 어떤 경험을 주고 싶은지 구체적으로 적어주시면 검토에 도움이 됩니다.',
    motivationInlineShort: '지원 동기가 아직 짧아요. 어떤 게스트에게 어떤 경험을 주고 싶은지 한두 문장 더 적어주세요.',
    motivationInlineReady: '좋아요. 이 정도면 왜 호스트가 되고 싶은지 더 잘 전달됩니다.',
    motivationGuideTitle: '좋은 신청 사유 예시',
    motivationGuideBody: '단순히 “외국인을 만나보고 싶어서”보다, 내가 잘 안내할 수 있는 지역이나 주제, 어떤 게스트에게 어떤 시간을 만들어주고 싶은지까지 적어주시면 훨씬 설득력이 높아집니다.',
    motivationPlaceholder: '예) 외국인 친구들과 교류하는 것을 좋아해서 지원하게 되었습니다.',
    pledgeText: '본인은 로컬리 호스트로서 투명하고 정직하게 활동할 것을 약속하며,\n위 기재된 정보가 사실과 다를 경우 승인이 취소될 수 있음을 확인합니다.',
    step8Badge: 'Step 8. 필수 교육 숙지',
    step8Title: '안전하고 올바른\n호스팅을 위한 서약',
    step8Desc: '제출하기 전 아래 안전 가이드라인을 반드시 정독해 주세요.',
    step8Summary1: '예약 확정 후 무응답, 무단 취소, 노쇼는 게스트 여행에 직접적인 피해를 줍니다.',
    step8Summary2: '플랫폼 외부 결제 유도, 개인정보 선교환, 허위 안내는 신뢰 위반으로 간주됩니다.',
    step8Summary3: '등록 내용과 실제 진행 내용을 최대한 일치시켜야 게스트 신뢰와 승인 품질이 유지됩니다.',
    step8DetailsToggle: '전체 안전 가이드라인 자세히 보기',
    policyReadCheckbox: '[필수] 위 호스트 안전 가이드라인 및 플랫폼 이용 수칙을 모두 정독하고 숙지하였습니다.',
    policyAgreeCheckbox: '[필수] 위반 시 계정 영구 정지 및 법적 책임이 따를 수 있음에 동의하며,\n로컬리의 정직한 파트너로 활동할 것을 서약합니다.',
    prevButton: '이전',
    nextButton: '다음',
    submitButton: '신청 완료하기',
    submittingButton: '신청 중...',
    validationLanguages: '구사 가능한 언어를 1개 이상 선택해주세요.',
    validationLanguageLevels: '선택한 각 언어의 레벨을 설정해주세요.',
    validationNationality: '국적을 선택해주세요.',
    validationName: '실명을 입력해주세요.',
    validationDob: '생년월일을 입력해주세요.',
    validationDobFormat: '생년월일은 YYYY.MM.DD 형식으로 입력해주세요.',
    validationPhone: '연락 가능한 휴대전화 번호를 입력해주세요.',
    validationPhoneFormat: '휴대전화 번호 형식을 다시 확인해주세요.',
    validationEmail: '이메일 주소를 입력해주세요.',
    validationEmailFormat: '올바른 이메일 주소를 입력해주세요.',
    validationSelfIntro: '자기소개는 50자 이상 작성해주세요.',
    validationIdCard: '신분증 이미지를 업로드해주세요.',
    validationBankName: '은행명을 입력해주세요.',
    validationAccountNumber: '계좌번호를 입력해주세요.',
    validationAccountHolder: '예금주명을 입력해주세요.',
    validationMotivation: '호스트 지원 동기를 작성해주세요.',
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
    step3Desc: 'Accurate basics are used for review and important scheduling updates.',
    nameLabel: 'Full name',
    namePlaceholder: 'John Doe',
    nameHelp: 'This name is used for identity review and payouts. Please match your ID.',
    dobLabel: 'Date of birth',
    dobPlaceholder: 'YYYY.MM.DD',
    dobHelp: 'This is used for adult verification and basic identity review.',
    phoneLabel: 'Phone number',
    phonePlaceholder: '010-1234-5678',
    phoneHelp: 'We may use this number for urgent updates about schedules or guests.',
    emailLabel: 'Email address',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: 'How did you hear about us?',
    sourcePlaceholder: 'e.g. Instagram, friend referral',
    step4Badge: 'Step 4. Profile Setup',
    step4Title: 'Shape the profile\nguests will see',
    step4Desc: 'Help guests feel comfortable booking with you by creating a warm first impression.',
    profilePhotoHelp: 'This is often the first image guests notice. A bright photo with your face clearly visible works best.',
    selfIntroLabel: 'Self introduction',
    selfIntroHelp: 'Write this in the language of the guests you want to show it to. Example: if you want Korean guests to read it, write it in Korean.',
    selfIntroGuideTitle: 'What makes a good introduction?',
    selfIntroGuideBody: 'Briefly explain what kind of host you are, what kind of guests you enjoy meeting, and what kind of time you want to create. Concrete and natural introductions work better than vague one-liners.',
    selfIntroPlaceholder: 'Hi! I am a host who loves travel and photography. (At least 50 characters)',
    step5Badge: 'Step 5. Verification',
    step5Title: 'Earn a verified host\nbadge',
    step5Desc: 'Upload your ID to show a verified badge on your profile.',
    idUploadTitle: 'Upload your ID',
    idUploadDesc: 'Choose one: ID card, driver’s license, or passport',
    idUploadHelpTitle: 'Why do we ask for an ID?',
    idUploadHelpBody: 'Your ID is only used for review and identity verification, and it is never shown to guests. Clear photos with your name and image visible help us review your application more quickly.',
    chooseFileButton: 'Choose file',
    uploadDone: 'Uploaded',
    idSecurityNote: '* Submitted ID information is used only for identity verification and will be securely destroyed immediately after review.',
    step6Badge: 'Step 6. Payout Account',
    step6Title: 'Tell us which account\nshould receive payouts',
    step6Desc: 'Only an account under your own name can be registered.',
    bankNameLabel: 'Bank name',
    bankNamePlaceholder: 'e.g. KakaoBank, Shinhan Bank / Mizuho Bank (Shibuya Branch)',
    bankNameHelp: 'This is used for payouts. If your account needs a branch name, include it in the bank name field.',
    bankNameInlineShort: 'Please enter the bank name a little more clearly.',
    accountNumberLabel: 'Account number',
    accountNumberPlaceholder: 'Numbers only, no dashes',
    accountNumberHelp: 'Please enter digits only and make sure the number is exact. Mistakes may require manual re-checking.',
    accountNumberInlineShort: 'Please double-check the account number digits.',
    accountHolderLabel: 'Account holder',
    accountHolderPlaceholder: 'Your legal name',
    accountHolderHelp: 'Please use the same legal name shown on your ID.',
    accountHolderInlineShort: 'Please enter the account holder name exactly as shown on your ID.',
    payoutGuideTitle: 'Before you enter your payout account',
    payoutGuideBody: 'Your bank details are directly tied to settlement. If the bank name, account number, or account holder is incorrect, payouts can be delayed. An account in your own name is the safest option.',
    step7Badge: 'Step 7. Motivation',
    step7Title: 'One last question!',
    step7Desc: 'Tell us why you want to become a Locally host.',
    motivationHelp: 'Specific answers about the guests you want to host and the experience you want to create help with review.',
    motivationInlineShort: 'Your reason is still a bit short. Add one or two more sentences about the guests you want to host and the experience you want to create.',
    motivationInlineReady: 'Good. This already explains your hosting motivation much more clearly.',
    motivationGuideTitle: 'A stronger example',
    motivationGuideBody: 'Instead of only saying you want to meet travelers, explain what neighborhood or topic you can guide well, and what kind of time you want your guests to have. Specific motivations are much more convincing.',
    motivationPlaceholder: 'e.g. I love meeting international travelers and sharing local spots.',
    pledgeText: 'I promise to act as a transparent and honest Locally host,\nand I understand that approval may be revoked if any information above is false.',
    step8Badge: 'Step 8. Required Training',
    step8Title: 'Pledge for safe and\nresponsible hosting',
    step8Desc: 'Please read the safety guidelines below carefully before submitting.',
    step8Summary1: 'No-shows, careless cancellations, and long silence after confirmation directly damage a guest’s trip.',
    step8Summary2: 'Off-platform payments, early contact sharing, and misleading information are treated as trust violations.',
    step8Summary3: 'Your actual hosting should match what you register so guests can book with confidence.',
    step8DetailsToggle: 'Read the full safety guidelines',
    policyReadCheckbox: '[Required] I have read and understood all host safety guidelines and platform rules above.',
    policyAgreeCheckbox: '[Required] I agree that violations may lead to permanent account suspension and legal responsibility,\nand I pledge to act as an honest Locally partner.',
    prevButton: 'Back',
    nextButton: 'Next',
    submitButton: 'Submit application',
    submittingButton: 'Submitting...',
    validationLanguages: 'Please select at least one language you can speak.',
    validationLanguageLevels: 'Please set a level for each selected language.',
    validationNationality: 'Please select your nationality.',
    validationName: 'Please enter your legal name.',
    validationDob: 'Please enter your date of birth.',
    validationDobFormat: 'Enter your date of birth in YYYY.MM.DD format.',
    validationPhone: 'Please enter a phone number we can reach.',
    validationPhoneFormat: 'Please check your phone number format.',
    validationEmail: 'Please enter your email address.',
    validationEmailFormat: 'Please enter a valid email address.',
    validationSelfIntro: 'Please write at least 50 characters for your self-introduction.',
    validationIdCard: 'Please upload your ID image.',
    validationBankName: 'Please enter your bank name.',
    validationAccountNumber: 'Please enter your account number.',
    validationAccountHolder: 'Please enter the account holder name.',
    validationMotivation: 'Please tell us why you want to host with Locally.',
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
    step3Desc: '正確な基本情報は審査と重要なお知らせの案内に使われます。',
    nameLabel: '氏名（実名）',
    namePlaceholder: '山田 太郎',
    nameHelp: '本人確認と精算に使われる名前です。身分証の情報と一致させてください。',
    dobLabel: '生年月日',
    dobPlaceholder: 'YYYY.MM.DD',
    dobHelp: '成人確認と基本的な本人確認に使用されます。',
    phoneLabel: '携帯電話番号',
    phonePlaceholder: '010-1234-5678',
    phoneHelp: '運営やゲストが重要な予定変更時に連絡できる番号です。',
    emailLabel: 'メールアドレス',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '登録経路',
    sourcePlaceholder: '例）Instagram、知人の紹介',
    step4Badge: 'Step 4. プロフィール設定',
    step4Title: 'ゲストに見える\nプロフィールを整えましょう',
    step4Desc: 'ゲストが安心して予約できるよう、信頼できる第一印象を作ってください。',
    profilePhotoHelp: 'ゲストが最初に目にしやすい写真です。顔がはっきり見える明るい写真がおすすめです。',
    selfIntroLabel: '自己紹介',
    selfIntroHelp: '見せたいゲストの言語で作成してください。例：韓国人ゲストに見せたい場合は韓国語で作成してください。',
    selfIntroGuideTitle: '良い自己紹介のコツ',
    selfIntroGuideBody: 'どんな雰囲気のホストなのか、どんなゲストと相性が良いのか、どんな時間を作りたいのかを自然に書いてください。短すぎる一文より、実際の体験が想像できる紹介のほうが伝わります。',
    selfIntroPlaceholder: 'こんにちは！旅行と写真が好きなホストです。（50文字以上推奨）',
    step5Badge: 'Step 5. 信頼認証',
    step5Title: '認証済みホスト\nバッジを獲得しましょう',
    step5Desc: '身分証を提出すると、プロフィールに認証バッジが表示されます。',
    idUploadTitle: '身分証アップロード',
    idUploadDesc: '住民登録証、運転免許証、パスポートのいずれか1つ',
    idUploadHelpTitle: 'なぜ身分証が必要ですか？',
    idUploadHelpBody: '身分証は審査と本人確認のためだけに使われ、ゲストには公開されません。氏名と写真がはっきり見える画像をアップロードしていただくと、審査がより早く正確になります。',
    chooseFileButton: 'ファイルを選択',
    uploadDone: 'アップロード完了',
    idSecurityNote: '* 提出された身分証情報は本人確認の目的にのみ使用され、確認後すぐに安全に破棄されます。',
    step6Badge: 'Step 6. 精算口座',
    step6Title: '収益を受け取る\n口座を教えてください',
    step6Desc: 'ご本人名義の口座のみ登録できます。',
    bankNameLabel: '銀行名',
    bankNamePlaceholder: '例）楽天銀行、三井住友銀行 / みずほ銀行（渋谷支店）',
    bankNameHelp: '精算金の支払いに使われます。支店名が必要な口座は、銀行名欄にあわせて入力してください。',
    bankNameInlineShort: '銀行名をもう少し正確に入力してください。',
    accountNumberLabel: '口座番号',
    accountNumberPlaceholder: 'ハイフンなしの数字のみ',
    accountNumberHelp: '数字のみ正確に入力してください。誤りがあると再確認が必要になる場合があります。',
    accountNumberInlineShort: '口座番号の数字をもう一度確認してください。',
    accountHolderLabel: '口座名義',
    accountHolderPlaceholder: '本人の実名',
    accountHolderHelp: '身分証と同じ本人の実名を入力してください。',
    accountHolderInlineShort: '口座名義は身分証と同じ実名で入力してください。',
    payoutGuideTitle: '口座入力の前にご確認ください',
    payoutGuideBody: '口座情報は収益精算に直接使われます。銀行名、口座番号、名義が実際の情報と異なると支払いが遅れることがあります。本人名義の口座を正確に入力することが重要です。',
    step7Badge: 'Step 7. 応募理由',
    step7Title: '最後の質問です！',
    step7Desc: 'Locally ホストになりたい理由を書いてください。',
    motivationHelp: 'どんなゲストにどんな体験を届けたいのかを具体的に書くと、審査に役立ちます。',
    motivationInlineShort: '応募理由がまだ少し短いです。どんなゲストにどんな体験を届けたいのかをもう一、二文足してください。',
    motivationInlineReady: '良い内容です。ホストになりたい理由がより伝わりやすくなっています。',
    motivationGuideTitle: '良い応募理由の例',
    motivationGuideBody: '単に「旅行者と交流したい」だけでなく、自分が案内しやすい地域やテーマ、どんな時間を作りたいかまで書くと、ずっと説得力が高まります。',
    motivationPlaceholder: '例）海外から来る旅行者と交流し、地元の魅力を紹介したいからです。',
    pledgeText: '私は Locally ホストとして透明かつ誠実に活動することを約束し、\n上記の情報が事実と異なる場合は承認が取り消されることを確認します。',
    step8Badge: 'Step 8. 必須教育の確認',
    step8Title: '安全で正しい\nホスティングのための誓約',
    step8Desc: '提出前に、以下の安全ガイドラインを必ず熟読してください。',
    step8Summary1: '予約確定後の無応答、無断キャンセル、ノーショーはゲストの旅行に直接被害を与えます。',
    step8Summary2: 'プラットフォーム外決済の誘導、早期の連絡先交換、誤解を招く案内は信頼違反とみなされます。',
    step8Summary3: '登録内容と実際の運営内容をできるだけ一致させることが、ゲストの安心につながります。',
    step8DetailsToggle: '安全ガイドライン全文を見る',
    policyReadCheckbox: '[必須] 上記のホスト安全ガイドラインおよびプラットフォーム利用規則をすべて読み、理解しました。',
    policyAgreeCheckbox: '[必須] 違反時にはアカウント永久停止および法的責任が生じる可能性があることに同意し、\nLocally の誠実なパートナーとして活動することを誓います。',
    prevButton: '戻る',
    nextButton: '次へ',
    submitButton: '申請を完了する',
    submittingButton: '申請中...',
    validationLanguages: '対応可能な言語を1つ以上選択してください。',
    validationLanguageLevels: '選択した各言語のレベルを設定してください。',
    validationNationality: '国籍を選択してください。',
    validationName: '実名を入力してください。',
    validationDob: '生年月日を入力してください。',
    validationDobFormat: '生年月日は YYYY.MM.DD 形式で入力してください。',
    validationPhone: '連絡可能な電話番号を入力してください。',
    validationPhoneFormat: '電話番号の形式をもう一度ご確認ください。',
    validationEmail: 'メールアドレスを入力してください。',
    validationEmailFormat: '正しいメールアドレスを入力してください。',
    validationSelfIntro: '自己紹介は50文字以上で入力してください。',
    validationIdCard: '本人確認書類の画像をアップロードしてください。',
    validationBankName: '銀行名を入力してください。',
    validationAccountNumber: '口座番号を入力してください。',
    validationAccountHolder: '口座名義を入力してください。',
    validationMotivation: 'ホスト応募の理由を入力してください。',
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
    step3Desc: '准确的基本信息会用于审核和重要日程通知。',
    nameLabel: '姓名（实名）',
    namePlaceholder: '张三',
    nameHelp: '该姓名会用于身份审核和结算，请与证件信息保持一致。',
    dobLabel: '出生日期',
    dobPlaceholder: 'YYYY.MM.DD',
    dobHelp: '用于成年确认和基础身份审核。',
    phoneLabel: '手机号码',
    phonePlaceholder: '010-1234-5678',
    phoneHelp: '运营团队或游客在重要日程变更时可能会联系您。',
    emailLabel: '电子邮箱',
    emailPlaceholder: 'example@gmail.com',
    instagramLabel: 'Instagram ID',
    instagramPlaceholder: '@locally.host',
    sourceLabel: '了解渠道',
    sourcePlaceholder: '例如：Instagram、朋友推荐',
    step4Badge: 'Step 4. 个人资料设置',
    step4Title: '完善房客将看到的\n个人形象',
    step4Desc: '请用能让游客安心预订的方式展示自己。',
    profilePhotoHelp: '这通常是游客最先看到的照片。建议使用光线明亮、能清楚看到脸部的照片。',
    selfIntroLabel: '自我介绍',
    selfIntroHelp: '请使用你想展示给游客看的语言来填写。例：如果你想给韩国游客看，就用韩语来写。',
    selfIntroGuideTitle: '怎样的介绍更好？',
    selfIntroGuideBody: '可以简单说明你是什么样的房东、适合接待什么样的游客，以及你希望为游客创造什么样的体验。比起过于简短或抽象的介绍，更推荐能让人想象实际同行画面的介绍。',
    selfIntroPlaceholder: '你好！我是喜欢旅行和摄影的房东。（建议至少50字）',
    step5Badge: 'Step 5. 信任认证',
    step5Title: '获得认证房东\n徽章',
    step5Desc: '提交身份证件后，个人资料上会显示认证徽章。',
    idUploadTitle: '上传身份证件',
    idUploadDesc: '身份证、驾驶证、护照三选一',
    idUploadHelpTitle: '为什么需要身份证件？',
    idUploadHelpBody: '身份证件仅用于审核和身份确认，不会展示给游客。若照片中姓名和头像清晰可见，审核会更快也更准确。',
    chooseFileButton: '选择文件',
    uploadDone: '上传完成',
    idSecurityNote: '* 提交的身份证件信息仅用于身份验证，审核完成后将立即安全销毁。',
    step6Badge: 'Step 6. 结算账户',
    step6Title: '请填写用于收款的\n账户信息',
    step6Desc: '仅可登记本人名下账户。',
    bankNameLabel: '银行名称',
    bankNamePlaceholder: '例如：KakaoBank、Shinhan Bank / 瑞穗银行（涩谷支店）',
    bankNameHelp: '用于结算打款。如账户需要支店名，请与银行名一起填写在这一栏。',
    bankNameInlineShort: '请把银行名称写得更准确一些。',
    accountNumberLabel: '账号',
    accountNumberPlaceholder: '仅输入数字，不含连字符',
    accountNumberHelp: '请仅输入数字并确保准确。若填写错误，可能需要人工再次确认。',
    accountNumberInlineShort: '请再次确认账号数字。',
    accountHolderLabel: '账户持有人',
    accountHolderPlaceholder: '本人实名',
    accountHolderHelp: '请填写与证件一致的本人实名。',
    accountHolderInlineShort: '账户姓名请填写与证件一致的实名。',
    payoutGuideTitle: '填写收款账户前请先确认',
    payoutGuideBody: '账户信息会直接用于收益结算。若银行名、账号或户名与实际不一致，打款可能延迟。最重要的是使用本人名义并准确填写。',
    step7Badge: 'Step 7. 申请理由',
    step7Title: '最后一个问题！',
    step7Desc: '请写下你想成为 Locally 房东的原因。',
    motivationHelp: '如果能具体写出你想接待什么样的游客、想带来什么样的体验，会更有助于审核。',
    motivationInlineShort: '申请理由还有点短。请再补充一两句，说明你想接待什么样的游客、想带来什么样的体验。',
    motivationInlineReady: '很好，这样已经能更清楚地表达你为什么想成为房东。',
    motivationGuideTitle: '更好的申请理由示例',
    motivationGuideBody: '不要只写“想认识外国游客”，也建议写出你擅长带领的地区或主题，以及你希望游客获得什么样的感受。越具体，越有说服力。',
    motivationPlaceholder: '例如：我喜欢与外国游客交流，并介绍本地独特的地方。',
    pledgeText: '本人承诺将作为 Locally 房东以透明、诚实的方式活动，\n并确认如上述信息与事实不符，审批可能被取消。',
    step8Badge: 'Step 8. 必修培训确认',
    step8Title: '为了安全且正确的\n接待而做出的承诺',
    step8Desc: '提交前请务必仔细阅读以下安全指南。',
    step8Summary1: '预约确认后的长期不回复、随意取消或爽约，会直接影响游客的旅行安排。',
    step8Summary2: '引导站外付款、过早交换私人联系方式、误导性说明都会被视为信任违规。',
    step8Summary3: '请尽量让注册内容与实际接待内容一致，这样游客才会更安心下单。',
    step8DetailsToggle: '查看完整安全指南',
    policyReadCheckbox: '[必填] 我已完整阅读并理解上述房东安全指南及平台使用规则。',
    policyAgreeCheckbox: '[必填] 我同意如有违规，账号可能被永久停用并承担法律责任，\n并承诺作为 Locally 的诚信合作伙伴开展活动。',
    prevButton: '上一步',
    nextButton: '下一步',
    submitButton: '完成申请',
    submittingButton: '提交中...',
    validationLanguages: '请至少选择一种可使用语言。',
    validationLanguageLevels: '请为每种已选语言设置等级。',
    validationNationality: '请选择国籍。',
    validationName: '请输入真实姓名。',
    validationDob: '请输入出生日期。',
    validationDobFormat: '出生日期请按 YYYY.MM.DD 格式填写。',
    validationPhone: '请输入可联系的手机号。',
    validationPhoneFormat: '请重新检查手机号格式。',
    validationEmail: '请输入邮箱地址。',
    validationEmailFormat: '请输入有效的邮箱地址。',
    validationSelfIntro: '自我介绍请至少填写 50 个字符。',
    validationIdCard: '请上传身份证明图片。',
    validationBankName: '请输入银行名称。',
    validationAccountNumber: '请输入账号。',
    validationAccountHolder: '请输入账户姓名。',
    validationMotivation: '请填写申请成为房东的原因。',
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
