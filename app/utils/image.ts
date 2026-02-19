import imageCompression from 'browser-image-compression';

export const validateImage = (file: File): { valid: boolean; message?: string } => {
    // 1. 파일 형식 검사 (이미지 파일인지)
    if (!file.type.startsWith('image/')) {
      return { valid: false, message: '🚫 이미지 파일(jpg, png, webp 등)만 업로드 가능합니다.' };
    }
  
    // 2. 용량 제한 (10MB - 압축 전 단계이므로 조금 더 넉넉하게 허용)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return { valid: false, message: '🚫 원본 파일 크기는 10MB를 초과할 수 없습니다.' };
    }
  
    return { valid: true };
  };

  /**
   * 이미지 압축 및 리사이징 유틸리티
   */
  export const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,            // 최대 용량 1MB로 압축
      maxWidthOrHeight: 1280,  // 최대 해상도 1280px (HD급)
      useWebWorker: true,
      fileType: 'image/jpeg'   // 용량 최적화를 위해 jpeg로 변환
    };
    
    try {
      const compressedBlob = await imageCompression(file, options);
      return new File([compressedBlob], file.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error('Image compression failed:', error);
      return file; // 실패 시 원본 반환
    }
  };
  
  /**
   * (선택사항) 이미지 파일 이름을 안전하게 변경 (한글 깨짐 방지 등)
   * 예: "내사진.jpg" -> "17098239123-random.jpg"
   */
  export const sanitizeFileName = (fileName: string): string => {
    const fileExt = fileName.split('.').pop() || 'jpg';
    const randomString = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    return `${timestamp}-${randomString}.${fileExt}`;
  };