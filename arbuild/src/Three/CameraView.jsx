import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DIGITAL_ZOOM = 5;

export default function CameraView({ autoStart = false, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const containerRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [nativeZoom, setNativeZoom] = useState(false);
  const pinchStart = useRef(null);

  const reportError = useCallback((message) => {
    setError(message);
    onError?.(message);
  }, [onError]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setNativeZoom(false);
    setZoom(1);
    setDigitalZoom(1);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    onError?.("");

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      reportError("Camera access requires HTTPS on phones and most browsers. Open this site with https:// or use localhost on the same computer.");
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      reportError("This browser does not provide camera access. Try the latest Chrome, Edge, Safari, or Firefox.");
      return false;
    }

    try {
      stopCamera();

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Laptop/desktop webcams may not have an environment-facing camera.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      }

      const track = stream.getVideoTracks()[0];
      streamRef.current = stream;
      trackRef.current = track || null;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (track) {
        const capabilities = track.getCapabilities?.() || {};
        const hasZoom = typeof capabilities.zoom === "object";
        setNativeZoom(hasZoom);
        if (hasZoom) {
          const current = track.getSettings?.().zoom;
          if (typeof current === "number") setZoom(current);
        }
      }

      setActive(true);
      return true;
    } catch (err) {
      console.error("Camera start failed:", err);
      const name = err?.name || "";
      let message = "Unable to open the camera. Allow camera permission and try again.";

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        message = "Camera permission was denied. Allow camera access in your browser settings, then try again.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        message = "No camera was found on this device.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        message = "The camera is already being used by another application. Close that application and try again.";
      } else if (name === "SecurityError") {
        message = "The browser blocked camera access. Use HTTPS or localhost and allow camera permission.";
      }

      stopCamera();
      reportError(message);
      return false;
    }
  }, [onError, reportError, stopCamera]);

  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  }, [autoStart, startCamera, stopCamera]);

  const applyZoom = useCallback(async (next) => {
    const clamped = Math.max(1, Math.min(MAX_DIGITAL_ZOOM, next));
    const track = trackRef.current;

    if (nativeZoom && track) {
      const caps = track.getCapabilities?.() || {};
      if (caps.zoom) {
        const min = typeof caps.zoom.min === "number" ? caps.zoom.min : 1;
        const max = typeof caps.zoom.max === "number" ? caps.zoom.max : clamped;
        const value = Math.max(min, Math.min(max, clamped));
        try {
          await track.applyConstraints({ advanced: [{ zoom: value }] });
          setZoom(value);
          return;
        } catch {
          // Fall through to digital zoom.
        }
      }
    }

    setDigitalZoom(clamped);
    setZoom(clamped);
  }, [nativeZoom]);

  const handleWheel = (event) => {
    event.preventDefault();
    applyZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "touch") {
      if (event.isPrimary) {
        containerRef.current?.setPointerCapture?.(event.pointerId);
      }
    }
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      const a = event.touches[0];
      const b = event.touches[1];
      pinchStart.current = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom,
      };
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2 || !pinchStart.current) return;
    event.preventDefault();
    const a = event.touches[0];
    const b = event.touches[1];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = distance / Math.max(1, pinchStart.current.distance);
    applyZoom(pinchStart.current.zoom * ratio);
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length < 2) pinchStart.current = null;
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: "#000",
        touchAction: "none",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${nativeZoom ? 1 : digitalZoom})`,
          transformOrigin: "center center",
        }}
      />

      {!active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            textAlign: "center",
            background: "rgba(0,0,0,0.82)",
          }}
        >
          <div style={{ width: "min(92vw, 440px)" }}>
            <button
              type="button"
              onClick={startCamera}
              aria-label="Start camera"
              style={{
                width: "min(88vw, 240px)",
                minHeight: 50,
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid #059669",
                background: "#10b981",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Start Camera</span>
            </button>
            {error && (
              <p style={{ margin: "14px auto 0", color: "#fff", lineHeight: 1.5, fontSize: 14 }}>
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {active && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 8,
            borderRadius: 14,
            background: "rgba(15,23,42,0.82)",
            backdropFilter: "blur(10px)",
          }}
        >
          <button type="button" onClick={() => applyZoom(zoom - 0.5)} style={controlStyle}>−</button>
          <button type="button" onClick={() => applyZoom(1)} style={controlStyle}>Reset</button>
          <span style={{ minWidth: 48, color: "#fff", textAlign: "center", fontSize: 13 }}>{zoom.toFixed(1)}x</span>
          <button type="button" onClick={() => applyZoom(zoom + 0.5)} style={controlStyle}>+</button>
          <button type="button" onClick={stopCamera} style={controlStyle}>Close Camera</button>
        </div>
      )}
    </div>
  );
}

const controlStyle = {
  minWidth: 42,
  minHeight: 40,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(30,41,59,0.95)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
