'use client';

interface ImageModalProps {
  imageData: string;
  onClose: () => void;
  commentId?: number;
  displayNumber?: number;
}

export default function ImageModal({ imageData, onClose, commentId, displayNumber }: ImageModalProps) {
  const handleDownload = () => {
    // Convert base64 to blob for proper download
    const byteString = atob(imageData.split(',')[1]);
    const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename
    const ext = mimeString.includes('png') ? 'png' : 'jpg';
    const num = displayNumber || commentId || 'screenshot';
    link.download = `feedback-${num}.${ext}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    // Convert base64 to blob for proper filename in new tab
    const byteString = atob(imageData.split(',')[1]);
    const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-[95vw] max-h-[95vh]">
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenInNewTab(); }}
            className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200"
            title="Open in new tab"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200"
            title="Download image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200"
            title="Close"
          >
            ✕
          </button>
        </div>
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
