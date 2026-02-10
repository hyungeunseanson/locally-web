export const validateImage = (file: File): { valid: boolean; message?: string } => {
    // 1. 파일 형식 검사 (이미지 파일인지)
    if (!file.type.startsWith('image/')) {
      return { valid: false, message: '🚫 이미지 파일(jpg, png, webp 등)만 업로드 가능합니다.' };
    }
  
    // 2. 용량 제한 (5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return { valid: false, message: '🚫 파일 크기는 5MB를 초과할 수 없습니다.' };
    }
  
    return { valid: true };
  };
  
  /**
   * (선택사항) 이미지 파일 이름을 안전하게 변경 (한글 깨짐 방지 등)
   * 예: "내사진.jpg" -> "17098239123-random.jpg"
   */
  export const sanitizeFileName = (fileName: string): string => {
    const fileExt = fileName.split('.').pop();
    const randomString = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    return `${timestamp}-${randomString}.${fileExt}`;
  };