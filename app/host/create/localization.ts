export type FormLocale = 'ko' | 'en' | 'ja' | 'zh';

export type LocalizedText = Record<FormLocale, string>;

export type LocalizedOption = {
  value: string;
  labels: LocalizedText;
};

export type CountryCode = 'Korea' | 'Japan';

export type CategoryOption = LocalizedOption & {
  icon:
    | 'utensils'
    | 'coffee'
    | 'treePine'
    | 'shoppingBag'
    | 'landmark'
    | 'dumbbell'
    | 'moonStar'
    | 'building2'
    | 'ticket'
    | 'flag'
    | 'palette';
};

export const COUNTRY_OPTIONS: Array<{ value: CountryCode; labels: LocalizedText }> = [
  {
    value: 'Korea',
    labels: { ko: '🇰🇷 한국', en: '🇰🇷 Korea', ja: '🇰🇷 韓国', zh: '🇰🇷 韩国' },
  },
  {
    value: 'Japan',
    labels: { ko: '🇯🇵 일본', en: '🇯🇵 Japan', ja: '🇯🇵 日本', zh: '🇯🇵 日本' },
  },
];

export const CITY_OPTIONS: Record<CountryCode, LocalizedOption[]> = {
  Korea: [
    { value: '서울', labels: { ko: '서울', en: 'Seoul', ja: 'ソウル', zh: '首尔' } },
    { value: '부산', labels: { ko: '부산', en: 'Busan', ja: '釜山', zh: '釜山' } },
    { value: '제주', labels: { ko: '제주', en: 'Jeju', ja: '済州', zh: '济州' } },
    { value: '인천', labels: { ko: '인천', en: 'Incheon', ja: '仁川', zh: '仁川' } },
    { value: '경기', labels: { ko: '경기', en: 'Gyeonggi', ja: '京畿', zh: '京畿' } },
    { value: '강원', labels: { ko: '강원', en: 'Gangwon', ja: '江原', zh: '江原' } },
    { value: '경주', labels: { ko: '경주', en: 'Gyeongju', ja: '慶州', zh: '庆州' } },
    { value: '전주', labels: { ko: '전주', en: 'Jeonju', ja: '全州', zh: '全州' } },
    { value: '여수', labels: { ko: '여수', en: 'Yeosu', ja: '麗水', zh: '丽水' } },
    { value: '기타', labels: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
  ],
  Japan: [
    { value: '도쿄', labels: { ko: '도쿄', en: 'Tokyo', ja: '東京', zh: '东京' } },
    { value: '오사카', labels: { ko: '오사카', en: 'Osaka', ja: '大阪', zh: '大阪' } },
    { value: '시즈오카', labels: { ko: '시즈오카', en: 'Shizuoka', ja: '静岡', zh: '静冈' } },
    { value: '교토', labels: { ko: '교토', en: 'Kyoto', ja: '京都', zh: '京都' } },
    { value: '후쿠오카', labels: { ko: '후쿠오카', en: 'Fukuoka', ja: '福岡', zh: '福冈' } },
    { value: '삿포로', labels: { ko: '삿포로', en: 'Sapporo', ja: '札幌', zh: '札幌' } },
    { value: '오키나와', labels: { ko: '오키나와', en: 'Okinawa', ja: '沖縄', zh: '冲绳' } },
    { value: '나고야', labels: { ko: '나고야', en: 'Nagoya', ja: '名古屋', zh: '名古屋' } },
    { value: '고베', labels: { ko: '고베', en: 'Kobe', ja: '神戸', zh: '神户' } },
    { value: '기타', labels: { ko: '기타', en: 'Other', ja: 'その他', zh: '其他' } },
  ],
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: '맛집 탐방', icon: 'utensils', labels: { ko: '맛집 탐방', en: 'Food Tour', ja: 'グルメ巡り', zh: '美食探索' } },
  { value: '카페/디저트', icon: 'coffee', labels: { ko: '카페/디저트', en: 'Cafe / Dessert', ja: 'カフェ / デザート', zh: '咖啡 / 甜点' } },
  { value: '산책/힐링', icon: 'treePine', labels: { ko: '산책/힐링', en: 'Walk / Healing', ja: '散歩 / 癒やし', zh: '散步 / 疗愈' } },
  { value: '쇼핑', icon: 'shoppingBag', labels: { ko: '쇼핑', en: 'Shopping', ja: 'ショッピング', zh: '购物' } },
  { value: '문화 체험', icon: 'landmark', labels: { ko: '문화 체험', en: 'Cultural Experience', ja: '文化体験', zh: '文化体验' } },
  { value: '액티비티', icon: 'dumbbell', labels: { ko: '액티비티', en: 'Activity', ja: 'アクティビティ', zh: '活动体验' } },
  { value: '나이트라이프', icon: 'moonStar', labels: { ko: '나이트라이프', en: 'Nightlife', ja: 'ナイトライフ', zh: '夜生活' } },
  { value: '건축', icon: 'building2', labels: { ko: '건축', en: 'Architecture', ja: '建築', zh: '建筑' } },
  { value: '공연/경기', icon: 'ticket', labels: { ko: '공연/경기', en: 'Show / Match', ja: '公演 / 試合', zh: '演出 / 比赛' } },
  { value: '랜드마크', icon: 'flag', labels: { ko: '랜드마크', en: 'Landmark', ja: 'ランドマーク', zh: '地标' } },
  { value: '원데이 클래스', icon: 'palette', labels: { ko: '원데이 클래스', en: 'One-day Class', ja: 'ワンデークラス', zh: '单日课程' } },
];

