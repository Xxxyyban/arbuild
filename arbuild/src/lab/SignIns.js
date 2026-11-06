// Sign-ins: when, from where and on what each account signs in, for the admin to watch for misuse
// (pages/Admin.jsx, "Sign-ins"). AuthContext records each sign-in right after it succeeds:
//
//   signIns/{id}        one per sign-in. The time is the server's. The place is what the person's
//                       internet connection gives away (city level, from GeoJS, or ipwho.is if that
//                       doesn't answer), so a VPN shows the VPN's place, and nothing if both are
//                       blocked. The device is the browser and system the person signed in with.
//   signInLast/{uid}    each account's latest sign-in, written with it. At most one sign-in a minute
//                       is recorded per account (firestore.rules), so nobody can flood the log.
//
// Only the admin reads them; nobody changes or deletes one.
import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";

const LOOKUP_MS = 4000; // how long to wait for each place look-up
const PAGE = 100; // sign-ins the admin loads at a time

const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// a coordinate to 2 decimals (about a kilometre): a look-up by internet address is no closer than that
const coord = (v, lim) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && Math.abs(n) <= lim ? Math.round(n * 100) / 100 : null;
};
const code2 = (v) => (typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : "");

export const NO_PLACE = { ip: "", city: "", region: "", country: "", countryCode: "", lat: null, lon: null, isp: "", ipTimezone: "" };

/** GeoJS's answer (get.geojs.io/v1/ip/geo.json) as a place. */
export function placeFromGeoJs(d) {
  if (!d || typeof d.ip !== "string") return null;
  return {
    ip: clip(d.ip, 45),
    city: clip(d.city, 80),
    region: clip(d.region, 80),
    country: clip(d.country, 60),
    countryCode: code2(d.country_code),
    lat: coord(d.latitude, 90),
    lon: coord(d.longitude, 180),
    isp: clip(d.organization_name || d.organization, 120),
    ipTimezone: clip(d.timezone, 60),
  };
}

/** ipwho.is's answer as a place. */
export function placeFromIpWho(d) {
  if (!d || d.success === false || typeof d.ip !== "string") return null;
  return {
    ip: clip(d.ip, 45),
    city: clip(d.city, 80),
    region: clip(d.region, 80),
    country: clip(d.country, 60),
    countryCode: code2(d.country_code),
    lat: coord(d.latitude, 90),
    lon: coord(d.longitude, 180),
    isp: clip(d.connection?.isp || d.connection?.org, 120),
    ipTimezone: clip(d.timezone?.id, 60),
  };
}

const LOOKUPS = [
  ["https://get.geojs.io/v1/ip/geo.json", placeFromGeoJs],
  ["https://ipwho.is/", placeFromIpWho],
];

