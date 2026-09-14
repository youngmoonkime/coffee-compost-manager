/** 기록 한 건에 올릴 수 있는 사진 수 (시트에 썸네일 칸이 3개) */
export const MAX_PHOTOS_PER_RECORD = 3;

/**
 * 휴대폰 원본(3~8MB)을 그대로 보내면 현장 통신으로는 업로드가 너무 오래 걸린다.
 * 긴 변 1280px · JPEG 80% 로 줄이면 한 장에 200~400KB 정도라 시트에서 보기에도 충분하다.
 */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

/** 사진 파일을 줄여서 JPEG data URL 로 만든다. 브라우저가 촬영 방향(EXIF)을 반영해 그린다. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('사진을 처리할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이 사진 형식은 열 수 없습니다.'));
    };

    img.src = objectUrl;
  });
}

export function getDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** 링크가 있는 사람 누구나 볼 수 있게 공유된 파일이어야 보인다 */
export function getDriveThumbnailUrl(fileId: string, width = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}