export const EXPERIENCE_LANGUAGE_OPTIONS: Array<
  LocalizedOption & {
    code: 'ko' | 'en' | 'ja' | 'zh';
    flag: string;
  }
> = [
  {
    value: '한국어',
    code: 'ko',
    flag: '🇰🇷',
    labels: { ko: '한국어', en: 'Korean', ja: '韓国語', zh: '韩语' },
  },
  {
    value: '영어',
    code: 'en',
    flag: '🇺🇸',
    labels: { ko: '영어', en: 'English', ja: '英語', zh: '英语' },
  },
  {
    value: '일본어',
    code: 'ja',
    flag: '🇯🇵',
    labels: { ko: '일본어', en: 'Japanese', ja: '日本語', zh: '日语' },
  },
  {
    value: '중국어',
    code: 'zh',
    flag: '🇨🇳',
    labels: { ko: '중국어', en: 'Chinese', ja: '中国語', zh: '中文' },
  },
];

export const ACTIVITY_LEVEL_OPTIONS: Array<
  LocalizedOption & {
    emoji: string;
  }
> = [
  {
    value: '가벼움',
    emoji: '🍃',
    labels: { ko: '가벼움', en: 'Light', ja: '軽め', zh: '轻松' },
  },
  {
    value: '보통',
    emoji: '🚶',
    labels: { ko: '보통', en: 'Moderate', ja: '普通', zh: '中等' },
  },
  {
    value: '높음',
    emoji: '🔥',
    labels: { ko: '높음', en: 'High', ja: '高め', zh: '高强度' },
  },
];

export const FIXED_REFUND_POLICY = '표준 정책 (7일 전 무료 취소)';

export const FIXED_REFUND_POLICY_LABELS: LocalizedText = {
  ko: '표준 정책 (7일 전 무료 취소)',
  en: 'Standard policy (free cancellation up to 7 days before)',
  ja: '標準ポリシー（7日前まで無料キャンセル）',
  zh: '标准政策（7天前可免费取消）',
};

export const MAX_EXPERIENCE_PHOTOS = 5;

export const TOTAL_STEPS = 8;

export const INITIAL_FORM_DATA = {
  country: 'Korea',
  city: '',
  subCity: '',
  category: '',

  languages: [] as string[],
  language_levels: [] as import('@/app/utils/languageLevels').LanguageLevelEntry[],
  source_locale: 'ko' as FormLocale,
  manual_content: {
    ko: { title: '', description: '' },
  } as Partial<Record<FormLocale, { title: string; description: string }>>,

  photos: [] as string[],
  location: '',

  itinerary: [
    { title: '만남', description: '', type: 'meet', image_url: '' },
  ] as { title: string; description: string; type: 'meet' | 'spot' | 'end'; image_url?: string }[],

  inclusions: [] as string[],
  exclusions: [] as string[],
  supplies: '',

  duration: 3,
  maxGuests: 4,
  meeting_point: '',
  rules: {
    age_limit: '',
    activity_level: '보통',
    refund_policy: FIXED_REFUND_POLICY,
  },

  price: 50000,
};

