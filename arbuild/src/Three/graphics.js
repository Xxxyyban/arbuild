// How much the 3D views ask of the device.
//   full  the detailed models, sharp on a big screen
//   lite  the models' lite copies (public/models/lite, made by tools/lite-models.mjs: small textures,
//         lighter meshes, far fewer draw calls) and a lighter render: for phones, tablets and
//         computers with a weak graphics chip
// "auto" (the default) picks by the device. The sidebar's Graphics setting (components/AppShell.jsx)
// can pick either; it's kept in this browser and takes effect on a reload.
const KEY = "arbuild.graphics";
export const GRAPHICS_CHOICES = ["auto", "full", "lite"];

// the models that have a lite copy (tools/lite-models.mjs MODELS)
const LITE_MODELS = new Set([
  "motherboard", "motherboard1", "case-meshify-c", "case_fan", "cpu", "cpu_cooler", "cpu_cooler1",
  "gpu", "gpu1", "psu", "psu1", "ram", "ram1", "ssd", "ssd1",
]);

export function graphicsChoice() {
  try {
    const v = localStorage.getItem(KEY);
    return GRAPHICS_CHOICES.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Keeps the choice and reloads the page, so every model loads again in that quality. */
export function setGraphicsChoice(choice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private window: auto it stays */
  }
  window.location.reload();
}

/** The graphics chip's name, as the browser gives it ("" if it won't say, "none" without WebGL). */
function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "none";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

// software rendering, phone and tablet chips, and the older or smaller chips built into processors
const WEAK_GPU = /none|swiftshader|llvmpipe|software|basic render|mali|adreno|powervr|videocore|intel\(r\) (hd|uhd) graphics|intel hd|intel uhd|radeon\(tm\) graphics|radeon (r[2-7]|vega \d)|vega \d+ graphics/i;

let weak = null;
/** A phone or tablet, a computer with little memory or few cores, or a weak graphics chip. */
export function weakDevice() {
  if (weak === null) {
    const touchFirst = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const lowMemory = navigator.deviceMemory > 0 && navigator.deviceMemory <= 4;
    const fewCores = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2;
    weak = touchFirst || lowMemory || fewCores || WEAK_GPU.test(gpuName());
  }
  return weak;
}

let lite = null;
/** true: the lite models and render. */
export function isLite() {
  if (lite === null) {
    const choice = graphicsChoice();
    lite = choice === "lite" || (choice === "auto" && weakDevice());
  }
  return lite;
}

/** A model's file for this device: its lite copy when the graphics are lite and it has one. */
export function modelUrl(path) {
  if (typeof path !== "string" || !isLite()) return path;
  const name = path.match(/^\/models\/([^/]+)\.glb$/)?.[1];
  return name && LITE_MODELS.has(name) ? `/models/lite/${name}.glb` : path;
}

/**
 * The render's settings. dpr: the pixel ratio's range (the views lower it while frames come slowly,
 * and raise it again); tube: a cable's segments along it and round it.
 */
export function renderSettings() {
  return isLite() ? { lite: true, dpr: [0.75, 1.5], tube: [40, 6] } : { lite: false, dpr: [1, 2], tube: [72, 8] };
}
