// Rig Studio: a complete PC to explore in 3D and AR. Pick the AM4, AM5 or LGA1700 (Intel) build, take it apart, turn it
// on (fans, RGB lights, airflow) and read what every part, slot, header and pin is for
// (lab/PartGuide.js). AR works on any device with a camera:
//   - "Place it in your room": WebXR, on phones that have it (Android with ARCore, in Chrome)
//   - Marker AR: any phone, tablet or laptop camera, on a printed marker (Three/MarkerAR.jsx)
//   - Motion AR: no marker, the phone's motion sensors turn the view (Three/ar/ARTools.jsx CamAR)
// Any device can run it (Three/graphics.js): phones, tablets and weak computers get the lite models
// and a lighter render, the view draws only once its shaders are compiled (Three/WarmUp.jsx) and
// while it's on screen, and its sharpness follows how fast the frames come.
// Styles: styles/RigStudio.css.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, useProgress, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import ShowcaseRig from "../components/rig/ShowcaseRig";
import GuidePanel from "../components/rig/GuidePanel";
import { CameraFocus } from "../components/lab/BenchScene";
import { GLBridge, ARHitTest, ARRoot, CamAR, useARSupport, startARSession, requestMotion } from "../Three/ar/ARTools";
import { useARGestures, GestureGroup } from "../Three/ar/ARGestures";
import { ARContext } from "../Three/xrSetup";
import WarmUp from "../Three/WarmUp";
import { renderSettings, setGraphicsChoice } from "../Three/graphics";
import { guidePart, partsFor, forPlatform, shortTitle } from "../lab/PartGuide";
import { PLATFORMS, PLATFORM_LABEL } from "../lab/Catalog";

const MarkerAR = lazy(() => import("../Three/MarkerAR"));

const GFX = renderSettings(); // full or lite, for this device

const HOME = { position: [3.4, 2.6, 4.7], target: [0, 1.05, 0] }; // the whole PC, from the front and the glass side
const EXPLODED = { key: "exploded", position: [3.7, 2.6, 5.5], target: [0.25, 0.95, 0.8] }; // room for the parts out front
const VIEW_DIR = new THREE.Vector3(0.55, 0.32, 1).normalize(); // the way the camera looks at a picked part
const CASE_HEIGHT = 2.2; // the case model, in scene units (Three/CaseModel.jsx)
const REAL_SCALE = 0.45 / CASE_HEIGHT; // WebXR and motion AR: real size (a Meshify C is about 45 cm tall)
const MARKER_SCALE = 0.85; // marker AR: the case stands about two marker widths tall
const PLATFORM_KEY = "rigPlatform"; // the build last looked at (this browser)

// a wire's plug picked in 3D: which of the guide's cables it is
const WIRE_ITEM = { pwr_sw: "panel", rst_sw: "panel", pled: "panel", hdd_led: "panel", usb3: "usb3", hd_audio: "audio", cpu_fan: "fans", case_fans: "fans", argb: "argb" };

function readPlatform() {
  try {
    const saved = localStorage.getItem(PLATFORM_KEY);
    return PLATFORMS.includes(saved) ? saved : "am4";
  } catch {
    return "am4";
  }
}

