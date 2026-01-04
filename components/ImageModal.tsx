'use client';

interface ImageModalProps {
  imageData: string;
  onClose: () => void;
}

export default function ImageModal({ imageData, onClose }: ImageModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-[95vw] max-h-[95vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200 z-10"
        >
          ✕
        </button>
        <img
          src={imageData}
          alt="Expanded screenshot"
          className="max-w-full max-h-[95vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
