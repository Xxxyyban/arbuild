// Thermal paste: what the student squeezes onto the CPU's lid, how it spreads when the cooler presses
// it flat, and how good that is. Pure numbers (no three.js, no React), in millimetres from the middle
// of the CPU package: x across the package, y along it (the CPU model's own X and Z).
//
// The paste is a list of dabs { x, y, v }, v in mm³: a dot is one dab, a line is a row of small ones.

// Each CPU's lid, measured from its model (index: the CPU's variant, as in Three/PartModel.jsx).
// top: how far the lid's top face stands above the CPU's underside. rects: [x0, y0, x1, y1], what's flat.
const notchedLid = () => {
  const [a, b, c, d] = [16.8, 14.3, 11.8, 2.1];
  const tabs = (y0, y1) => [[-a, y0, -c, y1], [-d, y0, d, y1], [c, y0, a, y1]];
  return [
    [-b, -b, b, b], // the square middle
    [-a, -b, a, -c], [-a, -d, a, d], [-a, c, a, b], // its arms out to the sides
    ...tabs(-a, -b), ...tabs(b, a), // the tabs between the notches
  ];
};

function lid(name, top, rects) {
  const inside = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  // the rects can overlap, so the area is counted in 0.25 mm cells
  let cells = 0;
  for (let x = -24.875; x < 25; x += 0.25) {
    for (let y = -24.875; y < 25; y += 0.25) if (rects.some((r) => inside(x, y, r))) cells += 1;
  }
  const xs = rects.flatMap((r) => [r[0], r[2]]);
  const ys = rects.flatMap((r) => [r[1], r[3]]);
  return {
    name, top, rects,
    area: cells / 16,
    middle: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
  };
}

export const LIDS = [
  lid("AM4", 4.53, [[-17.28, -18.83, 17.92, 19.19]]), // a plain square
  lid("AM5", 5.73, notchedLid()), // the "octopus" lid, with notches around its edges
];

export const lidFor = (variant) => LIDS[variant] ?? LIDS[0];

export const onLid = (l, x, y) => l.rects.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);

/* ---------- squeezing it out of the tube ---------- */

export const FLOW = 45; // mm³ a second while the tube is pressed
export const TUBE = 600; // mm³ in the tube
const STEP = 0.8; // mm between the dabs of a line
const MAX_DABS = 500;
const ASPECT = 0.62; // a dab's height over its radius: paste holds its shape, it doesn't run

/** The radius of a dab's footprint: half an ellipsoid, V = 2/3 π R² H with H = ASPECT × R. */
export const dabRadius = (v) => Math.cbrt((3 * v) / (2 * Math.PI * ASPECT));
export const dabHeight = (r) => ASPECT * r;

export const pasteVolume = (dabs) => dabs.reduce((sum, d) => sum + d.v, 0);

const near = (d, x, y, r) => Math.hypot(d.x - x, d.y - y) <= r;

/** How high the paste stands at (x, y). Dabs blend: the sum of their heights to the 4th power. */
export function pasteHeightAt(dabs, x, y) {
  let sum = 0;
  for (const d of dabs) {
    const R = dabRadius(d.v);
    const k = 1 - ((d.x - x) ** 2 + (d.y - y) ** 2) / (R * R);
    if (k > 0) sum += (dabHeight(R) ** 4) * k * k;
  }
  return Math.sqrt(Math.sqrt(sum));
}

/**
 * dv more paste comes out with the tube's tip at (x, y). tip is { i }, the dab being fed (null: none
 * yet, a fresh press). Holding still grows that dab; moving away starts new ones along the way the tip
 * went, sharing the paste out, so a quick stroke leaves a thin line and a slow one a thick line. Off
 * the lid nothing lands.
 */
