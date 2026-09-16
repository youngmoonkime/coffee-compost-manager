import React, { useRef } from 'react';
import { MAX_PHOTOS_PER_RECORD } from '../../../utils/photos';
import { Button } from '../../ui/Button';

interface PhotoStepProps {
  photoDrafts: string[];
  setPhotoDrafts: React.Dispatch<React.SetStateAction<string[]>>;
  isPreparingPhotos: boolean;
  onPhotoFiles: (input: HTMLInputElement) => void;
  photoSlotsLeft: number;
}

export const PhotoStep: React.FC<PhotoStepProps> = ({
  photoDrafts,
  setPhotoDrafts,
  isPreparingPhotos,
  onPhotoFiles,
  photoSlotsLeft,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const removePhoto = (index: number) => {
    setPhotoDrafts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* 사진 선택/촬영 버튼 그룹 */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* 카메라로 바로 촬영 */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          icon="photo_camera"
          disabled={photoSlotsLeft <= 0 || isPreparingPhotos}
          onClick={() => cameraInputRef.current?.click()}
        >
          카메라 촬영
        </Button>

        {/* 앨범에서 선택 */}
        <Button
          type="button"
          variant="secondary"
          size="md"
          icon="image"
          disabled={photoSlotsLeft <= 0 || isPreparingPhotos}
          onClick={() => galleryInputRef.current?.click()}
        >
          사진 보관함
        </Button>

        {/* 숨김 file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => onPhotoFiles(e.target)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => onPhotoFiles(e.target)}
        />
      </div>

      {isPreparingPhotos && (
        <div className="p-3 text-center text-xs text-[#315C36] dark:text-[#34C759] font-semibold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px] animate-spin">
            progress_activity
          </span>
          사진 최적화 압축 중…
        </div>
      )}

      {/* 사진 미리보기 그리드 */}
      {photoDrafts.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5">
          {photoDrafts.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-2xl overflow-hidden bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 shadow-xs"
            >
              <img src={src} alt={`현장 사진 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="사진 삭제"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="apple-card p-6 text-center border-dashed border-black/15 dark:border-white/15 bg-white/60 dark:bg-[#2C2C2E]/40">
          <span className="material-symbols-outlined text-[32px] text-[#6E6E73]/50 dark:text-[#8E8E93]/50 block mb-1">
            add_a_photo
          </span>
          <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] block">
            파봉 작업 및 더미 상태 사진을 첨부하세요 (선택)
          </span>
          <span className="text-[11px] text-[#6E6E73]/70 dark:text-[#8E8E93]/70 block mt-0.5">
            최대 {MAX_PHOTOS_PER_RECORD}장까지 자동 압축되어 보관됩니다
          </span>
        </div>
      )}
    </div>
  );
};
