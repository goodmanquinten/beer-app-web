"use client";

import { useEffect, useRef, useState } from "react";

interface CameraViewfinderProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraViewfinder({
  onCapture,
  onClose,
}: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Camera access failed:", err);
          setError("Camera access denied");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        stopStream();
        onCapture(file);
      },
      "image/jpeg",
      0.8
    );
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  if (error) {
    // Permission denied — caller should fall back to file input
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
        aria-label="Close camera"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path d="M6.225 4.811a1 1 0 00-1.414 1.414L10.586 12 4.81 17.775a1 1 0 101.414 1.414L12 13.414l5.775 5.775a1 1 0 001.414-1.414L13.414 12l5.775-5.775a1 1 0 00-1.414-1.414L12 10.586 6.225 4.811z" />
        </svg>
      </button>

      {/* Video feed */}
      <video
        ref={videoRef}
        className="flex-1 object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Capture button */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 flex justify-center">
        <button
          onClick={handleCapture}
          disabled={!ready}
          className="w-18 h-18 rounded-full border-4 border-white bg-white/20 active:bg-white/40 transition-colors disabled:opacity-40"
          style={{ width: 72, height: 72 }}
          aria-label="Take photo"
        >
          <div className="w-full h-full rounded-full bg-white scale-[0.85]" />
        </button>
      </div>
    </div>
  );
}
