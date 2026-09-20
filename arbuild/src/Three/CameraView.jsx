import React, { useEffect, useRef, useState } from 'react';

export default function CameraView() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;

    async function enableCamera() {
      try {
        // Request user camera permission for the AR workspace background
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicitly call play to satisfy strict browser autoplay policies
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn("Autoplay was prevented:", playErr);
          }
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("Camera access denied or unavailable. Running in 3D-only mode.");
      }
    }

    enableCamera();

    // Cleanup: stop camera tracks when unmounting the component
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'hidden', background: '#000' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // Mirror view for natural interaction
        }}
      />
      {error && (
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}