export default function MainPage() {
  const [platform, setPlatformState] = useState(readPlatform);
  const [exploded, setExploded] = useState(false);
  const [powered, setPowered] = useState(true);
  const [labels, setLabels] = useState(false);
  const [sel, setSel] = useState({ part: null, item: null });
  const [full, setFull] = useState(false);
  const [bare, setBare] = useState(false); // the controls hidden: nothing over the 3D view but the button that brings them back
  const [folded, setFolded] = useState(false); // the picked part's sheet folded down to its name
  const [focus, setFocus] = useState(null);

  // drawing: once the build is in and compiled, and while the view is on screen (on a phone the guide
  // is under it). quality: 0 to 1 across the device's pixel ratio range, as fast as frames come.
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [quality, setQuality] = useState(GFX.lite ? 0.5 : 1);
  const [slow, setSlow] = useState(false); // the full graphics are too much here: offer the lite ones
  const [lost, setLost] = useState(false); // the browser dropped the view (out of graphics memory)
  const stageRef = useRef(null);

  // AR. /main?ar=1 opens the AR choices straight away (the link to share with a phone).
  const [arMenu, setArMenu] = useState(() => new URLSearchParams(window.location.search).get("ar") === "1");
  const [inAR, setInAR] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [camMode, setCamMode] = useState(false);
  const [gyro, setGyro] = useState(false);
  const [placeToken, setPlaceToken] = useState(0);
  const [markerOn, setMarkerOn] = useState(false);
  const [markerSvg, setMarkerSvg] = useState(null); // the marker sheet, while it's open
  const [arError, setArError] = useState("");
  const [copied, setCopied] = useState(false);
  const arLite = camMode && gyro; // camera + motion sensors
  const arLike = inAR || arLite;
  const arSupported = useARSupport();
  const hasCamera = !!navigator.mediaDevices?.getUserMedia; // only over HTTPS (or localhost)
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  const glRef = useRef(null);
  const sessionRef = useRef(null);
  const overlayRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rigApi = useRef(null);
  const gestures = useARGestures({ overlayRef, enabled: arLike });
  const loading = useProgress(); // the models coming in

  const setPlatform = (p) => {
    if (p === platform) return;
    setPlatformState(p);
    setReady(false);
    setSel({ part: null, item: null });
    try {
      localStorage.setItem(PLATFORM_KEY, p);
    } catch {
      /* private window: it just isn't remembered */
    }
  };

  // what's picked: a guide part, and maybe one of its slots, headers or cables
  const part = guidePart(sel.part);
  const items = part ? partsFor(part, platform) : [];
  const item = items.find(([k]) => k === sel.item)?.[1] ?? null;
  const markers = items.filter(([, s]) => s.marker).map(([, s]) => ({ id: s.marker, label: shortTitle(forPlatform(s.title, platform)) }));

  const select = (p, i = null) => {
    setSel({ part: p, item: i });
    setFolded(false);
  };
  // a pick in the guide. When the guide is under the view, show what was picked: the view, with the
  // details starting right below it (just the details if the view would fill the screen)
  const pickInGuide = (p, i = null) => {
    select(p, i);
    const stage = stageRef.current;
    if (!p || !stage || !window.matchMedia("(max-width: 1080px)").matches) return;
    const box = stage.getBoundingClientRect();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: (box.height < window.innerHeight * 0.75 ? box.top : box.bottom) - 12, behavior: calm ? "auto" : "smooth" });
  };
  // a click in 3D: a part, or one of its markers (a slot, a header, a cable's plug)
  const onPick = (p, marker = null) => {
    if (!marker) return select(p);
    const g = guidePart(p);
    const hit = g ? partsFor(g, platform).find(([, s]) => s.marker === marker)?.[0] : null;
    select(p, hit || (marker.startsWith("wire:") ? WIRE_ITEM[marker.slice(5)] : null));
  };

  // the camera glides to what's picked (after the parts have moved, when the view comes apart)
  const lastExploded = useRef(exploded);
  useEffect(() => {
    if (arLike || markerOn) return undefined;
    const moved = lastExploded.current !== exploded;
    lastExploded.current = exploded;
    const run = () => {
      const api = rigApi.current;
      let target = null;
      let dist = 1.6;
      let dir = VIEW_DIR;
      if (api && item?.marker) {
        target = api.pointOf(item.marker);
        // some are seen best from their own side (the case's buttons and ports, from above)
        const view = api.viewOf?.(item.marker);
        if (view) ({ dir, dist } = view);
      }
      if (api && !target && part) {
        const box = api.boxOf(part.id);
        if (box) {
          target = box.getCenter(new THREE.Vector3());
          dist = box.getSize(new THREE.Vector3()).length() * 1.15 + 0.5;
        }
      }
      if (!target) return setFocus(exploded ? EXPLODED : null);
      setFocus({ key: `${sel.part}:${sel.item}:${exploded}`, target: target.toArray(), position: target.clone().addScaledVector(dir, dist).toArray() });
    };
    const t = setTimeout(run, moved ? 1300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.part, sel.item, exploded, platform, arLike, markerOn]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !window.IntersectionObserver) return undefined;
    const seen = new window.IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const maxDpr = Math.min(GFX.dpr[1], window.devicePixelRatio || 1);
  const minDpr = Math.min(GFX.dpr[0], maxDpr);

  /* ---------- full screen ---------- */
  // the view covering the page (full screen, marker AR): the bell's pop-ups wait in the bell
  // instead of landing on the view's buttons (styles/Classes.css body.rig-covered)
  const covered = full || markerOn;
  useEffect(() => {
    document.body.classList.toggle("rig-covered", covered);
    return () => document.body.classList.remove("rig-covered");
  }, [covered]);
  useEffect(() => {
    document.body.style.overflow = full ? "hidden" : "";
    if (!full) return undefined;
    const onKey = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [full]);

  /* ---------- AR ---------- */
  const startAR = async () => {
    setArError("");
    try {
      setArMenu(false);
      setFull(true);
      const session = await startARSession(glRef.current, overlayRef.current);
      sessionRef.current = session;
      session.addEventListener("end", () => {
        sessionRef.current = null;
        setInAR(false);
        setPlacement(null);
        gestures.reset();
      });
      setPlacement(null);
      gestures.reset();
      setInAR(true);
    } catch (err) {
      console.error(err);
      setArMenu(true);
      setArError("Couldn't start AR here. It needs Chrome on an Android phone with ARCore; try Marker AR instead.");
    }
  };
  const endAR = () => sessionRef.current?.end();

  const startCamAR = async () => {
    setArError("");
    const motionP = requestMotion(); // must be asked for first, straight from the tap
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setGyro(await motionP);
      setPlacement(null);
      gestures.reset();
      setArMenu(false);
      setFull(true);
      setCamMode(true);
      setPlaceToken((t) => t + 1);
    } catch (err) {
      console.error(err);
      setArError("The camera didn't open. Allow camera access for this site, and open it over HTTPS.");
    }
  };
  const stopCamAR = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamMode(false);
    setGyro(false);
    setPlacement(null);
  };
  // the camera stream goes into the <video> once it's there; it stops when the page goes
  useEffect(() => {
    if (camMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camMode]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  // the normal 3D camera, back from motion AR
  const resetCamera = (cam) => {
    cam.position.set(...HOME.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(...HOME.target);
  };

  const startMarker = () => {
    setArError("");
    setArMenu(false);
    setMarkerOn(true);
  };
  const showMarker = async () => {
    const { markerSVG } = await import("../Three/MarkerAR");
    setMarkerSvg(markerSVG(0));
  };

  const shareLink = `${window.location.origin}/main?ar=1`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link stays on screen to copy by hand */
    }
  };

  // taps on our buttons in WebXR must not also count as a tap in the scene
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return undefined;
    const block = (e) => {
      if (e.target !== el) e.preventDefault();
    };
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, []);

  let hint = null;
  if (inAR && !placement) hint = "Move your phone slowly over the floor or a table, then tap the ring to place the PC.";
  else if (arLite) hint = "Turn your phone to look around the PC. Tap a part to read about it.";
  else if (camMode) hint = "No motion sensor here: drag to turn the PC over the camera view.";

  const rig = (
    <ShowcaseRig
      key={platform}
      platform={platform}
      exploded={exploded}
      powered={powered}
      labels={labels}
      selected={sel.part}
      markers={markers}
      activeMarker={item?.marker ?? null}
      onPick={(p, m) => {
        if (gestures.consumeSuppress()) return;
        onPick(p, m);
      }}
      onPower={() => {
        if (gestures.consumeSuppress()) return;
        setPowered((v) => !v); // the case's own power button, the same as the Power button here
      }}
      apiRef={rigApi}
    />
  );

  // the view's buttons; in marker AR only the ones for the PC itself (its own Exit AR closes it)
  const tools = (marker = false) => (
    <div className="rig-tools" role="toolbar" aria-label="View">
      <button type="button" className={exploded ? "is-on" : ""} aria-pressed={exploded} onClick={() => setExploded((v) => !v)}>
        <Icon name="layers" size={17} />
        <span>{exploded ? "Put it together" : "Exploded view"}</span>
      </button>
      <button type="button" className={powered ? "is-on" : ""} aria-pressed={powered} onClick={() => setPowered((v) => !v)}>
        <Icon name="power" size={17} />
        <span>{powered ? "Power on" : "Power off"}</span>
      </button>
      <button type="button" className={labels ? "is-on" : ""} aria-pressed={labels} onClick={() => setLabels((v) => !v)}>
        <Icon name="tag" size={17} />
        <span>Labels</span>
      </button>
      {!marker && !inAR && !camMode && (
        <button type="button" className="is-accent" onClick={() => setArMenu(true)}>
          <Icon name="cube" size={17} />
          <span>AR</span>
        </button>
      )}
      {inAR && placement && (
        <button type="button" onClick={() => setPlacement(null)}>
          <Icon name="pin" size={17} />
          <span>Move</span>
        </button>
      )}
      {arLite && (
        <button type="button" onClick={() => setPlaceToken((t) => t + 1)}>
          <Icon name="pin" size={17} />
          <span>Move</span>
        </button>
      )}
      {inAR && (
        <button type="button" className="is-danger" onClick={endAR}>
          <Icon name="x" size={17} />
          <span>Exit AR</span>
        </button>
      )}
      {camMode && (
        <button type="button" className="is-danger" onClick={stopCamAR}>
          <Icon name="x" size={17} />
          <span>Exit AR</span>
        </button>
      )}
      {!marker && !inAR && !camMode && (
        <button type="button" aria-pressed={full} onClick={() => setFull((v) => !v)}>
          <Icon name={full ? "shrink" : "expand"} size={17} />
          <span>{full ? "Exit full screen" : "Full screen"}</span>
        </button>
      )}
    </div>
  );

  const platformSwitch = (
    <div className="rig-seg" role="radiogroup" aria-label="Build">
      {PLATFORMS.map((p) => (
        <button key={p} type="button" role="radio" aria-checked={platform === p} className={platform === p ? "is-on" : ""} onClick={() => setPlatform(p)}>
          {PLATFORM_LABEL[p]}
        </button>
      ))}
    </div>
  );

  // the picked part's details over the 3D view, when the side guide can't be seen; it folds down to
  // the part's name to leave the view clear
  const sheet = (full || arLike || markerOn) && sel.part && (
    <div className={`rig-sheet ${folded ? "is-folded" : ""}`}>
      <GuidePanel
        platform={platform}
        part={sel.part}
        item={sel.item}
        onSelect={select}
        compact
        folded={folded}
        onFold={() => setFolded((v) => !v)}
        onClose={() => select(null)}
      />
    </div>
  );

  // hides every control over the view (to see all of it), and brings them back
  const bareToggle = (
    <button
      type="button"
      className={`rig__bare ${bare ? "is-on" : ""}`}
      aria-pressed={bare}
      aria-label={bare ? "Show the controls" : "Hide the controls"}
      title={bare ? "Show the controls" : "Hide the controls"}
      onClick={() => setBare((v) => !v)}
    >
      <Icon name={bare ? "eye" : "eyeOff"} size={18} />
    </button>
  );

  return (
    <AppShell
      eyebrow="Rig Studio"
      title="Workstation Explorer"
      subtitle="Take a complete PC apart, power it on, and see what every part, port and pin is for."
    >
      <section className={`rig ${full ? "is-full" : ""}`}>
        <div className={`rig__stage ${camMode ? "is-cam" : ""}`} ref={stageRef}>
          {camMode && <video ref={videoRef} className="rig__cam" playsInline muted autoPlay />}
          <Canvas
            className="rig__canvas"
            frameloop={arLike || (ready && onScreen && !markerOn) ? "always" : "never"}
            dpr={minDpr + (maxDpr - minDpr) * quality}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            camera={{ position: HOME.position, fov: 42, near: 0.05, far: 100 }}
            onCreated={({ gl }) => {
              gl.setClearAlpha(0);
              gl.domElement.addEventListener("webglcontextlost", () => setLost(true));
            }}
          >
            <GLBridge glRef={glRef} />
            {/* sharper while frames come fast, softer while they don't (a step every 2.5 s); the full
                graphics, too slow even at their softest, offer the lite ones */}
            <PerformanceMonitor
              factor={GFX.lite ? 0.5 : 1}
              onChange={({ factor }) => {
                setQuality(factor);
                if (factor === 0 && !GFX.lite) setSlow(true);
              }}
            />
            {/* lite: one light fewer to work out per pixel, the room's light making up for it */}
            <ambientLight intensity={GFX.lite ? 1.9 : 1.6} />
            <hemisphereLight skyColor="#ffffff" groundColor="#666666" intensity={GFX.lite ? 1.4 : 1.1} />
            <directionalLight position={[6, 8, 6]} intensity={2.2} />
            {!GFX.lite && <directionalLight position={[-6, 4, -4]} intensity={1.4} />}
            <directionalLight position={[0, 3, 8]} intensity={1.4} />
            <Environment resolution={256}>
              <Lightformer form="rect" intensity={4} position={[0, 5, 5]} scale={[10, 6, 1]} />
              <Lightformer form="rect" intensity={3} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 5, 1]} />
              <Lightformer form="rect" intensity={3} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 5, 1]} />
            </Environment>
            <ARContext.Provider value={arLike}>
              <Suspense fallback={null}>
                <ARRoot
                  inAR={arLike}
                  placement={placement}
                  focused={false}
                  scaleBase={REAL_SCALE}
                  caseHeight={CASE_HEIGHT}
                  focusScale={1}
                  rigCenterY={CASE_HEIGHT / 2}
                  rigApi={rigApi}
                >
                  <GestureGroup api={gestures} pivotY={0} active={arLike}>
                    {!markerOn && rig}
                  </GestureGroup>
                </ARRoot>
                {!ready && <WarmUp key={platform} onReady={() => setReady(true)} />}
              </Suspense>
            </ARContext.Provider>
            <ARHitTest active={inAR} placed={!!placement} onPlace={setPlacement} onRay={(o, d) => rigApi.current?.tap(o, d)} />
            <CamAR active={arLite} placeToken={placeToken} onPlace={setPlacement} restore={resetCamera} />
            {!arLike && <CameraFocus focus={focus} home={HOME} />}
            {!arLite && (
              <OrbitControls makeDefault enabled={!inAR} target={HOME.target} enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={16} />
            )}
          </Canvas>

          {/* everything here also shows in WebXR (it's the dom-overlay root) */}
          <div className="rig__overlay" ref={overlayRef}>
            {!bare && (
              <div className="rig__top">
                {platformSwitch}
                {hint && <p className="rig__hint">{hint}</p>}
              </div>
            )}
            {bareToggle}
            {(loading.active || !ready) && !markerOn && (
              <p className="rig__loading" role="status">
                {loading.active ? `Loading the ${PLATFORM_LABEL[platform]} PC… ${Math.round(loading.progress)}%` : "Getting the 3D view ready…"}
              </p>
            )}
            {/* along the bottom, stacked so none covers another: a note, the picked part, the buttons */}
            {lost ? (
              <div className="rig__dock">
                <div className="rig-note is-error" role="alert">
                  <span>The 3D view stopped: this device ran out of graphics memory.</span>
                  <button type="button" onClick={() => (GFX.lite ? window.location.reload() : setGraphicsChoice("lite"))}>
                    {GFX.lite ? "Reload" : "Reload with lite graphics"}
                  </button>
                </div>
              </div>
            ) : (
              !bare && (
                <div className="rig__dock">
                  {slow && (
                    <div className="rig-note" role="status">
                      <span>The 3D view is running slowly on this device.</span>
                      <button type="button" onClick={() => setGraphicsChoice("lite")}>
                        Use lite graphics
                      </button>
                      <button type="button" className="rig-note__close" aria-label="Dismiss" onClick={() => setSlow(false)}>
                        <Icon name="x" size={15} />
                      </button>
                    </div>
                  )}
                  {sheet}
                  {tools()}
                </div>
              )
            )}

            {arMenu && (
              <div className="rig-ar" role="dialog" aria-label="See it in AR">
                <div className="rig-ar__head">
                  <strong>See it in AR</strong>
                  <button type="button" className="rig-ar__close" aria-label="Close" onClick={() => setArMenu(false)}>
                    <Icon name="x" size={18} />
                  </button>
                </div>
                {arSupported && (
                  <button type="button" className="rig-ar__opt is-best" onClick={startAR}>
                    <Icon name="cube" size={22} />
                    <span>
                      <b>Place it in your room</b>
                      <small>It stands on your floor or desk at real size; walk around it. Phones with ARCore, in Chrome.</small>
                    </span>
                  </button>
                )}
                {hasCamera ? (
                  <>
                    <button type="button" className={`rig-ar__opt ${arSupported ? "" : "is-best"}`} onClick={startMarker}>
                      <Icon name="camera" size={22} />
                      <span>
                        <b>Marker AR</b>
                        <small>Any phone, tablet or laptop camera: point it at the marker and the PC stands on it, wherever you move.</small>
                      </span>
                    </button>
                    <button type="button" className="rig-ar__link" onClick={showMarker}>
                      <Icon name="printer" size={16} />
                      Get the marker (print it, or show it on another screen)
                    </button>
                    {touch && (
                      <button type="button" className="rig-ar__opt" onClick={startCamAR}>
                        <Icon name="refresh" size={22} />
                        <span>
                          <b>Motion AR</b>
                          <small>No marker: the PC floats in front of you. Turn your phone to look around it.</small>
                        </span>
                      </button>
                    )}
                  </>
                ) : (
                  <p className="rig-ar__note">The camera only opens over a secure (HTTPS) connection.</p>
                )}
                {!touch && (
                  <div className="rig-ar__phone">
                    <span>
                      <b>On a phone or tablet?</b> Open this link there to place the PC in your room:
                    </span>
                    <div className="rig-ar__share">
                      <code>{shareLink}</code>
                      <button type="button" onClick={copyLink}>
                        <Icon name={copied ? "check" : "copy"} size={15} />
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
                {arError && (
                  <p className="rig-ar__error" role="alert">
                    {arError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="rig__guide" aria-label="Parts guide">
          <GuidePanel platform={platform} part={sel.part} item={sel.item} onSelect={pickInGuide} />
        </aside>
      </section>

      {markerOn && (
        <Suspense fallback={<div className="rig-wait">Starting the camera…</div>}>
          <MarkerAR
            scale={MARKER_SCALE}
            onExit={() => setMarkerOn(false)}
            overlay={
              <div className="rig-marker-ui">
                {bareToggle}
                {!bare && (
                  <div className="rig__dock">
                    {sheet}
                    {tools(true)}
                  </div>
                )}
              </div>
            }
          >
            {rig}
          </MarkerAR>
        </Suspense>
      )}

      {markerSvg && (
        <div className="rig-marker" role="dialog" aria-label="The AR marker">
          <div className="rig-marker__sheet">
            <div className="rig-marker__img" dangerouslySetInnerHTML={{ __html: markerSvg }} />
            <p>Print this at 10 to 15 cm across, or show it on another screen. Keep it flat and well lit.</p>
            <div className="rig-marker__actions">
              <button type="button" className="btn btn--primary" onClick={() => window.print()}>
                <Icon name="printer" size={16} />
                Print
              </button>
              <button type="button" className="btn" onClick={() => setMarkerSvg(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