export function flow(dabs, tip, x, y, dv, l) {
  const left = TUBE - pasteVolume(dabs);
  if (left <= 0) return false;
  const amount = Math.min(dv, left);
  const cur = tip.i == null ? null : dabs[tip.i];
  if (cur && near(cur, x, y, Math.max(STEP, 0.6 * dabRadius(cur.v)))) {
    cur.v += amount;
    return true;
  }
  if (!cur) {
    if (!onLid(l, x, y)) return false;
    // pressing on a dab that's already there feeds that one
    const on = dabs.findIndex((d) => near(d, x, y, 0.5 * dabRadius(d.v)));
    if (on >= 0) {
      tip.i = on;
      dabs[on].v += amount;
      return true;
    }
    if (dabs.length >= MAX_DABS) return false;
    dabs.push({ x, y, v: amount });
    tip.i = dabs.length - 1;
    return true;
  }
  const steps = Math.max(1, Math.floor(Math.hypot(x - cur.x, y - cur.y) / STEP));
  const spots = [];
  for (let k = 1; k <= steps; k += 1) {
    const sx = cur.x + ((x - cur.x) * k) / steps;
    const sy = cur.y + ((y - cur.y) * k) / steps;
    if (onLid(l, sx, sy)) spots.push([sx, sy]);
  }
  if (!spots.length || dabs.length + spots.length > MAX_DABS) {
    tip.i = null; // went off the lid: the next spot on it starts a new line
    return false;
  }
  for (const [sx, sy] of spots) dabs.push({ x: sx, y: sy, v: amount / spots.length });
  // the tip came back on after crossing a notch: carries on from the last spot it reached
  tip.i = dabs.length - 1;
  return true;
}

/* ---------- pressed flat under the cooler ---------- */

const FILM = 0.1; // mm: how thin the cooler's pressure squeezes paste
const GRID = 46; // cells of 1 mm, the CPU's middle at the grid's middle
const HOT = 12; // the middle ±12 mm of the lid is over the chips, and has to be covered

/**
 * Where the paste ends up: viscous paste pressed between two plates spreads as Hele-Shaw flow, which is
 * what a "divisible sandpile" works out (each cell holds one film's worth, passes the rest to its
 * neighbours, the 9-point weights keep the blobs round). What reaches the lid's edge is squeezed out.
 *
 * film: mm³ in each cell, ooze: what left the lid over each outside cell. covered, hot: the shares
 * of the lid, and of the part over the chips, with paste on them. spilled: mm³ squeezed out.
 */
export function squeeze(dabs, l) {
  const n = GRID;
  const half = n / 2;
  const at = (i, j) => j * n + i;
  const onCell = new Uint8Array(n * n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) onCell[at(i, j)] = onLid(l, i - half + 0.5, j - half + 0.5) ? 1 : 0;
  }
  let film = new Float32Array(n * n);
  let next = new Float32Array(n * n);
  const ooze = new Float32Array(n * n);

  const put = (i, j, v) => {
    if (i < 0 || j < 0 || i >= n || j >= n) return;
    if (onCell[at(i, j)]) film[at(i, j)] += v;
    else ooze[at(i, j)] += v;
  };
  let volume = 0;
  for (const d of dabs) {
    volume += d.v;
    const fx = d.x + half - 0.5;
    const fy = d.y + half - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const ax = fx - i;
    const ay = fy - j;
    put(i, j, d.v * (1 - ax) * (1 - ay));
    put(i + 1, j, d.v * ax * (1 - ay));
    put(i, j + 1, d.v * (1 - ax) * ay);
    put(i + 1, j + 1, d.v * ax * ay);
  }

  const STEPS = [1, -1, n, -n, n + 1, n - 1, 1 - n, -1 - n]; // to each neighbour: the sides, then the corners
  for (let sweep = 0; sweep < 6000; sweep += 1) {
    let most = 0;
    next.set(film);
    for (let j = 1; j < n - 1; j += 1) {
      for (let i = 1; i < n - 1; i += 1) {
        const c = at(i, j);
        if (!onCell[c] || film[c] <= FILM) continue;
        const extra = film[c] - FILM;
        if (extra > most) most = extra;
        next[c] -= extra;
        for (let k = 0; k < 8; k += 1) {
          const o = c + STEPS[k];
          const share = extra * (k < 4 ? 0.2 : 0.05);
          if (onCell[o]) next[o] += share;
          else ooze[o] += share;
        }
      }
    }
    [film, next] = [next, film];
    if (most < FILM * 0.01) break;
  }

  let lidCells = 0;
  let lidCovered = 0;
  let hotCells = 0;
  let hotCovered = 0;
  let spilled = 0;
  const [mx, my] = l.middle;
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const c = at(i, j);
      spilled += ooze[c];
      if (!onCell[c]) continue;
      const wet = film[c] >= FILM * 0.5;
      lidCells += 1;
      if (wet) lidCovered += 1;
      if (Math.abs(i - half + 0.5 - mx) <= HOT && Math.abs(j - half + 0.5 - my) <= HOT) {
        hotCells += 1;
        if (wet) hotCovered += 1;
      }
    }
  }
  return {
    size: n, cap: FILM, film, ooze, onCell, volume, spilled,
    covered: lidCells ? lidCovered / lidCells : 0,
    hot: hotCells ? hotCovered / hotCells : 0,
  };
}

