// Session setup (what the instructor controls) and join codes.
import { ALL_PARTS } from "./Constants";
import { correctPicks, normalizePlatform } from "./Catalog";
import { m2Start, socketStart } from "./Rules";
import { wiresStart } from "./Wires";

export const DEFAULT_SETUP = {
  startMode: "disassemble", // "assemble" | "disassemble"
  startState: "full", // "full" PC | "empty" bench | "custom"
  customInstalled: [], // used when startState === "custom"
  platform: "am4", // "am4" | "am5": the work order (students may get their own)
  partPicking: "student", // "student" picks every part from the catalog | "auto" lays the right parts out
  partInfo: true, // false hides the part info panel and the specs on the picker cards
  parMin: 10, // target minutes per phase; slower than this lowers the score
  modeControl: "student", // "student" | "instructor" (instructor decides the mode)
  toggle: "free", // "free" | "afterComplete" | "locked" (used when modeControl is "student")
  autoPrompt: true, // offer the next phase when the current one is done
  hints: true, // false hides hint toasts, "Fix:" lines and AR target markers
  revertPenalty: "light", // "off" | "light" | "strict"
};

/** Fills in any missing field, so older saved sessions keep working. */
export const normalizeSetup = (s = {}) => {
  const out = { ...DEFAULT_SETUP, ...s };
  out.platform = normalizePlatform(out.platform) || DEFAULT_SETUP.platform;
  return out;
};

/** Initial lab state for a setup. */
export function buildStart(setup) {
  const s = normalizeSetup(setup);
  let installed;
  if (s.startState === "full") installed = Object.fromEntries(ALL_PARTS.map((p) => [p, true]));
  else if (s.startState === "custom") installed = Object.fromEntries(s.customInstalled.map((p) => [p, true]));
  else installed = {};

  const full = s.startState === "full";
  // A built PC (or "auto pick") starts with the right parts. Otherwise the bench is empty
  // and the student picks every part.
  const picks = Object.keys(installed).length > 0 || s.partPicking === "auto" ? correctPicks(s.platform) : {};
  return {
    mode: s.startMode,
    installed,
    picks,
    pasteApplied: full, // a PC that was running already has paste
    // slots 1+3 so a "full" PC boots with dual channel and no warning
    ramSlot: { ram1: installed.ram1 ? 0 : null, ram2: installed.ram2 ? 2 : null },
    power: { shutdown: false, unplugged: false, discharged: false },
    // a PC that was running has its cables plugged in and its board screwed down
    cables: { atx24: full, eps8: full, pcie: full && !!picks.gpu },
    // a PSU in the case has its modular cables on it already (only the ones this build uses)
    psuCables: { atx24: !!installed.psu, eps8: !!installed.psu, pcie: !!installed.psu && !!picks.gpu },
    screws: Array.from({ length: 9 }, () => !!installed.motherboard),
    // the board's M.2 cover is on and screwed down; an SSD already in is screwed in under it
    m2: m2Start(installed.storage),
    // the CPU socket's lever is down (and AM5's cover frame shut); its plastic cap is on while it's empty
    socket: socketStart(installed.cpu),
    // a PC that was running has the case's and fans' wires on the board's headers
    wires: wiresStart(full),
  };
}

/**
 * Practice setup from the URL, used by the old-route redirects and for quick tests:
 *   /lab?start=teardown   or   /lab?start=build   (&platform=am5)
 */
export function setupFromUrl(search) {
  const q = new URLSearchParams(search);
  const start = q.get("start");
  const platform = normalizePlatform(q.get("platform")) || DEFAULT_SETUP.platform;
  if (start === "build") return normalizeSetup({ startMode: "assemble", startState: "empty", platform });
  if (start === "teardown") return normalizeSetup({ startMode: "disassemble", startState: "full", platform });
  return normalizeSetup({ platform });
}

/* ---------- join codes ---------- */

// No 0/O or 1/I/L so the code is easy to read out loud.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function generateJoinCode() {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/** Cleans what the student typed: trims, upper-cases, drops spaces and dashes. */
export const normalizeCode = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const isValidCode = (code) =>
  code.length === CODE_LENGTH && [...code].every((c) => CODE_CHARS.includes(c));