type ExperienceFormCopy = {
  step1Title: string;
  step1Desc: string;
  customCityPlaceholder: string;
  categoryLabel: string;
  step2Title: string;
  step2Desc: string;
  sourceLocaleLabel: string;
  sourceLocaleHelp: string;
  sourceLocaleBadge: string;
  step3Title: string;
  step3Desc: (maxPhotos: number) => string;
  titlePlaceholder: string;
  titleSectionLabel: string;
  firstPhotoNotice: string;
  addHeroPhoto: string;
  mainPhotoBadge: string;
  step4Title: string;
  step4Desc: string;
  meetingPointLabel: string;
  meetingPointPlaceholder: string;
  addressPlaceholder: string;
  addressHelp: string;
  itinerarySectionTitle: string;
  itineraryTitlePlaceholder: string;
  itineraryDescPlaceholder: string;
  itineraryPhotoLabel: string;
  itineraryReplace: string;
  itineraryAddPhoto: string;
  addStop: string;
  step5Title: string;
  step5Desc: string;
  descriptionPlaceholder: string;
  descriptionSectionLabel: string;
  inclusionsLabel: string;
  inclusionsPlaceholder: string;
  exclusionsLabel: string;
  exclusionsPlaceholder: string;
  suppliesLabel: string;
  suppliesPlaceholder: string;
  step6Title: string;
  step6Desc: string;
  durationLabel: string;
  durationUnit: string;
  maxGuestsLabel: string;
  maxGuestsUnit: string;
  ageLimitLabel: string;
  ageLimitPlaceholder: string;
  activityLevelLabel: string;
  refundPolicyLabel: string;
  refundPolicyHelp: string;
  step7Title: string;
  step7Desc: string;
  priceLabel: string;
  privateOptionLabel: string;
  privatePricePlaceholder: string;
  step8Title: string;
  step8DescLine1: string;
  step8DescLine2: string;
  step8Button: string;
  prevButton: string;
  nextButton: string;
  submitButton: string;
  submittingButton: string;
  validationCity: string;
  validationCategory: string;
  validationLanguages: string;
  validationLanguageLevels: string;
  validationSourceLocale: string;
  validationTitle: string;
  validationPhotos: string;
  validationPhotoLimit: (maxPhotos: number) => string;
  validationMeetingPoint: string;
  validationLocation: string;
  validationItineraryTitles: string;
  validationDescription: string;
  validationInclusions: string;
  validationAgeLimit: string;
  validationPrice: string;
  validationPrivatePrice: string;
  imageValidationFallback: string;
  imageProcessingError: string;
  loginRequired: string;
  submitSuccess: string;
  submitFailPrefix: string;
  unknownError: string;
  itineraryPhotoUploading: string;
  itineraryPhotoUploadSuccess: string;
  itineraryPhotoUploadFailPrefix: string;
  itineraryPhotoDeleteSuccess: string;
  editPhotoManagerLabel: (count: number, maxPhotos: number) => string;
  editPhotoManagerDesc: string;
  editAddPhoto: string;
  editMeetingPointLabel: string;
  editAddressLabel: string;
  editPrivatePriceLabel: string;
};