async function getJson(url) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), LOOKUP_MS);
  try {
    const res = await fetch(url, { signal: stop.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
    return res.ok ? await res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Roughly where this browser's internet connection is. NO_PLACE if no look-up answers (offline, or blocked). */
export async function lookUpPlace() {
  for (const [url, read] of LOOKUPS) {
    try {
      const place = read(await getJson(url));
      if (place) return place;
    } catch {
      // blocked or slow: try the next one
    }
  }
  return NO_PLACE;
}

/** "Chrome on Windows", "Safari on iPhone"... from a browser's user agent. touchPoints tells an iPad from a Mac. */
export function describeDevice(ua = "", touchPoints = 0) {
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser\//.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "A browser";
  const system = /iPhone|iPod/.test(ua) ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return system ? `${browser} on ${system}` : browser;
}

/** Records a sign-in that just went through: signIns/{id} and signInLast/{uid}, in one write. */
export async function recordSignIn(user) {
  const place = await lookUpPlace();
  let timezone = "";
  try {
    timezone = clip(Intl.DateTimeFormat().resolvedOptions().timeZone, 60);
  } catch {
    // an old browser: no time zone
  }
  const entry = {
    uid: user.uid,
    email: user.email || "",
    at: serverTimestamp(),
    ...place,
    device: describeDevice(navigator.userAgent, navigator.maxTouchPoints || 0),
    timezone,
  };
  const ref = doc(collection(db, "signIns"));
  const batch = writeBatch(db);
  batch.set(ref, entry);
  batch.set(doc(db, "signInLast", user.uid), { ...entry, id: ref.id });
  await batch.commit();
}

/* ---------- for the admin ---------- */

const fromDoc = (d) => {
  const v = d.data();
  return { ...v, id: d.id, at: v.at?.toDate ? v.at.toDate() : new Date(v.at || 0) };
};

/** The latest sign-ins, newest first, a page at a time: after `before` (the last one's time) for the next. */
export async function loadSignIns({ before = null } = {}) {
  const q = before
    ? query(collection(db, "signIns"), orderBy("at", "desc"), startAfter(before), limit(PAGE))
    : query(collection(db, "signIns"), orderBy("at", "desc"), limit(PAGE));
  const snap = await getDocs(q);
  return { list: snap.docs.map(fromDoc), more: snap.size === PAGE };
}

/** One account's sign-ins, newest first. */
export async function loadSignInsOf(uid) {
  const snap = await getDocs(query(collection(db, "signIns"), where("uid", "==", uid), limit(500)));
  return snap.docs.map(fromDoc).sort((a, b) => b.at - a.at);
}

/** Each account's latest sign-in: { uid: sign-in }. */
export async function loadLastSignIns() {
  const snap = await getDocs(collection(db, "signInLast"));
  return Object.fromEntries(snap.docs.map((d) => [d.id, fromDoc(d)]));
}

/** "Dagupan City, Ilocos, Philippines" (as much of it as is known). */
export function placeName(s) {
  const parts = [s.city, s.region !== s.city ? s.region : "", s.country].filter(Boolean);
  return parts.join(", ");
}

/** "Dagupan City, PH": short, for a table with little room. */
export function shortPlace(s) {
  return s.city ? [s.city, s.countryCode].filter(Boolean).join(", ") : s.country;
}

/** A time zone's offset from UTC at a moment ("GMT+8"), to tell two zones apart that keep the same time. */
function utcOffset(timeZone, at) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part ? part.value : timeZone;
  } catch {
    return timeZone;
  }
}

export const FLAG_TEXT = {
  place: "New place",
  device: "New device",
  abroad: "Other country",
  vpn: "VPN or proxy?",
};

export const FLAG_HELP = {
  place: "This account hasn't signed in from this place before (in this list).",
  device: "This account hasn't signed in with this browser and system before (in this list).",
  abroad: "From a different country than most sign-ins.",
  vpn: "The internet connection's time zone isn't the computer's, which is usual with a VPN or a proxy.",
};

/**
 * What stands out about each sign-in in a list (newest first): { id: ["place", "device", ...] }.
 * A place or a device the account hasn't used before in the list, a country other than the one most
 * sign-ins come from, and a connection whose time zone doesn't keep the computer's time.
 */
export function signInFlags(list) {
  const counts = {};
  for (const s of list) if (s.countryCode) counts[s.countryCode] = (counts[s.countryCode] || 0) + 1;
  const home = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const seen = new Map();
  const flags = {};
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const s = list[i];
    const mine = seen.get(s.uid) || { places: new Set(), devices: new Set(), count: 0 };
    const place = [s.city, s.region, s.countryCode].join("|");
    const f = [];
    if (mine.count > 0 && (s.city || s.countryCode) && !mine.places.has(place)) f.push("place");
    if (mine.count > 0 && s.device && !mine.devices.has(s.device)) f.push("device");
    if (home && s.countryCode && s.countryCode !== home) f.push("abroad");
    if (s.ipTimezone && s.timezone && s.ipTimezone !== s.timezone && utcOffset(s.ipTimezone, s.at) !== utcOffset(s.timezone, s.at)) f.push("vpn");
    mine.places.add(place);
    if (s.device) mine.devices.add(s.device);
    mine.count += 1;
    seen.set(s.uid, mine);
    if (f.length) flags[s.id] = f;
  }
  return flags;
}
