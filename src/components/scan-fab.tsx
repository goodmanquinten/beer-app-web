"use client";

import { useRef, useState, useCallback } from "react";
import CameraViewfinder from "./camera-viewfinder";

interface ScanFabProps {
  onImageCaptured: (file: File) => void;
}

export default function ScanFab({ onImageCaptured }: ScanFabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showViewfinder, setShowViewfinder] = useState(false);
  const [useFileInput, setUseFileInput] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageCaptured(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFabClick() {
    if (useFileInput) {
      fileInputRef.current?.click();
      return;
    }
    setShowViewfinder(true);
  }

  const handleCapture = useCallback(
    (file: File) => {
      setShowViewfinder(false);
      onImageCaptured(file);
    },
    [onImageCaptured]
  );

  const handleViewfinderClose = useCallback(() => {
    setShowViewfinder(false);
    // If camera was denied, fall back to file input for future taps
    if (!useFileInput) {
      setUseFileInput(true);
      // Open file picker immediately as fallback
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [useFileInput]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleFabClick}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full text-white flex items-center justify-center transition-all"
        style={{
          background: "linear-gradient(135deg, #c4873a 0%, #a06830 100%)",
          boxShadow: "0 4px 16px rgba(164, 106, 48, 0.4), 0 2px 4px rgba(0,0,0,0.3)",
        }}
        aria-label="Scan beer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
          <path
            fillRule="evenodd"
            d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.2.32.548.524.921.56a18.71 18.71 0 012.882.509A2.25 2.25 0 0123.25 9.07v7.445a2.25 2.25 0 01-1.639 2.165 18.696 18.696 0 01-2.881.509c-.374.036-.722.24-.922.56l-.82 1.318a2.25 2.25 0 01-2.333 1.39 49.494 49.494 0 01-5.311 0 2.25 2.25 0 01-2.333-1.39l-.82-1.318a1.126 1.126 0 00-.922-.56 18.695 18.695 0 01-2.882-.509A2.25 2.25 0 01.75 16.515V9.07a2.25 2.25 0 011.638-2.165c.946-.258 1.907-.46 2.882-.508.374-.037.722-.242.922-.56l.82-1.318a2.25 2.25 0 012.333-1.39zM12 17.25a4.5 4.5 0 100-9 4.5 4.5 0 000 9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {showViewfinder && (
        <CameraViewfinder
          onCapture={handleCapture}
          onClose={handleViewfinderClose}
        />
      )}
    </>
  );
}