const EXPERIENCE_FORM_COPY: Record<FormLocale, ExperienceFormCopy> = {
  ko: {
    step1Title: '어떤 체험을 준비하셨나요?',
    step1Desc: '지역과 카테고리를 먼저 선택해주세요.',
    customCityPlaceholder: '도시 이름 입력 (예: 가마쿠라)',
    categoryLabel: '카테고리',
    step2Title: '진행 가능한 언어',
    step2Desc: '이 체험을 어떤 언어로 진행할 수 있나요?',
    sourceLocaleLabel: '대표 원문 언어',
    sourceLocaleHelp: '선택한 언어 중 자동 번역의 기준이 될 메인 언어를 골라주세요.',
    sourceLocaleBadge: '원문',
    step3Title: '체험의 첫인상',
    step3Desc: (maxPhotos) => `선택한 언어별 제목을 입력하고 대표사진을 올려주세요. (최대 ${maxPhotos}장)`,
    titlePlaceholder: '체험 제목을 입력하세요',
    titleSectionLabel: '언어별 제목',
    firstPhotoNotice: '첫 번째 대표사진이 체험 상세 페이지 상단에서 가장 먼저 보여집니다.',
    addHeroPhoto: '대표사진 추가',
    mainPhotoBadge: '메인',
    step4Title: '어디서 만날까요?',
    step4Desc: '게스트가 바로 이해할 수 있게 만나는 장소와 체험 흐름을 적어주세요.',
    meetingPointLabel: '만나는 장소',
    meetingPointPlaceholder: '예) 스타벅스 홍대역점',
    addressPlaceholder: '예) 서울특별시 마포구 양화로 165',
    addressHelp: '* 구글맵에서 검색 가능한 정확한 주소를 입력해주세요.',
    itinerarySectionTitle: '체험 상세 내용',
    itineraryTitlePlaceholder: '장소 이름',
    itineraryDescPlaceholder: '간단한 설명 (선택)',
    itineraryPhotoLabel: '장소 사진',
    itineraryReplace: '교체',
    itineraryAddPhoto: '장소 사진 추가',
    addStop: '경유지 추가하기',
    step5Title: '상세 소개 및 포함 사항',
    step5Desc: '체험을 더 설득력 있게 설명하고, 게스트가 받는 혜택을 정리해주세요.',
    descriptionPlaceholder: '상세 소개글을 입력하세요. (최소 50자 이상)',
    descriptionSectionLabel: '언어별 소개글',
    inclusionsLabel: '포함 사항',
    inclusionsPlaceholder: '예) 음료',
    exclusionsLabel: '불포함 사항',
    exclusionsPlaceholder: '예) 개인 교통비',
    suppliesLabel: '준비물 (선택)',
    suppliesPlaceholder: '예) 편한 운동화, 생수',
    step6Title: '기본 규칙 설정',
    step6Desc: '소요 시간과 참여 기준을 정리해주세요.',
    durationLabel: '소요 시간',
    durationUnit: '시간',
    maxGuestsLabel: '최대 인원',
    maxGuestsUnit: '명',
    ageLimitLabel: '참가 연령',
    ageLimitPlaceholder: '예) 만 7세 이상',
    activityLevelLabel: '활동 강도',
    refundPolicyLabel: '환불 정책',
    refundPolicyHelp: '환불 정책은 고정으로 자동 적용됩니다.',
    step7Title: '요금 설정',
    step7Desc: '가격을 설정하세요.',
    priceLabel: '기본 1인당 가격',
    privateOptionLabel: '단독 투어 옵션',
    privatePricePlaceholder: '단독 투어 고정 가격',
    step8Title: '체험 등록 완료! 🎉',
    step8DescLine1: '관리자 검토 후 공개됩니다.',
    step8DescLine2: '이제 일정을 열어 예약을 받아보세요.',
    step8Button: '내 체험 보러가기',
    prevButton: '이전',
    nextButton: '다음',
    submitButton: '체험 등록하기',
    submittingButton: '등록 중...',
    validationCity: '도시를 선택하거나 직접 입력해주세요.',
    validationCategory: '카테고리를 선택해주세요.',
    validationLanguages: '진행 가능한 언어를 1개 이상 선택해주세요.',
    validationLanguageLevels: '선택한 각 언어의 레벨을 설정해주세요.',
    validationSourceLocale: '대표 원문 언어를 선택해주세요.',
    validationTitle: '체험 제목을 6자 이상 입력해주세요.',
    validationPhotos: '대표 사진을 1장 이상 업로드해주세요.',
    validationPhotoLimit: (maxPhotos) => `대표 사진은 최대 ${maxPhotos}장까지 업로드 가능합니다.`,
    validationMeetingPoint: '만나는 장소 이름을 입력해주세요.',
    validationLocation: '정확한 주소를 입력해주세요.',
    validationItineraryTitles: '이동 동선의 장소 이름을 모두 입력해주세요.',
    validationDescription: '상세 설명을 30자 이상 입력해주세요.',
    validationInclusions: '포함 사항을 1개 이상 입력해주세요.',
    validationAgeLimit: '참가 연령 기준을 입력해주세요.',
    validationPrice: '기본 가격을 올바르게 입력해주세요.',
    validationPrivatePrice: '단독 투어 가격을 입력해주세요.',
    imageValidationFallback: '이미지 형식이 올바르지 않습니다.',
    imageProcessingError: '이미지 처리 중 오류가 발생했습니다.',
    loginRequired: '로그인이 필요합니다.',
    submitSuccess: '체험이 성공적으로 등록되었습니다! 🎉',
    submitFailPrefix: '등록 실패: ',
    unknownError: '알 수 없는 오류가 발생했습니다.',
    itineraryPhotoUploading: '업로드 중...',
    itineraryPhotoUploadSuccess: '동선 사진이 업로드되었습니다.',
    itineraryPhotoUploadFailPrefix: '동선 사진 업로드 실패: ',
    itineraryPhotoDeleteSuccess: '동선 사진이 삭제되었습니다.',
    editPhotoManagerLabel: (count, maxPhotos) => `대표 사진 관리 (${count}/${maxPhotos})`,
    editPhotoManagerDesc: '첫 번째 사진이 상세 상단 대표 이미지로 노출됩니다.',
    editAddPhoto: '대표사진 추가',
    editMeetingPointLabel: '만나는 장소 이름',
    editAddressLabel: '정확한 주소',
    editPrivatePriceLabel: '단독 투어 금액',
  },
  en: {
    step1Title: 'What kind of experience are you preparing?',
    step1Desc: 'Choose the region and category first.',
    customCityPlaceholder: 'Enter city name (e.g. Kamakura)',
    categoryLabel: 'Category',
    step2Title: 'Available languages',
    step2Desc: 'Which languages can you host this experience in?',
    sourceLocaleLabel: 'Source language',
    sourceLocaleHelp: 'Choose the main language that AI translations will be based on.',
    sourceLocaleBadge: 'Source',
    step3Title: 'First impression of your experience',
    step3Desc: (maxPhotos) => `Add titles for each selected language and upload hero photos. (Up to ${maxPhotos})`,
    titlePlaceholder: 'Enter experience title',
    titleSectionLabel: 'Titles by language',
    firstPhotoNotice: 'The first hero photo appears at the top of the experience detail page.',
    addHeroPhoto: 'Add hero photo',
    mainPhotoBadge: 'Main',
    step4Title: 'Where will you meet?',
    step4Desc: 'Describe the meeting point and flow so guests can understand it right away.',
    meetingPointLabel: 'Meeting point',
    meetingPointPlaceholder: 'e.g. Starbucks Hongdae Station',
    addressPlaceholder: 'e.g. 165 Yanghwa-ro, Mapo-gu, Seoul',
    addressHelp: '* Enter an exact address searchable on Google Maps.',
    itinerarySectionTitle: 'Experience itinerary',
    itineraryTitlePlaceholder: 'Place name',
    itineraryDescPlaceholder: 'Short description (optional)',
    itineraryPhotoLabel: 'Place photo',
    itineraryReplace: 'Replace',
    itineraryAddPhoto: 'Add place photo',
    addStop: 'Add stop',
    step5Title: 'Detailed intro & inclusions',
    step5Desc: 'Explain the experience clearly and summarize what guests receive.',
    descriptionPlaceholder: 'Enter a detailed description. (At least 50 characters)',
    descriptionSectionLabel: 'Descriptions by language',
    inclusionsLabel: 'Inclusions',
    inclusionsPlaceholder: 'e.g. Drink',
    exclusionsLabel: 'Exclusions',
    exclusionsPlaceholder: 'e.g. Personal transportation',
    suppliesLabel: 'What to bring (optional)',
    suppliesPlaceholder: 'e.g. Comfortable shoes, water',
    step6Title: 'Basic rules',
    step6Desc: 'Set the duration and participation guidelines.',
    durationLabel: 'Duration',
    durationUnit: 'hr',
    maxGuestsLabel: 'Max guests',
    maxGuestsUnit: 'guests',
    ageLimitLabel: 'Age requirement',
    ageLimitPlaceholder: 'e.g. Ages 7 and up',
    activityLevelLabel: 'Activity level',
    refundPolicyLabel: 'Refund policy',
    refundPolicyHelp: 'The refund policy is fixed and applied automatically.',
    step7Title: 'Pricing',
    step7Desc: 'Set your price.',
    priceLabel: 'Base price per guest',
    privateOptionLabel: 'Private tour option',
    privatePricePlaceholder: 'Fixed private tour price',
    step8Title: 'Experience submitted! 🎉',
    step8DescLine1: 'It will be published after admin review.',
    step8DescLine2: 'Open your schedule and start receiving bookings.',
    step8Button: 'View my experiences',
    prevButton: 'Back',
    nextButton: 'Next',
    submitButton: 'Submit experience',
    submittingButton: 'Submitting...',
    validationCity: 'Choose a city or enter one directly.',
    validationCategory: 'Choose a category.',
    validationLanguages: 'Select at least one available language.',
    validationLanguageLevels: 'Set a level for each selected language.',
    validationSourceLocale: 'Choose the source language.',
    validationTitle: 'Enter a title with at least 6 characters.',
    validationPhotos: 'Upload at least one hero photo.',
    validationPhotoLimit: (maxPhotos) => `You can upload up to ${maxPhotos} hero photos.`,
    validationMeetingPoint: 'Enter the meeting point name.',
    validationLocation: 'Enter an exact address.',
    validationItineraryTitles: 'Enter a place name for every itinerary stop.',
    validationDescription: 'Enter at least 30 characters for the description.',
    validationInclusions: 'Add at least one inclusion.',
    validationAgeLimit: 'Enter the age requirement.',
    validationPrice: 'Enter a valid base price.',
    validationPrivatePrice: 'Enter the private tour price.',
    imageValidationFallback: 'Invalid image format.',
    imageProcessingError: 'An error occurred while processing the image.',
    loginRequired: 'Login is required.',
    submitSuccess: 'The experience has been submitted successfully! 🎉',
    submitFailPrefix: 'Submission failed: ',
    unknownError: 'An unknown error occurred.',
    itineraryPhotoUploading: 'Uploading...',
    itineraryPhotoUploadSuccess: 'Itinerary photo uploaded.',
    itineraryPhotoUploadFailPrefix: 'Itinerary photo upload failed: ',
    itineraryPhotoDeleteSuccess: 'Itinerary photo removed.',
    editPhotoManagerLabel: (count, maxPhotos) => `Hero Photos (${count}/${maxPhotos})`,
    editPhotoManagerDesc: 'The first photo is shown as the main image at the top of the detail page.',
    editAddPhoto: 'Add hero photo',
    editMeetingPointLabel: 'Meeting point name',
    editAddressLabel: 'Exact address',
    editPrivatePriceLabel: 'Private tour price',
  },
  ja: {
    step1Title: 'どんな体験を準備していますか？',
    step1Desc: 'まず地域とカテゴリを選択してください。',
    customCityPlaceholder: '都市名を入力してください（例: 鎌倉）',
    categoryLabel: 'カテゴリ',
    step2Title: '対応可能な言語',
    step2Desc: 'この体験はどの言語で進行できますか？',
    sourceLocaleLabel: '原文の基準言語',
    sourceLocaleHelp: '自動翻訳の基準になるメイン言語を選択してください。',
    sourceLocaleBadge: '原文',
    step3Title: '体験の第一印象',
    step3Desc: (maxPhotos) => `選択した各言語のタイトルを入力し、代表写真をアップロードしてください。（最大${maxPhotos}枚）`,
    titlePlaceholder: '体験タイトルを入力してください',
    titleSectionLabel: '言語別タイトル',
    firstPhotoNotice: '最初の代表写真が体験詳細ページ上部に最初に表示されます。',
    addHeroPhoto: '代表写真を追加',
    mainPhotoBadge: 'メイン',
    step4Title: 'どこで会いますか？',
    step4Desc: 'ゲストがすぐ理解できるように集合場所と体験の流れを書いてください。',
    meetingPointLabel: '集合場所',
    meetingPointPlaceholder: '例）スターバックス弘大駅店',
    addressPlaceholder: '例）ソウル特別市 麻浦区 楊花路 165',
    addressHelp: '* Google Maps で検索できる正確な住所を入力してください。',
    itinerarySectionTitle: '体験の詳細内容',
    itineraryTitlePlaceholder: '場所名',
    itineraryDescPlaceholder: '簡単な説明（任意）',
    itineraryPhotoLabel: '場所の写真',
    itineraryReplace: '差し替え',
    itineraryAddPhoto: '場所の写真を追加',
    addStop: '経由地を追加',
    step5Title: '詳細紹介と含まれる内容',
    step5Desc: '体験をより魅力的に説明し、ゲストが受け取る内容を整理してください。',
    descriptionPlaceholder: '詳細紹介文を入力してください。（50文字以上推奨）',
    descriptionSectionLabel: '言語別紹介文',
    inclusionsLabel: '含まれるもの',
    inclusionsPlaceholder: '例）ドリンク',
    exclusionsLabel: '含まれないもの',
    exclusionsPlaceholder: '例）個人の交通費',
    suppliesLabel: '持ち物（任意）',
    suppliesPlaceholder: '例）歩きやすい靴、水',
    step6Title: '基本ルール設定',
    step6Desc: '所要時間と参加条件を整理してください。',
    durationLabel: '所要時間',
    durationUnit: '時間',
    maxGuestsLabel: '最大人数',
    maxGuestsUnit: '名',
    ageLimitLabel: '参加年齢',
    ageLimitPlaceholder: '例）満7歳以上',
    activityLevelLabel: '活動強度',
    refundPolicyLabel: '返金ポリシー',
    refundPolicyHelp: '返金ポリシーは固定で自動適用されます。',
    step7Title: '料金設定',
    step7Desc: '価格を設定してください。',
    priceLabel: '基本の1人あたり価格',
    privateOptionLabel: 'プライベートツアーオプション',
    privatePricePlaceholder: 'プライベートツアー固定価格',
    step8Title: '体験登録が完了しました！ 🎉',
    step8DescLine1: '管理者の確認後に公開されます。',
    step8DescLine2: '次は日程を開けて予約を受け付けましょう。',
    step8Button: '自分の体験を見る',
    prevButton: '戻る',
    nextButton: '次へ',
    submitButton: '体験を登録する',
    submittingButton: '登録中...',
    validationCity: '都市を選択するか直接入力してください。',
    validationCategory: 'カテゴリを選択してください。',
    validationLanguages: '対応可能な言語を1つ以上選択してください。',
    validationLanguageLevels: '選択した各言語のレベルを設定してください。',
    validationSourceLocale: '原文の基準言語を選択してください。',
    validationTitle: '体験タイトルを6文字以上入力してください。',
    validationPhotos: '代表写真を1枚以上アップロードしてください。',
    validationPhotoLimit: (maxPhotos) => `代表写真は最大${maxPhotos}枚までアップロードできます。`,
    validationMeetingPoint: '集合場所名を入力してください。',
    validationLocation: '正確な住所を入力してください。',
    validationItineraryTitles: '移動ルートの場所名をすべて入力してください。',
    validationDescription: '詳細説明を30文字以上入力してください。',
    validationInclusions: '含まれるものを1つ以上入力してください。',
    validationAgeLimit: '参加年齢条件を入力してください。',
    validationPrice: '基本価格を正しく入力してください。',
    validationPrivatePrice: 'プライベートツアー価格を入力してください。',
    imageValidationFallback: '画像形式が正しくありません。',
    imageProcessingError: '画像処理中にエラーが発生しました。',
    loginRequired: 'ログインが必要です。',
    submitSuccess: '体験が正常に登録されました！ 🎉',
    submitFailPrefix: '登録失敗: ',
    unknownError: '不明なエラーが発生しました。',
    itineraryPhotoUploading: 'アップロード中...',
    itineraryPhotoUploadSuccess: '経路写真がアップロードされました。',
    itineraryPhotoUploadFailPrefix: '経路写真のアップロード失敗: ',
    itineraryPhotoDeleteSuccess: '経路写真が削除されました。',
    editPhotoManagerLabel: (count, maxPhotos) => `代表写真管理 (${count}/${maxPhotos})`,
    editPhotoManagerDesc: '最初の写真が詳細上部のメイン画像として表示されます。',
    editAddPhoto: '代表写真を追加',
    editMeetingPointLabel: '集合場所名',
    editAddressLabel: '正確な住所',
    editPrivatePriceLabel: 'プライベートツアー料金',
  },
  zh: {
    step1Title: '你准备了什么样的体验？',
    step1Desc: '请先选择地区和类别。',
    customCityPlaceholder: '输入城市名称（例如：镰仓）',
    categoryLabel: '类别',
    step2Title: '可使用语言',
    step2Desc: '这个体验可以用哪些语言进行？',
    sourceLocaleLabel: '原文主语言',
    sourceLocaleHelp: '请选择 AI 自动翻译时要参考的主语言。',
    sourceLocaleBadge: '原文',
    step3Title: '体验的第一印象',
    step3Desc: (maxPhotos) => `请填写所选语言的标题并上传代表照片。（最多${maxPhotos}张）`,
    titlePlaceholder: '请输入体验标题',
    titleSectionLabel: '按语言填写标题',
    firstPhotoNotice: '第一张代表照片会显示在体验详情页顶部。',
    addHeroPhoto: '添加代表照片',
    mainPhotoBadge: '主图',
    step4Title: '在哪里见面？',
    step4Desc: '请填写集合地点和体验流程，让房客一眼就能理解。',
    meetingPointLabel: '集合地点',
    meetingPointPlaceholder: '例如：弘大站星巴克',
    addressPlaceholder: '例如：首尔特别市麻浦区杨花路165',
    addressHelp: '* 请输入可以在 Google Maps 搜索到的准确地址。',
    itinerarySectionTitle: '体验详细内容',
    itineraryTitlePlaceholder: '地点名称',
    itineraryDescPlaceholder: '简要说明（可选）',
    itineraryPhotoLabel: '地点照片',
    itineraryReplace: '更换',
    itineraryAddPhoto: '添加地点照片',
    addStop: '添加途经点',
    step5Title: '详细介绍与包含内容',
    step5Desc: '更有说服力地介绍体验，并整理房客可获得的内容。',
    descriptionPlaceholder: '请输入详细介绍。（建议至少50字）',
    descriptionSectionLabel: '按语言填写介绍',
    inclusionsLabel: '包含内容',
    inclusionsPlaceholder: '例如：饮品',
    exclusionsLabel: '不包含内容',
    exclusionsPlaceholder: '例如：个人交通费',
    suppliesLabel: '需准备物品（可选）',
    suppliesPlaceholder: '例如：舒适的运动鞋、饮用水',
    step6Title: '基本规则设置',
    step6Desc: '请整理所需时间和参与条件。',
    durationLabel: '所需时间',
    durationUnit: '小时',
    maxGuestsLabel: '最大人数',
    maxGuestsUnit: '人',
    ageLimitLabel: '参加年龄',
    ageLimitPlaceholder: '例如：满7岁以上',
    activityLevelLabel: '活动强度',
    refundPolicyLabel: '退款政策',
    refundPolicyHelp: '退款政策为固定并自动应用。',
    step7Title: '价格设置',
    step7Desc: '请设置价格。',
    priceLabel: '基础单价（每人）',
    privateOptionLabel: '私人团选项',
    privatePricePlaceholder: '私人团固定价格',
    step8Title: '体验提交完成！ 🎉',
    step8DescLine1: '管理员审核后将会公开。',
    step8DescLine2: '现在可以开放日程并开始接收预订。',
    step8Button: '查看我的体验',
    prevButton: '上一步',
    nextButton: '下一步',
    submitButton: '提交体验',
    submittingButton: '提交中...',
    validationCity: '请选择城市或直接输入城市。',
    validationCategory: '请选择类别。',
    validationLanguages: '请至少选择一种可使用语言。',
    validationLanguageLevels: '请为每种已选语言设置等级。',
    validationSourceLocale: '请选择原文主语言。',
    validationTitle: '请输入至少6个字的体验标题。',
    validationPhotos: '请至少上传一张代表照片。',
    validationPhotoLimit: (maxPhotos) => `代表照片最多可上传${maxPhotos}张。`,
    validationMeetingPoint: '请输入集合地点名称。',
    validationLocation: '请输入准确地址。',
    validationItineraryTitles: '请填写所有路线地点名称。',
    validationDescription: '请输入至少30个字的详细说明。',
    validationInclusions: '请至少填写一项包含内容。',
    validationAgeLimit: '请输入参加年龄条件。',
    validationPrice: '请输入正确的基础价格。',
    validationPrivatePrice: '请输入私人团价格。',
    imageValidationFallback: '图片格式不正确。',
    imageProcessingError: '图片处理时发生错误。',
    loginRequired: '需要登录。',
    submitSuccess: '体验已成功提交！ 🎉',
    submitFailPrefix: '提交失败：',
    unknownError: '发生未知错误。',
    itineraryPhotoUploading: '上传中...',
    itineraryPhotoUploadSuccess: '路线照片已上传。',
    itineraryPhotoUploadFailPrefix: '路线照片上传失败：',
    itineraryPhotoDeleteSuccess: '路线照片已删除。',
    editPhotoManagerLabel: (count, maxPhotos) => `代表照片管理 (${count}/${maxPhotos})`,
    editPhotoManagerDesc: '第一张照片会显示为详情页顶部主图。',
    editAddPhoto: '添加代表照片',
    editMeetingPointLabel: '集合地点名称',
    editAddressLabel: '准确地址',
    editPrivatePriceLabel: '私人团价格',
  },
};

export function normalizeFormLocale(lang: string): FormLocale {
  if (lang === 'en' || lang === 'ja' || lang === 'zh') return lang;
  return 'ko';
}

export function getLocalizedText(text: LocalizedText, lang: string): string {
  return text[normalizeFormLocale(lang)];
}

export function getExperienceFormCopy(lang: string): ExperienceFormCopy {
  return EXPERIENCE_FORM_COPY[normalizeFormLocale(lang)];
}

export function getItineraryStepLabel(lang: string, index: number, total: number): string {
  const locale = normalizeFormLocale(lang);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (locale === 'ja') {
    if (isFirst) return '開始';
    if (isLast) return '終了';
    return `経由地 ${index}`;
  }

  if (locale === 'zh') {
    if (isFirst) return '开始';
    if (isLast) return '结束';
    return `途经点 ${index}`;
  }

  if (locale === 'en') {
    if (isFirst) return 'START';
    if (isLast) return 'END';
    return `STOP ${index}`;
  }

  if (isFirst) return '시작';
  if (isLast) return '종료';
  return `경유지 ${index}`;
}