/* ---------- how good it is ---------- */

/** What's the right amount for a lid: fills it, once pressed to a film. */
export const idealVolume = (l) => l.area * FILM;
// as shares of that: the range that gets full marks for its amount
export const AMOUNT_RIGHT = [0.62, 1.2];
const TOO_LITTLE = 0.15; // nothing for this little
const THIN = 0.5; // less of the area over the chips covered than this: the CPU overheats

const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

function amountMark(share) {
  const [lo, hi] = AMOUNT_RIGHT;
  if (share < lo) return lerp(0, 1, (share - TOO_LITTLE) / (lo - TOO_LITTLE));
  if (share <= hi) return 1;
  if (share <= 2.4) return lerp(1, 0.35, (share - hi) / (2.4 - hi));
  return lerp(0.35, 0.05, (share - 2.4) / 2.6);
}

function amountWord(share) {
  if (share < 0.4) return "too little";
  if (share < AMOUNT_RIGHT[0]) return "a bit too little";
  if (share <= AMOUNT_RIGHT[1]) return "about right";
  if (share <= 1.8) return "a bit too much";
  return "too much";
}

const gradeWord = (q) => (q >= 0.9 ? "Excellent" : q >= 0.7 ? "Good" : q >= 0.4 ? "Not quite" : "Poor");

/**
 * The paste's marks. amount: is it the right amount (0-1). coverage: does it reach all of the area over
 * the chips once pressed (0-1). tidy: how little got squeezed out over the edge. quality: all three
 * multiplied, what the points follow. thin: so little coverage that the CPU overheats.
 */
export function gradePaste(dabs, l) {
  const s = squeeze(dabs, l);
  const share = s.volume / idealVolume(l);
  const amount = amountMark(share);
  const coverage = Math.min(1, s.hot / 0.95);
  const spillShare = s.volume > 0 ? Math.min(1, s.spilled / s.volume) : 0;
  const tidy = 1 - 0.5 * spillShare;
  const quality = amount * coverage * tidy;
  const word = amountWord(share);
  const fault =
    quality >= 0.7 ? null
    : share < AMOUNT_RIGHT[0] ? "Too little thermal paste"
    : share > AMOUNT_RIGHT[1] ? "Too much thermal paste"
    : "Thermal paste not over the middle of the CPU";
  const advice =
    quality >= 0.9 ? `A thin, even layer over the chips, with ${spillShare < 0.05 ? "nothing" : "a little"} squeezed out.`
    : share < AMOUNT_RIGHT[0] ? "Not enough to reach across the chips once the cooler presses it flat. Use more."
    : share > AMOUNT_RIGHT[1] ? "More than the cooler can hold in. The extra gets squeezed out over the sides, and a thick layer carries heat worse."
    : coverage < 0.9 ? "The right amount, but it doesn't reach all the way across the chips. Aim for the middle of the lid."
    : "Close. Part of it got squeezed out over the edge, so start nearer the middle.";
  return {
    volume: s.volume, share, spread: s, word, advice, fault,
    amount, coverage, spillShare, tidy, quality,
    hot: s.hot, covered: s.covered,
    score: Math.round(quality * 100),
    grade: gradeWord(quality),
    thin: s.hot < THIN,
  };
}

/** The paste a PC that was already running has under its cooler: one good pea in the middle. */
export function goodPaste(l) {
  return [{ x: l.middle[0], y: l.middle[1], v: idealVolume(l) * 0.85 }];
}
