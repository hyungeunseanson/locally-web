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

export const FIXED_REFUND_POLICY = '체험일 당일/지난 일정은 환불 불가, 그 외 결제 당일 취소 100%, 20일 전 100%, 8~19일 전 80%, 2~7일 전 70%, 1일 전 40%';

export const FIXED_REFUND_POLICY_LABELS: LocalizedText = {
  ko: '체험일 당일/지난 일정은 환불 불가, 그 외 결제 당일 취소 100%, 20일 전 100%, 8~19일 전 80%, 2~7일 전 70%, 1일 전 40%',
  en: 'Non-refundable on the experience day or for past dates. Otherwise, 100% on the payment day, 100% 20 days before, 80% 8–19 days before, 70% 2–7 days before, and 40% 1 day before.',
  ja: '体験当日・過ぎた日程は返金不可、それ以外は決済当日のキャンセル100%、20日前100%、8〜19日前80%、2〜7日前70%、1日前40%',
  zh: '行程当天或已过日期不可退款，其余情况为付款当日取消100%，20天前100%，8~19天前80%，2~7天前70%，1天前40%',
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
    host_notice: '',
  },

  price: 50000,
};

type ExperienceFormCopy = {
  step1Title: string;
  step1Desc: string;
  customCityPlaceholder: string;
  categoryLabel: string;
  categoryHelp: string;
  step2Title: string;
  step2Desc: string;
  sourceLocaleLabel: string;
  sourceLocaleHelp: string;
  sourceLocaleHelpPrimary: string;
  sourceLocaleHelpExample: string;
  sourceLocaleHelpAi: string;
  sourceLocaleBadge: string;
  step3Title: string;
  step3Desc: (maxPhotos: number) => string;
  titlePlaceholder: string;
  titleSectionLabel: string;
  titleHelp: string;
  firstPhotoNotice: string;
  photoHelp: string;
  popularityWishlistHelp: string;
  photoGuideTitle: string;
  photoGuideBody: string;
  photoGuideExamplesTitle: string;
  photoGuideExamples: string[];
  addHeroPhoto: string;
  mainPhotoBadge: string;
  step4Title: string;
  step4Desc: string;
  meetingPointLabel: string;
  meetingPointPlaceholder: string;
  meetingPointHelp: string;
  addressPlaceholder: string;
  addressHelp: string;
  itinerarySectionTitle: string;
  itineraryHelp: string;
  step4GuideTitle: string;
  step4GuideBody: string;
  step4GuideExamplesTitle: string;
  step4GuideExamples: string[];
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
  descriptionHelp: string;
  step5GuideTitle: string;
  step5GuideBody: string;
  step5GuideExamplesTitle: string;
  step5GuideExamples: string[];
  inclusionsLabel: string;
  inclusionsHelp: string;
  inclusionsPlaceholder: string;
  exclusionsLabel: string;
  exclusionsHelp: string;
  exclusionsPlaceholder: string;
  suppliesLabel: string;
  suppliesHelp: string;
  suppliesPlaceholder: string;
  step6Title: string;
  step6Desc: string;
  durationLabel: string;
  durationUnit: string;
  maxGuestsLabel: string;
  maxGuestsUnit: string;
  ageLimitLabel: string;
  ageLimitPlaceholder: string;
  ageLimitHelp: string;
  activityLevelLabel: string;
  hostNoticeLabel: string;
  hostNoticeHelp: string;
  hostNoticePlaceholder: string;
  refundPolicyLabel: string;
  refundPolicyHelp: string;
  refundPolicyItems: string[];
  step7Title: string;
  step7Desc: string;
  priceLabel: string;
  pricePlaceholder: string;
  priceHelp: string;
  pricingGuideTitle: string;
  pricingGuideBody: string;
  pricingGuideExamplesTitle: string;
  pricingGuideExamples: string[];
  soloGuaranteeTitle: string;
  soloGuaranteeDesc: string;
  soloGuaranteeRefundNote: string;
  soloGuaranteeHostNote: string;
  privateOptionLabel: string;
  privateOptionDesc: string;
  privatePriceHelp: string;
  privatePricePlaceholder: string;
  step8Title: string;
  step8DescLine1: string;
  step8DescLine2: string;
  step8Button: string;
  step8ScheduleButton: string;
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
  validationInclusionItemQuality: string;
  validationExclusionItemQuality: string;
  validationDuplicateListItem: string;
  validationSuppliesQuality: string;
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
    categoryHelp: '게스트가 체험을 찾을 때 가장 먼저 보는 분류입니다.',
    step2Title: '진행 가능한 언어',
    step2Desc: '이 체험을 어떤 언어로 진행할 예정인가요?',
    sourceLocaleLabel: '대표 언어',
    sourceLocaleHelp: '주로 받고 싶은 게스트의 언어로 대표 소개를 작성해주세요. 예: 한국인 게스트를 주로 받는다면 한국어를 선택해 작성하면 됩니다. 다른 언어는 이 대표 언어를 기준으로 AI 자동 번역 및 보정이 진행됩니다.',
    sourceLocaleHelpPrimary: '주로 받고 싶은 게스트의 언어로 대표 소개를 작성해주세요.',
    sourceLocaleHelpExample: '예: 한국인 게스트를 주로 받는다면 한국어를 선택해 작성하면 됩니다.',
    sourceLocaleHelpAi: '다른 언어는 이 대표 언어를 기준으로 AI 자동 번역 및 보정이 진행됩니다.',
    sourceLocaleBadge: '대표',
    step3Title: '체험의 첫인상',
    step3Desc: (maxPhotos) => `선택한 언어별 제목을 입력하고 대표사진을 올려주세요. (최대 ${maxPhotos}장)`,
    titlePlaceholder: '체험 제목을 입력하세요',
    titleSectionLabel: '언어별 제목',
    titleHelp: '게스트가 한눈에 이해할 수 있게 장소, 분위기, 핵심 경험이 드러나면 좋아요.',
    firstPhotoNotice: '첫 번째 대표사진이 체험 상세 페이지 상단에서 가장 먼저 보여집니다.',
    photoHelp: '대표사진에는 호스트 얼굴이 보이는 사진을 최소 1장 이상 반드시 포함해주세요.',
    popularityWishlistHelp:
      '인기 체험 노출은 게스트의 위시리스트 저장 수를 바탕으로 집계됩니다. 저장하고 싶은 체험이 되도록 사진, 소개, 후기 경험을 꾸준히 관리해보세요.',
    photoGuideTitle: '좋은 대표사진이란?',
    photoGuideBody: '장소 분위기와 실제 경험이 잘 보이고, 과도한 보정보다 현장감을 주는 사진이 좋습니다. 게스트가 “이 체험을 바로 상상할 수 있는지”를 기준으로 골라주세요.',
    photoGuideExamplesTitle: '이런 사진이 좋아요',
    photoGuideExamples: [
      '예: 호스트와 게스트가 실제로 걷거나 체험하는 장면이 보이는 사진',
      '예: 장소 분위기와 시간대가 자연스럽게 드러나는 밝은 현장 사진',
      '피해야 할 예: 장소가 잘 안 보이는 셀카, 과한 필터 사진, 텍스트가 많은 이미지',
    ],
    addHeroPhoto: '대표사진 추가',
    mainPhotoBadge: '메인',
    step4Title: '어디서 만날까요?',
    step4Desc: '게스트가 바로 이해할 수 있게 만나는 장소와 체험 흐름을 적어주세요.',
    meetingPointLabel: '만나는 장소',
    meetingPointPlaceholder: '예) 스타벅스 홍대역점',
    meetingPointHelp: '게스트가 실제로 처음 만날 장소를 쉽게 찾을 수 있게 적어주세요.',
    addressPlaceholder: '예) 서울특별시 마포구 양화로 165',
    addressHelp: '* 구글맵에서 검색 가능한 정확한 주소를 입력해주세요.',
    itinerarySectionTitle: '체험 상세 내용',
    itineraryHelp: '각 구간에서 무엇을 하는지 짧고 분명하게 적어주세요.',
    step4GuideTitle: '만나는 장소와 동선은 이렇게 생각해주세요',
    step4GuideBody: '만나는 장소는 게스트가 처음 찾는 기준점이고, 정확한 주소는 길찾기와 운영 검토에 사용됩니다. 동선은 게스트가 “이 체험이 어떻게 흘러가는지”를 상상할 수 있게 적는 것이 좋습니다.',
    step4GuideExamplesTitle: '좋은 입력 예시',
    step4GuideExamples: [
      '만나는 장소 예: 스타벅스 홍대입구역 8번 출구점 앞',
      '정확한 주소 예: 서울 마포구 양화로 165',
      '동선 예: 홍대 골목 산책 → 로컬 디저트 카페 방문 → 포토 스팟에서 마무리',
    ],
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
    descriptionHelp: '게스트가 왜 이 체험을 예약해야 하는지 자연스럽게 이해할 수 있게 적어주세요.',
    step5GuideTitle: '좋은 소개글은 무엇이 다른가요?',
    step5GuideBody: '무엇을 하는지, 어떤 분위기인지, 누구에게 잘 맞는지, 현장에서 어떤 포인트를 기대할 수 있는지를 포함하면 훨씬 설득력이 높아집니다.',
    step5GuideExamplesTitle: '이런 식으로 쓰면 더 좋아요',
    step5GuideExamples: [
      '소개 예: 관광지 설명보다 “현지 친구와 동네를 걷는 느낌”처럼 실제 분위기가 떠오르게 적기',
      '포함 사항 예: 로컬 디저트 1종, 호스트 가이드, 추천 사진 포인트 안내',
      '불포함 사항 예: 개인 교통비, 추가 주문 음료, 개인 쇼핑 비용',
    ],
    inclusionsLabel: '포함 사항',
    inclusionsHelp: '가격에 포함된 것을 명확히 써야 게스트가 안심합니다.',
    inclusionsPlaceholder: '예) 음료',
    exclusionsLabel: '불포함 사항',
    exclusionsHelp: '현장에서 추가 비용 오해가 없도록 꼭 구분해주세요.',
    exclusionsPlaceholder: '예) 개인 교통비',
    suppliesLabel: '준비물 (선택)',
    suppliesHelp: '게스트가 미리 준비해야 할 것이 있다면 꼭 알려주세요.',
    suppliesPlaceholder: '예) 편한 운동화, 생수',
    step6Title: '기본 규칙 설정',
    step6Desc: '소요 시간과 참여 기준을 정리해주세요.',
    durationLabel: '소요 시간',
    durationUnit: '시간',
    maxGuestsLabel: '최대 인원',
    maxGuestsUnit: '명',
    ageLimitLabel: '참가 연령',
    ageLimitPlaceholder: '예) 만 7세 이상',
    ageLimitHelp: '현장에서 바로 혼선이 생기지 않도록 참여 기준을 분명히 적어주세요.',
    activityLevelLabel: '활동 강도',
    hostNoticeLabel: '호스트 주의사항',
    hostNoticeHelp: '게스트가 예약 전에 꼭 알아야 할 점을 적어주세요. 예: 실내 진행, 계단 이동, 우천 시 동선 변경, 편한 신발 추천',
    hostNoticePlaceholder: '예) 골목길이 많아 편한 운동화를 추천해요. 비가 오면 실내 코스로 일부 조정될 수 있어요.',
    refundPolicyLabel: '환불 정책',
    refundPolicyHelp: '환불 정책은 고정으로 자동 적용됩니다.',
    refundPolicyItems: [
      '체험일 당일/지난 일정: 환불 불가',
      '결제 당일 취소: 100%',
      '20일 전: 100%',
      '8~19일 전: 80%',
      '2~7일 전: 70%',
      '1일 전: 40%',
    ],
    step7Title: '요금 설정',
    step7Desc: '가격을 설정하세요.',
    priceLabel: '기본 1인당 가격',
    pricePlaceholder: '50,000',
    priceHelp: '게스트가 경험의 가치를 이해할 수 있도록 포함 항목과 함께 생각해주세요.',
    pricingGuideTitle: '가격을 정할 때 이런 기준이 좋아요',
    pricingGuideBody: '소요 시간, 포함 항목, 이동 동선, 준비 난이도, 현장 케어 수준을 함께 생각하면 가격을 더 자신 있게 정할 수 있습니다. 너무 싸게 시작하기보다 경험의 가치를 설명할 수 있는 가격이 좋습니다.',
    pricingGuideExamplesTitle: '가격을 생각할 때 체크할 점',
    pricingGuideExamples: [
      '기본 가격 예: 2시간 투어 + 간단한 간식 포함 + 사진 포인트 안내',
      '단독 투어 가격 예: 우리 팀만 참여하고 이동 동선 조율이 포함되는 경우',
      '너무 낮은 가격보다 “무엇이 포함되는지”가 설명되는 가격이 신뢰를 줍니다.',
    ],
    soloGuaranteeTitle: '1인 출발 확정 옵션',
    soloGuaranteeDesc: '혼자 예약한 게스트가 이 옵션을 선택하면 최소 인원 미달이어도 취소 없이 출발합니다.',
    soloGuaranteeRefundNote: '*추가 인원 모객 시 게스트에게 자동 환불',
    soloGuaranteeHostNote: '이 옵션이 선택되면 호스트 정산 기준은 설정한 기본 가격에 30,000원이 더해집니다.',
    privateOptionLabel: '단독 투어 옵션',
    privateOptionDesc: '다른 게스트 없이 우리 그룹만 참여하는 프라이빗 투어 가격을 설정합니다.',
    privatePriceHelp: '기본 가격과 별도로, 우리 그룹만 참여할 때의 고정 가격을 정하는 옵션입니다.',
    privatePricePlaceholder: '120,000',
    step8Title: '체험 등록 완료! 🎉',
    step8DescLine1: '관리자 검토 후 공개됩니다.',
    step8DescLine2: '미리 일정을 열어 예약을 준비해보세요.',
    step8Button: '내 체험 보러가기',
    step8ScheduleButton: '일정 관리하기',
    prevButton: '이전',
    nextButton: '다음',
    submitButton: '체험 등록하기',
    submittingButton: '등록 중...',
    validationCity: '도시를 선택하거나 직접 입력해주세요.',
    validationCategory: '카테고리를 선택해주세요.',
    validationLanguages: '진행 가능한 언어를 1개 이상 선택해주세요.',
    validationLanguageLevels: '선택한 각 언어의 레벨을 설정해주세요.',
    validationSourceLocale: '대표 언어를 선택해주세요.',
    validationTitle: '체험 제목을 6자 이상 입력해주세요.',
    validationPhotos: '대표 사진을 1장 이상 업로드해주세요.',
    validationPhotoLimit: (maxPhotos) => `대표 사진은 최대 ${maxPhotos}장까지 업로드 가능합니다.`,
    validationMeetingPoint: '만나는 장소 이름을 입력해주세요.',
    validationLocation: '정확한 주소를 입력해주세요.',
    validationItineraryTitles: '이동 동선의 장소 이름을 모두 입력해주세요.',
    validationDescription: '상세 설명을 30자 이상 입력해주세요.',
    validationInclusions: '포함 사항을 1개 이상 입력해주세요.',
    validationInclusionItemQuality: '포함 사항은 두 글자 이상으로 구체적으로 입력해주세요.',
    validationExclusionItemQuality: '불포함 사항은 두 글자 이상으로 구체적으로 입력해주세요.',
    validationDuplicateListItem: '같은 항목은 한 번만 추가해주세요.',
    validationSuppliesQuality: '준비물은 네 글자 이상으로 구체적으로 적어주세요.',
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
    categoryHelp: 'This is one of the first filters guests use when browsing.',
    step2Title: 'Available languages',
    step2Desc: 'Which languages can you host this experience in?',
    sourceLocaleLabel: 'Primary language',
    sourceLocaleHelp: 'Write the main introduction in the language of the guests you want to attract most. Example: if you mainly want to host Korean guests, choose Korean. Other languages will be AI-translated and refined from this primary language.',
    sourceLocaleHelpPrimary: 'Write the main introduction in the language of the guests you want to attract most.',
    sourceLocaleHelpExample: 'Example: if you mainly want to host Korean guests, choose Korean.',
    sourceLocaleHelpAi: 'Other languages will be AI-translated and refined from this primary language.',
    sourceLocaleBadge: 'Primary',
    step3Title: 'First impression of your experience',
    step3Desc: (maxPhotos) => `Add titles for each selected language and upload hero photos. (Up to ${maxPhotos})`,
    titlePlaceholder: 'Enter experience title',
    titleSectionLabel: 'Titles by language',
    titleHelp: 'A strong title quickly shows the place, mood, and core experience.',
    firstPhotoNotice: 'The first hero photo appears at the top of the experience detail page.',
    photoHelp: 'Please include at least one hero photo showing the host’s face.',
    popularityWishlistHelp:
      'Popular experience placement is based on how many times guests save your experience to their wishlist. Keep improving your photos, description, and review experience so your experience becomes one guests want to save.',
    photoGuideTitle: 'What makes a good hero photo?',
    photoGuideBody: 'Choose a photo that clearly shows the atmosphere and what guests will actually experience. Photos feel stronger when they help guests imagine the moment right away.',
    photoGuideExamplesTitle: 'Good example photos',
    photoGuideExamples: [
      'Example: a photo showing the host and guests actually walking or doing the experience',
      'Example: a bright on-site photo that naturally shows the mood and time of day',
      'Avoid: selfies with no clear location, over-filtered images, or graphics with too much text',
    ],
    addHeroPhoto: 'Add hero photo',
    mainPhotoBadge: 'Main',
    step4Title: 'Where will you meet?',
    step4Desc: 'Describe the meeting point and flow so guests can understand it right away.',
    meetingPointLabel: 'Meeting point',
    meetingPointPlaceholder: 'e.g. Starbucks Hongdae Station',
    meetingPointHelp: 'Write it so guests can easily find the exact first meeting spot.',
    addressPlaceholder: 'e.g. 165 Yanghwa-ro, Mapo-gu, Seoul',
    addressHelp: '* Enter an exact address searchable on Google Maps.',
    itinerarySectionTitle: 'Experience itinerary',
    itineraryHelp: 'Keep each stop short and clear so guests can picture the flow.',
    step4GuideTitle: 'Think of meeting point and itinerary this way',
    step4GuideBody: 'The meeting point is the guest’s first anchor. The exact address helps with navigation and review. The itinerary should help guests imagine how the experience unfolds from start to finish.',
    step4GuideExamplesTitle: 'Examples that work well',
    step4GuideExamples: [
      'Meeting point example: In front of Starbucks Hongik Univ. Station Exit 8',
      'Exact address example: 165 Yanghwa-ro, Mapo-gu, Seoul',
      'Itinerary example: Walk through local alleys → visit a dessert cafe → finish at a photo spot',
    ],
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
    descriptionHelp: 'Write this so guests naturally understand why this experience is worth booking.',
    step5GuideTitle: 'What makes a strong description?',
    step5GuideBody: 'A strong description covers what happens, what the mood is like, who it fits best, and what guests can look forward to on the day.',
    step5GuideExamplesTitle: 'Examples that guide better writing',
    step5GuideExamples: [
      'Description example: write the real vibe, like “it feels like walking the neighborhood with a local friend”',
      'Inclusions example: one local dessert, host guidance, photo spot recommendations',
      'Exclusions example: personal transportation, extra drink orders, personal shopping costs',
    ],
    inclusionsLabel: 'Inclusions',
    inclusionsHelp: 'Clear inclusions help guests feel confident about what they are paying for.',
    inclusionsPlaceholder: 'e.g. Drink',
    exclusionsLabel: 'Exclusions',
    exclusionsHelp: 'Separate these clearly so there is no surprise extra cost on site.',
    exclusionsPlaceholder: 'e.g. Personal transportation',
    suppliesLabel: 'What to bring (optional)',
    suppliesHelp: 'If guests should prepare anything in advance, tell them here.',
    suppliesPlaceholder: 'e.g. Comfortable shoes, water',
    step6Title: 'Basic rules',
    step6Desc: 'Set the duration and participation guidelines.',
    durationLabel: 'Duration',
    durationUnit: 'hr',
    maxGuestsLabel: 'Max guests',
    maxGuestsUnit: 'guests',
    ageLimitLabel: 'Age requirement',
    ageLimitPlaceholder: 'e.g. Ages 7 and up',
    ageLimitHelp: 'Clear participation rules help avoid confusion on the day.',
    activityLevelLabel: 'Activity level',
    hostNoticeLabel: 'Host notice',
    hostNoticeHelp: 'Add anything guests should know before booking. For example: indoor route, stairs, rainy-day adjustments, or comfortable shoes recommended.',
    hostNoticePlaceholder: 'e.g. There are a lot of alleys, so comfortable walking shoes are recommended. If it rains, part of the route may move indoors.',
    refundPolicyLabel: 'Refund policy',
    refundPolicyHelp: 'The refund policy is fixed and applied automatically.',
    refundPolicyItems: [
      'Experience day or past dates: Non-refundable',
      'Cancellation on the payment day: 100%',
      '20 days before: 100%',
      '8–19 days before: 80%',
      '2–7 days before: 70%',
      '1 day before: 40%',
    ],
    step7Title: 'Pricing',
    step7Desc: 'Set your price.',
    priceLabel: 'Base price per guest',
    pricePlaceholder: '50,000',
    priceHelp: 'Think about price together with duration, inclusions, and the value guests will feel.',
    pricingGuideTitle: 'A simple way to think about pricing',
    pricingGuideBody: 'Consider time, inclusions, route complexity, preparation effort, and how much care you provide on the day. A confident price with a clear value story works better than pricing too low.',
    pricingGuideExamplesTitle: 'What to check before setting your price',
    pricingGuideExamples: [
      'Base price example: a 2-hour walk with a light snack and photo spot guidance',
      'Private price example: only one group joins and the route can be adjusted for them',
      'A clear value story builds more trust than setting the price too low.',
    ],
    soloGuaranteeTitle: 'Guaranteed solo departure option',
    soloGuaranteeDesc: 'If a solo guest buys this option, the experience can go ahead without cancellation even when the minimum group size is not met.',
    soloGuaranteeRefundNote: '*Automatically refunded to the guest if more people join later',
    soloGuaranteeHostNote: 'When this option is purchased, your payout is based on your set price plus 30,000 KRW.',
    privateOptionLabel: 'Private tour option',
    privateOptionDesc: 'Set a fixed price for a private tour where only the booking group participates.',
    privatePriceHelp: 'Use this when you want a separate fixed price for one booking group only.',
    privatePricePlaceholder: '120,000',
    step8Title: 'Experience submitted! 🎉',
    step8DescLine1: 'It will be published after admin review.',
    step8DescLine2: 'Open your schedule in advance to get ready for bookings.',
    step8Button: 'View my experiences',
    step8ScheduleButton: 'Manage schedule',
    prevButton: 'Back',
    nextButton: 'Next',
    submitButton: 'Submit experience',
    submittingButton: 'Submitting...',
    validationCity: 'Choose a city or enter one directly.',
    validationCategory: 'Choose a category.',
    validationLanguages: 'Select at least one available language.',
    validationLanguageLevels: 'Set a level for each selected language.',
    validationSourceLocale: 'Choose the primary language.',
    validationTitle: 'Enter a title with at least 6 characters.',
    validationPhotos: 'Upload at least one hero photo.',
    validationPhotoLimit: (maxPhotos) => `You can upload up to ${maxPhotos} hero photos.`,
    validationMeetingPoint: 'Enter the meeting point name.',
    validationLocation: 'Enter an exact address.',
    validationItineraryTitles: 'Enter a place name for every itinerary stop.',
    validationDescription: 'Enter at least 30 characters for the description.',
    validationInclusions: 'Add at least one inclusion.',
    validationInclusionItemQuality: 'Make each inclusion specific and at least 2 characters long.',
    validationExclusionItemQuality: 'Make each exclusion specific and at least 2 characters long.',
    validationDuplicateListItem: 'Add each item only once.',
    validationSuppliesQuality: 'If you add supplies, describe them in at least 4 characters.',
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
    categoryHelp: 'ゲストが体験を探すときに最初に見る分類の一つです。',
    step2Title: '対応可能な言語',
    step2Desc: 'この体験はどの言語で進行できますか？',
    sourceLocaleLabel: '代表言語',
    sourceLocaleHelp: '主に受け入れたいゲストの言語で代表紹介文を作成してください。例：韓国人ゲストを主に受け入れたい場合は韓国語を選択してください。ほかの言語はこの代表言語を基準にAI自動翻訳と補正が行われます。',
    sourceLocaleHelpPrimary: '主に受け入れたいゲストの言語で代表紹介文を作成してください。',
    sourceLocaleHelpExample: '例：韓国人ゲストを主に受け入れたい場合は韓国語を選択してください。',
    sourceLocaleHelpAi: 'ほかの言語はこの代表言語を基準にAI自動翻訳と補正が行われます。',
    sourceLocaleBadge: '代表',
    step3Title: '体験の第一印象',
    step3Desc: (maxPhotos) => `選択した各言語のタイトルを入力し、代表写真をアップロードしてください。（最大${maxPhotos}枚）`,
    titlePlaceholder: '体験タイトルを入力してください',
    titleSectionLabel: '言語別タイトル',
    titleHelp: '場所、雰囲気、体験の核がひと目で伝わるタイトルが理想です。',
    firstPhotoNotice: '最初の代表写真が体験詳細ページ上部に最初に表示されます。',
    photoHelp: '代表写真には、ホスト本人の顔が見える写真を最低1枚以上必ず含めてください。',
    popularityWishlistHelp:
      '人気体験の表示は、ゲストのウィッシュリスト保存数をもとに集計されます。保存したくなる体験になるよう、写真・紹介文・レビュー体験を継続的に整えてみてください。',
    photoGuideTitle: '良い代表写真とは？',
    photoGuideBody: '現場の雰囲気と実際の体験内容がよく伝わり、ゲストがすぐにその場面を想像できる写真がおすすめです。',
    photoGuideExamplesTitle: 'おすすめの写真例',
    photoGuideExamples: [
      '例：ホストとゲストが実際に歩いたり体験している様子が見える写真',
      '例：場所の雰囲気や時間帯が自然に伝わる明るい現地写真',
      '避けたい例：場所が分かりにくい自撮り、過度なフィルター写真、文字が多い画像',
    ],
    addHeroPhoto: '代表写真を追加',
    mainPhotoBadge: 'メイン',
    step4Title: 'どこで会いますか？',
    step4Desc: 'ゲストがすぐ理解できるように集合場所と体験の流れを書いてください。',
    meetingPointLabel: '集合場所',
    meetingPointPlaceholder: '例）スターバックス弘大駅店',
    meetingPointHelp: 'ゲストが最初に迷わず見つけられるように書いてください。',
    addressPlaceholder: '例）ソウル特別市 麻浦区 楊花路 165',
    addressHelp: '* Google Maps で検索できる正確な住所を入力してください。',
    itinerarySectionTitle: '体験の詳細内容',
    itineraryHelp: '各区間で何をするのかを短く分かりやすく書いてください。',
    step4GuideTitle: '集合場所と動線はこう考えると分かりやすいです',
    step4GuideBody: '集合場所はゲストが最初に探す基準点です。正確な住所は道案内や審査確認に使われます。動線は、体験がどう進むかを想像できるように書くのがポイントです。',
    step4GuideExamplesTitle: '良い入力例',
    step4GuideExamples: [
      '集合場所の例：弘大入口駅8番出口前のスターバックス',
      '正確な住所の例：ソウル特別市 麻浦区 楊花路 165',
      '動線の例：ローカル路地散策 → デザートカフェ訪問 → 写真スポットで終了',
    ],
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
    descriptionHelp: 'ゲストが「なぜこの体験を予約したいのか」を自然に理解できる説明が理想です。',
    step5GuideTitle: '良い紹介文のポイント',
    step5GuideBody: '何をするのか、どんな雰囲気なのか、どんな人に向いているのか、当日に何を期待できるのかまで入れると、ぐっと説得力が高まります。',
    step5GuideExamplesTitle: 'こう書くと伝わりやすいです',
    step5GuideExamples: [
      '紹介文の例：「観光案内」よりも「ローカルの友人と街を歩くような雰囲気」と書く',
      '含まれるものの例：ローカルスイーツ1品、ホスト案内、写真スポット紹介',
      '含まれないものの例：個人の交通費、追加ドリンク、個人の買い物費用',
    ],
    inclusionsLabel: '含まれるもの',
    inclusionsHelp: '料金に含まれる内容を明確にすると、ゲストが安心して予約できます。',
    inclusionsPlaceholder: '例）ドリンク',
    exclusionsLabel: '含まれないもの',
    exclusionsHelp: '現地で追加費用の誤解が出ないように、必ず分けて書いてください。',
    exclusionsPlaceholder: '例）個人の交通費',
    suppliesLabel: '持ち物（任意）',
    suppliesHelp: '事前に準備してほしいものがあればここで案内してください。',
    suppliesPlaceholder: '例）歩きやすい靴、水',
    step6Title: '基本ルール設定',
    step6Desc: '所要時間と参加条件を整理してください。',
    durationLabel: '所要時間',
    durationUnit: '時間',
    maxGuestsLabel: '最大人数',
    maxGuestsUnit: '名',
    ageLimitLabel: '参加年齢',
    ageLimitPlaceholder: '例）満7歳以上',
    ageLimitHelp: '当日に混乱が起きないよう、参加基準ははっきり書いてください。',
    activityLevelLabel: '活動強度',
    hostNoticeLabel: 'ホストからの案内',
    hostNoticeHelp: '予約前に必ず知っておいてほしいことを書いてください。例：屋内進行、階段移動、雨天時の動線変更、歩きやすい靴のおすすめ。',
    hostNoticePlaceholder: '例）路地が多いので歩きやすいスニーカーがおすすめです。雨の日は一部のコースを屋内に変更する場合があります。',
    refundPolicyLabel: '返金ポリシー',
    refundPolicyHelp: '返金ポリシーは固定で自動適用されます。',
    refundPolicyItems: [
      '体験当日 / 過ぎた日程: 返金不可',
      '決済当日のキャンセル: 100%',
      '20日前: 100%',
      '8〜19日前: 80%',
      '2〜7日前: 70%',
      '1日前: 40%',
    ],
    step7Title: '料金設定',
    step7Desc: '価格を設定してください。',
    priceLabel: '基本の1人あたり価格',
    pricePlaceholder: '50,000',
    priceHelp: '所要時間、含まれる内容、ゲストが感じる価値を一緒に考えて価格を決めてください。',
    pricingGuideTitle: '価格を決めるときの考え方',
    pricingGuideBody: '時間、含まれる内容、移動動線、準備の手間、当日のケアの深さを合わせて考えると決めやすくなります。安くしすぎるより、価値を説明できる価格のほうが長く続けやすいです。',
    pricingGuideExamplesTitle: '価格を考えるときのチェック例',
    pricingGuideExamples: [
      '基本価格の例：2時間の散策＋軽いおやつ＋写真スポット案内',
      'プライベート価格の例：1組限定で参加し、動線調整まで含まれる場合。安すぎる価格より、何が含まれているかが伝わる価格のほうが信頼されやすいです。',
    ],
    soloGuaranteeTitle: '1名出発確定オプション',
    soloGuaranteeDesc: '1名予約のゲストがこのオプションを選ぶと、最少人数に満たなくてもキャンセルなしで出発できます。',
    soloGuaranteeRefundNote: '*後から参加者が増えた場合はゲストへ自動返金',
    soloGuaranteeHostNote: 'このオプションが購入されると、ホスト精算基準は設定した基本価格に30,000ウォンが加算されます。',
    privateOptionLabel: 'プライベートツアーオプション',
    privateOptionDesc: '他のゲストなしで、グループだけが参加するプライベートツアーの価格を設定します。',
    privatePriceHelp: '1組だけで参加する場合の固定価格を別で設定したいときに使います。',
    privatePricePlaceholder: '120,000',
    step8Title: '体験登録が完了しました！ 🎉',
    step8DescLine1: '管理者の確認後に公開されます。',
    step8DescLine2: '事前に日程を開けて、予約の受付を準備してみましょう。',
    step8Button: '自分の体験を見る',
    step8ScheduleButton: '日程を管理する',
    prevButton: '戻る',
    nextButton: '次へ',
    submitButton: '体験を登録する',
    submittingButton: '登録中...',
    validationCity: '都市を選択するか直接入力してください。',
    validationCategory: 'カテゴリを選択してください。',
    validationLanguages: '対応可能な言語を1つ以上選択してください。',
    validationLanguageLevels: '選択した各言語のレベルを設定してください。',
    validationSourceLocale: '代表言語を選択してください。',
    validationTitle: '体験タイトルを6文字以上入力してください。',
    validationPhotos: '代表写真を1枚以上アップロードしてください。',
    validationPhotoLimit: (maxPhotos) => `代表写真は最大${maxPhotos}枚までアップロードできます。`,
    validationMeetingPoint: '集合場所名を入力してください。',
    validationLocation: '正確な住所を入力してください。',
    validationItineraryTitles: '移動ルートの場所名をすべて入力してください。',
    validationDescription: '詳細説明を30文字以上入力してください。',
    validationInclusions: '含まれるものを1つ以上入力してください。',
    validationInclusionItemQuality: '含まれるものは2文字以上で具体的に入力してください。',
    validationExclusionItemQuality: '含まれないものは2文字以上で具体的に入力してください。',
    validationDuplicateListItem: '同じ項目は1回だけ追加してください。',
    validationSuppliesQuality: '持ち物を書く場合は4文字以上で具体的に入力してください。',
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
    categoryHelp: '这是游客浏览时最先看到的分类之一。',
    step2Title: '可使用语言',
    step2Desc: '这个体验可以用哪些语言进行？',
    sourceLocaleLabel: '代表语言',
    sourceLocaleHelp: '请使用你主要想接待的游客语言来撰写主介绍。例：如果你主要想接待韩国游客，就选择韩语。其他语言将基于该代表语言进行 AI 自动翻译和润色。',
    sourceLocaleHelpPrimary: '请使用你主要想接待的游客语言来撰写主介绍。',
    sourceLocaleHelpExample: '例：如果你主要想接待韩国游客，就选择韩语。',
    sourceLocaleHelpAi: '其他语言将基于该代表语言进行 AI 自动翻译和润色。',
    sourceLocaleBadge: '代表',
    step3Title: '体验的第一印象',
    step3Desc: (maxPhotos) => `请填写所选语言的标题并上传代表照片。（最多${maxPhotos}张）`,
    titlePlaceholder: '请输入体验标题',
    titleSectionLabel: '按语言填写标题',
    titleHelp: '如果能一眼看出地点、氛围和核心体验，会更吸引游客。',
    firstPhotoNotice: '第一张代表照片会显示在体验详情页顶部。',
    photoHelp: '代表照片中请至少包含一张能看到房东本人脸部的照片。',
    popularityWishlistHelp:
      '热门体验展示会根据游客加入愿望清单的保存数量进行统计。请持续优化照片、介绍和评价体验，让你的体验成为游客愿意先收藏的内容。',
    photoGuideTitle: '什么样的代表照片更好？',
    photoGuideBody: '建议选择能清楚展示现场氛围和实际体验内容的照片，让游客一眼就能想象自己会经历什么。',
    photoGuideExamplesTitle: '推荐的照片示例',
    photoGuideExamples: [
      '例如：能看到房东与游客真正一起行走或体验的照片',
      '例如：自然展示现场氛围和时间感的明亮实景照片',
      '应避免：看不出地点的自拍、滤镜过重的照片、文字很多的图片',
    ],
    addHeroPhoto: '添加代表照片',
    mainPhotoBadge: '主图',
    step4Title: '在哪里见面？',
    step4Desc: '请填写集合地点和体验流程，让房客一眼就能理解。',
    meetingPointLabel: '集合地点',
    meetingPointPlaceholder: '例如：弘大站星巴克',
    meetingPointHelp: '请写成游客第一次见面时能轻松找到的地点说明。',
    addressPlaceholder: '例如：首尔特别市麻浦区杨花路165',
    addressHelp: '* 请输入可以在 Google Maps 搜索到的准确地址。',
    itinerarySectionTitle: '体验详细内容',
    itineraryHelp: '请简短而清楚地写出每一段会做什么。',
    step4GuideTitle: '集合地点和流程可以这样理解',
    step4GuideBody: '集合地点是游客最先寻找的基准点，准确地址用于导航和审核确认。流程说明则应该帮助游客想象整个体验如何展开。',
    step4GuideExamplesTitle: '好的填写示例',
    step4GuideExamples: [
      '集合地点示例：弘大入口站8号出口前的星巴克',
      '准确地址示例：首尔麻浦区杨花路165',
      '流程示例：本地巷子散步 → 甜点咖啡馆停留 → 在拍照点结束',
    ],
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
    descriptionHelp: '请写成让游客自然理解“为什么值得预订”的介绍。',
    step5GuideTitle: '好的介绍文通常会包含什么？',
    step5GuideBody: '如果能说明会做什么、整体氛围、适合什么样的游客，以及当天最值得期待的部分，介绍会更有说服力。',
    step5GuideExamplesTitle: '这样写会更容易理解',
    step5GuideExamples: [
      '介绍示例：不要只写观光介绍，可以写成“像和本地朋友一起逛街”的真实氛围',
      '包含内容示例：1份本地甜点、房东带路、拍照点推荐',
      '不包含内容示例：个人交通费、额外饮品、个人购物费用',
    ],
    inclusionsLabel: '包含内容',
    inclusionsHelp: '明确写出价格中包含什么，游客会更安心。',
    inclusionsPlaceholder: '例如：饮品',
    exclusionsLabel: '不包含内容',
    exclusionsHelp: '请明确区分不包含内容，避免现场产生额外费用误会。',
    exclusionsPlaceholder: '例如：个人交通费',
    suppliesLabel: '需准备物品（可选）',
    suppliesHelp: '如果游客需要提前准备什么，请在这里提前说明。',
    suppliesPlaceholder: '例如：舒适的运动鞋、饮用水',
    step6Title: '基本规则设置',
    step6Desc: '请整理所需时间和参与条件。',
    durationLabel: '所需时间',
    durationUnit: '小时',
    maxGuestsLabel: '最大人数',
    maxGuestsUnit: '人',
    ageLimitLabel: '参加年龄',
    ageLimitPlaceholder: '例如：满7岁以上',
    ageLimitHelp: '请明确填写参加条件，避免现场产生混乱。',
    activityLevelLabel: '活动强度',
    hostNoticeLabel: '主办方提醒',
    hostNoticeHelp: '请写下游客在预订前一定要知道的内容。例如：室内进行、需要走楼梯、下雨时路线调整、建议穿舒适的鞋子。',
    hostNoticePlaceholder: '例如：路线里有不少小巷，建议穿舒适的运动鞋。下雨时，部分行程可能调整为室内路线。',
    refundPolicyLabel: '退款政策',
    refundPolicyHelp: '退款政策为固定并自动应用。',
    refundPolicyItems: [
      '行程当天/已过日期：不可退款',
      '付款当日取消：100%',
      '20天前：100%',
      '8~19天前：80%',
      '2~7天前：70%',
      '1天前：40%',
    ],
    step7Title: '价格设置',
    step7Desc: '请设置价格。',
    priceLabel: '基础单价（每人）',
    pricePlaceholder: '50,000',
    priceHelp: '请结合时长、包含内容和游客能感受到的价值来考虑价格。',
    pricingGuideTitle: '设定价格时可以这样想',
    pricingGuideBody: '可以一起考虑时长、包含内容、路线复杂度、准备难度以及当天的陪同与照顾程度。比起一味压低价格，更重要的是设定一个能体现体验价值的价格。',
    pricingGuideExamplesTitle: '定价前可以先看这几个点',
    pricingGuideExamples: [
      '基础价格示例：2小时步行体验 + 简单点心 + 拍照点推荐',
      '私享价格示例：只有一个团队参加，并包含路线调整时',
      '比起过低价格，能解释清楚价值的价格更容易建立信任。',
    ],
    soloGuaranteeTitle: '1人出发保障选项',
    soloGuaranteeDesc: '如果单人游客购买这个选项，即使未达到最低成团人数，也可以不取消直接出发。',
    soloGuaranteeRefundNote: '*后续有更多游客加入时，会自动退还给游客',
    soloGuaranteeHostNote: '当这个选项被购买时，主办方结算会按你设置的基础价格再加 30,000 韩元计算。',
    privateOptionLabel: '私人团选项',
    privateOptionDesc: '设置仅预订团体参加、无其他游客的私人团价格。',
    privatePriceHelp: '如果想为单独一组游客设置固定价格，可以开启这个选项。',
    privatePricePlaceholder: '120,000',
    step8Title: '体验提交完成！ 🎉',
    step8DescLine1: '管理员审核后将会公开。',
    step8DescLine2: '请先开放日程，提前做好接待预订的准备。',
    step8Button: '查看我的体验',
    step8ScheduleButton: '管理日程',
    prevButton: '上一步',
    nextButton: '下一步',
    submitButton: '提交体验',
    submittingButton: '提交中...',
    validationCity: '请选择城市或直接输入城市。',
    validationCategory: '请选择类别。',
    validationLanguages: '请至少选择一种可使用语言。',
    validationLanguageLevels: '请为每种已选语言设置等级。',
    validationSourceLocale: '请选择代表语言。',
    validationTitle: '请输入至少6个字的体验标题。',
    validationPhotos: '请至少上传一张代表照片。',
    validationPhotoLimit: (maxPhotos) => `代表照片最多可上传${maxPhotos}张。`,
    validationMeetingPoint: '请输入集合地点名称。',
    validationLocation: '请输入准确地址。',
    validationItineraryTitles: '请填写所有路线地点名称。',
    validationDescription: '请输入至少30个字的详细说明。',
    validationInclusions: '请至少填写一项包含内容。',
    validationInclusionItemQuality: '包含内容请至少填写2个字并尽量具体。',
    validationExclusionItemQuality: '不包含内容请至少填写2个字并尽量具体。',
    validationDuplicateListItem: '相同项目只需添加一次。',
    validationSuppliesQuality: '如果填写需准备物品，请至少写4个字并尽量具体。',
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
