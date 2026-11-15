// The LGA1700 board (ASUS ROG STRIX Z790-E GAMING WIFI II), built in code: there is no file for it.
// Plain three.js, like the cable plugs (cableStubs.js) and the M.2 cover (m2Cover.js).
//
// Everything is laid out in millimetres on the board as you see it from the glass side: x from its
// left edge (the rear I/O side) to the right, y up from its bottom edge, z out of its front face
// (0 = the PCB's front). Positions below are given as (x, t): t is millimetres down from the TOP
// edge, the way a board is usually read. LAYOUT is the one table both the model and the lab's mounts
// (MotherboardModel2.jsx MOUNTS) are made from, so parts, plugs and labels can't drift apart.
//
// What is true to the real board: an ATX board (305 x 244 mm) with its 9 screw holes in the ATX
// places, an LGA1700 socket, 4 DDR5 slots, three x16-length PCIe slots (the first one steel-clad),
// 5 M.2 slots (M.2_1 between the socket and the first slot), 4 SATA ports, two 8-pin CPU power
// headers, and the headers and rear ports its specification lists. Where each one sits is close to
// the real board's, not measured from it.
//
// How it looks comes from pictures drawn here too (no photo is used): the PCB's traces, pads and
// print, the brushed heatsinks, the I/O cover's display. The small soldered parts are placed by a
// fixed "random" sequence, so every copy of the board is the same board.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const BOARD = { w: 244, h: 305, thick: 1.6 };
const T = (t) => BOARD.h - t; // down from the top edge -> up from the bottom edge

export const LAYOUT = {
  // the 9 ATX screw holes: [x, t]
  holes: [
    [26.67, 10.16], [161.29, 10.16], [233.68, 10.16],
    [6.35, 165.1], [161.29, 165.1], [233.68, 165.1],
    [6.35, 289.56], [161.29, 289.56], [233.68, 289.56],
  ],
  socket: { x: 122, t: 92, seat: 3.6 }, // its centre; seat: how far off the PCB the CPU's underside sits
  dimm: { x: [178.5, 188, 197.5, 207], t: 91, length: 142, floor: 3.1 }, // slot 1 nearest the socket
  m2: { x: 150, t: 165, z: 3.1 }, // M.2_1's connector (the drive's pins); the drive runs to the left
  pcie: [{ t: 187.53, steel: true }, { t: 248.49 }, { t: 289.13 }], // x16 slots, 20.32 mm a slot apart; the first is where the case holds the card
  atx24: { x: 236.5, t: 112 }, // 52 mm long, standing along the right edge
  eps8: [{ x: 60, t: 8.5 }, { x: 82, t: 8.5 }], // the lab's CPU cable goes in the first
  // the small headers (lab/Wires.js ids). label: as printed beside it. along "y": it runs up the board
  headers: {
    cpu_fan: { x: 170, t: 7, label: "CPU_FAN" },
    cpu_opt: { x: 182, t: 7, label: "CPU_OPT" },
    u32g1: { x: 237.5, t: 189, label: "U32G1_E12", along: "y" },
    aafp: { x: 30, t: 299.5, label: "AAFP" },
    add_gen2: { x: 52, t: 299.5, label: "ADD_GEN2_2" },
    rgb: { x: 78, t: 299.5, label: "RGB_HEADER" },
    usb2: { x: 112, t: 299.5, label: "USB_E12" },
    cha_fan: { x: 172, t: 299.5, label: "CHA_FAN3" },
    // the system panel (F_PANEL): 2 rows of pins, PLED and PWR on the upper row, HDD and RST under them
    pled: { x: 201.87, t: 298.23 },
    pwr: { x: 206.95, t: 298.23 },
    hdd: { x: 201.87, t: 300.77 },
    rst: { x: 206.95, t: 300.77 },
  },
};

// The outlines of the big covers and heatsinks, as [x, t]. Their shapes follow the real board: an
// I/O cover that runs over the left VRM heatsink and carries a display, and armour over the lower
// half with slanted seams and the raised ROG letters.
const SHAPES = {
  cover: [[1, 166], [1, 0.5], [46, 0.5], [46, 12], [51, 17], [62, 17], [62, 130], [32, 166]],
  display: [[4, 7], [34, 7], [58, 31], [58, 100], [4, 72]],
  vrmLeft: [[44, 150], [44, 18], [76, 18], [76, 128], [54, 150]],
  vrmTop: [[92, 33], [92, 11], [98, 5], [158, 5], [164, 11], [164, 27], [158, 33]],
  plateA: [[44, 239.5], [44, 194.5], [167.5, 194.5], [152, 239.5]], // over M.2_2 and M.2_3
  rog: [[154, 239.5], [170, 193], [228, 193], [228, 239.5]], // the chipset block
  chipLow: [[153.5, 252.5], [157.5, 241], [228, 241], [228, 252.5]],
  plateB: [[44, 276.5], [44, 253.5], [228, 253.5], [228, 270], [221.5, 276.5]], // over M.2_4 and M.2_5
};
const SLOPE = Math.atan2(28, 54); // the display's lower edge: the print under it leans the same way

const bounds = (pts) => {
  const xs = pts.map((p) => p[0]), ts = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ts), Math.max(...ts)];
};
/** An outline pulled in by d on every side of its box (a printed face stops short of the bevel). */
const inset = (pts, d) => {
  const [x0, x1, t0, t1] = bounds(pts);
  const cx = (x0 + x1) / 2, ct = (t0 + t1) / 2;
  return pts.map(([x, t]) => [cx + (x - cx) * (1 - (2 * d) / (x1 - x0)), ct + (t - ct) * (1 - (2 * d) / (t1 - t0))]);
};
/** The same "random" numbers every time. */
function seeded(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- materials (one of each, shared by every mesh of that kind) ---------- */
const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const makeMaterials = (brushed, lite) => ({
  pcb: std("#0b0c0e", 0.1, 0.8),
  black: std("#111215", 0.05, 0.55), // connector plastic
  dark: std("#1b1d21", 0.1, 0.5),
  gray: std("#6a707a", 0.1, 0.55),
  white: std("#e6e8ec", 0.05, 0.5),
  sink: std("#22252a", 0.8, 0.48, { map: brushed }), // the heatsinks: dark anodised aluminium
  shroud: std("#16181b", 0.5, 0.5, { map: brushed }), // the I/O cover
  // the display's glass: a clear coat over black (plain on a weak device)
  gloss: lite ? std("#060607", 0.2, 0.15) : new THREE.MeshPhysicalMaterial({ color: "#050506", metalness: 0, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 0.4 }),
  steel: std("#d3d7dd", 0.95, 0.24, { map: brushed }),
  steelDark: std("#8d939c", 0.9, 0.32),
  gold: std("#d6aa4c", 0.95, 0.28),
  choke: std("#3d4148", 0.5, 0.55),
  tan: std("#a98458", 0.2, 0.6), // ceramic capacitors
  hole: std("#040405", 0, 0.95),
  // the audio jacks' colours
  pink: std("#e8799c", 0.1, 0.5),
  lime: std("#9bd35a", 0.1, 0.5),
  sky: std("#5aa9e6", 0.1, 0.5),
  orange: std("#e89a4a", 0.1, 0.5),
});

// the sheet of small printed tops (4 across): one picture and one draw call for all of them
const CELLS = ["choke", "cap", "capGold", "chip", "screw", "battery", "hex", "start", "qcode", "fx", "sticker"];

/** Geometries collected by material, merged into one mesh each at the end (few draw calls). */
class Bag {
  constructor() {
    this.parts = {};
    this.quads = {};
  }
  add(mat, geo) {
    (this.parts[mat] ||= []).push(geo.index ? geo.toNonIndexed() : geo);
  }
  /** A box from corner to corner (mm). */
  box(mat, x0, x1, y0, y1, z0, z1) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(mat, g);
  }
  /** A box by its centre and size. */
  at(mat, cx, cy, w, h, z0, z1) {
    this.box(mat, cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, z0, z1);
  }
  /** A cylinder standing off the board (its axis along z). */
  cyl(mat, cx, cy, r, z0, z1, seg = 20) {
    const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
    g.rotateX(Math.PI / 2);
    g.translate(cx, cy, (z0 + z1) / 2);
    this.add(mat, g);
  }
  /** A cylinder lying along x (a port's barrel, pointing out of the rear). */
  cylX(mat, x0, x1, cy, cz, r, seg = 16) {
    const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg);
    g.rotateZ(Math.PI / 2);
    g.translate((x0 + x1) / 2, cy, cz);
    this.add(mat, g);
  }
  /** An outline [[x, t], ...] raised from z0 to z1, its edges cut at a bevel: the covers and heatsinks. */
  prism(mat, pts, z0, z1, bevel = 0, holes = []) {
    const ring = (list) => list.map(([x, t]) => new THREE.Vector2(x, T(t)));
    const shape = new THREE.Shape(ring(pts));
    for (const h of holes) shape.holes.push(new THREE.Path(ring(h)));
    const g = new THREE.ExtrudeGeometry(shape, bevel
      ? { depth: z1 - z0 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1 }
      : { depth: z1 - z0, bevelEnabled: false });
    g.translate(0, 0, z0 + bevel);
    const uv = g.attributes.uv; // in mm as made: one tile of the brushed finish per 60 mm
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) / 60, uv.getY(i) / 60);
    this.add(mat, g);
  }
  /** A flat printed rectangle facing out of the board, showing [u0, v0, u1, v1] of its sheet. */
  quad(sheet, x0, x1, y0, y1, z, [u0, v0, u1, v1], swap = false) {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).toNonIndexed();
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      const [a, c] = swap ? [uv.getY(i), uv.getX(i)] : [uv.getX(i), uv.getY(i)];
      uv.setXY(i, u0 + a * (u1 - u0), v0 + c * (v1 - v0));
    }
    (this.quads[sheet] ||= []).push(g);
  }
  /** One of the small printed tops (CELLS), w x h, centred. */
  top(cell, cx, cy, w, h, z) {
    const i = CELLS.indexOf(cell), u = (i % 4) / 4, v = 1 - Math.floor(i / 4) / 4, m = 0.006;
    this.quad("tops", cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, z, [u + m, v - 0.25 + m, u + 0.25 - m, v - m]);
  }
  /** A row of gold contacts, `pitch` mm apart, running along x (or up y). */
  pins(x0, x1, y0, y1, z, pitch, along = "x") {
    this.quad("pins", x0, x1, y0, y1, z, [0, 0, (along === "y" ? y1 - y0 : x1 - x0) / pitch, 1], along === "y");
  }
  meshes(materials) {
    return Object.entries(this.parts).map(([mat, list]) => {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), materials[mat]);
      mesh.name = `z790_${mat}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    });
  }
  sheet(name, material) {
    const mesh = new THREE.Mesh(mergeGeometries(this.quads[name], false), material);
    mesh.name = `z790_${name}`;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/* ---------- the small parts soldered all over the board ---------- */
// w x h on the board and z tall (mm). pads: where its solder shows. They are drawn on the PCB, and on
// a strong device they also stand on it as little blocks.
const KINDS = {
  c04: { w: 1.0, h: 0.5, z: 0.5, mat: "tan", pads: "ends", ref: "C", share: 30 },
  r04: { w: 1.0, h: 0.5, z: 0.35, mat: "black", pads: "ends", ref: "R", share: 22 },
  c06: { w: 1.6, h: 0.8, z: 0.8, mat: "tan", pads: "ends", ref: "C", share: 16 },
  r06: { w: 1.6, h: 0.8, z: 0.45, mat: "black", pads: "ends", ref: "R", share: 8 },
  sot: { w: 2.9, h: 1.4, z: 1.0, mat: "black", pads: "legs", legs: 3, ref: "Q", share: 7 },
  so8: { w: 4.9, h: 3.9, z: 1.5, mat: "black", pads: "legs", legs: 4, ref: "U", share: 5, top: true },
  qfn: { w: 4, h: 4, z: 0.85, mat: "black", pads: "under", ref: "U", share: 4, top: true },
  fet: { w: 5, h: 6, z: 1, mat: "black", pads: "under", ref: "PQ", share: 3, top: true },
  ind: { w: 4, h: 4, z: 2.2, mat: "choke", pads: "ends", ref: "L", share: 3 },
  xtl: { w: 3.2, h: 2.5, z: 0.8, mat: "steel", pads: "under", ref: "Y", share: 2 },
};

/** What's printed on the PCB: [text, x, t, size mm, quarter turns, weight]. */
function silkLabels() {
  const H = LAYOUT.headers;
  const out = [
    ["LGA1700", 122, 126, 2.4],
    ["STRIX Z790-E GAMING WIFI II", 162.5, 100, 2.5, 1, 800],
    ["DIMM_A1", 178.5, 167, 1.7], ["DIMM_A2*", 188, 167, 1.7], ["DIMM_B1", 197.5, 167, 1.7], ["DIMM_B2*", 207, 167, 1.7],
    ["EATXPWR", 228.5, 112, 1.9, 1],
    ["EATX12V_1", 60, 17.5, 1.7], ["EATX12V_2", 82, 17.5, 1.7],
    ["M.2_1(SOCKET3)", 108, 178.2, 1.9],
    ["PCIEX16(G5)", 42, 180.6, 1.5], ["PCIEX16(G4)_1", 42, 243.2, 1.5], ["PCIEX16(G4)_2", 42, 283.8, 1.5],
    ["AIO_PUMP", 194, 13.5, 1.5], ["ADD_GEN2_1", 208, 13.5, 1.5],
    ["Q_CODE", 222, 27, 1.5], ["START", 222, 39, 1.5],
    ["U20G2X2_C", 219, 149, 1.5], ["Q_RELEASE", 219, 166.5, 1.3],
    ["ADD_GEN2_3", 64, 293.5, 1.4], ["TB_HEADER", 94, 293.5, 1.4], ["USB_E34", 127, 293.5, 1.4], ["USB_E56", 142, 293.5, 1.4],
    ["CHA_FAN4", 184, 293.5, 1.4], ["F_PANEL", 219, 293.5, 1.7],
    ["CHA_FAN1", 221, 60, 1.4], ["CHA_FAN2", 221, 72, 1.4],
    ["BAT1", 185.5, 290, 1.2, 1], ["SupremeFX", 24, 257, 2.2],
    ["REV 1.02", 226, 78, 1.3, 1], ["MADE IN CHINA", 14, 176, 1.2],
  ];
  for (const h of Object.values(H)) {
    if (!h.label) continue;
    if (h.along === "y") out.push([h.label, h.x - 7, h.t, 1.5, 1]);
    else out.push([h.label, h.x, h.t < 50 ? h.t + 6.5 : h.t - 6, 1.4]);
  }
  return out;
}

/** Where nothing small may go: [x0, x1, t0, t1] of everything bigger, every plug's place, every label. */
function keepOuts() {
  const out = [
    [-5, 79, 0, 152], [-5, 46, 152, 168], // the I/O cover and the VRM heatsink under it
    [36, 158, 152.5, 178], // M.2_1 and its drive
    [90, 166, 3, 38], [48, 93, 1, 16], // the top VRM heatsink, the CPU power headers
    [92, 153, 58, 126], [76, 95, 38, 153], [94, 157, 36, 57], // the socket, the chokes and capacitors round it
    [164.5, 171.5, 26, 48], [164.5, 171.5, 148, 156],
    [173, 212, 8, 167], [228, 245, 84, 140], // memory slots, the 24-pin
    [34, 230, 178, 294], // the three slots and the armour between them
    [20, 228, 294, 305], [224, 245, 142, 272], [213, 225, 155, 165], // bottom headers, the right edge, Q-Release
    [210, 245, 10, 42], [213, 229, 49, 71], [163, 215, 2, 13], // Q-Code and Start, fan headers
    [6, 48, 246, 290], [188, 212, 276, 298], [213, 228, 125, 134], // audio, the battery, the sticker
    [151, 161, 145, 155], [162, 174, 172, 180], [18.5, 29.5, 220.5, 231.5], // chips
  ];
  for (const [x, t] of LAYOUT.holes) out.push([x - 5, x + 5, t - 5, t + 5]);
  for (const [str, x, t, size, turns = 0] of silkLabels()) {
    const w = str.length * size * 0.62 + 1, h = size * 1.4;
    out.push(turns % 2 ? [x - h / 2, x + h / 2, t - w / 2, t + w / 2] : [x - w / 2, x + w / 2, t - h / 2, t + h / 2]);
  }
  return out;
}

/** The small parts: [{ kind, x, t, turn, ref }], in rows of a kind the way a real board is laid out. */
export function smallParts() {
  const rnd = seeded(790);
  const keep = keepOuts();
  const out = [];
  const taken = []; // their boxes, with a little air round each
  const clear = (b) => b[0] > 3 && b[1] < BOARD.w - 3 && b[2] > 3 && b[3] < BOARD.h - 3
    && ![keep, taken].some((list) => list.some((k) => b[0] < k[1] && b[1] > k[0] && b[2] < k[3] && b[3] > k[2]));
  const names = Object.keys(KINDS);
  const total = names.reduce((n, k) => n + KINDS[k].share, 0);
  for (let tries = 0; tries < 6000 && out.length < 560; tries += 1) {
    let pick = rnd() * total;
    const kind = names.find((k) => (pick -= KINDS[k].share) < 0) || names[0];
    const k = KINDS[kind];
    const turn = rnd() < 0.5;
    const [w, h] = turn ? [k.h, k.w] : [k.w, k.h];
    const x = 4 + rnd() * (BOARD.w - 8), t = 4 + rnd() * (BOARD.h - 8);
    const row = k.w < 2 ? 1 + Math.floor(rnd() * 7) : 1; // the little ones come in rows, side by side
    const num = 100 + Math.floor(rnd() * 1900);
    for (let j = 0; j < row; j += 1) {
      const px = x + (turn ? j * (w + 0.45) : 0), pt = t + (turn ? 0 : j * (h + 0.45));
      const m = k.pads === "legs" ? 1 : 0.3;
      const box = [px - w / 2 - m, px + w / 2 + m, pt - h / 2 - m, pt + h / 2 + m];
      if (!clear(box)) break;
      taken.push(box);
      out.push({ kind, x: px, t: pt, turn, ref: j === 0 && rnd() < 0.45 ? `${k.ref}${num}` : null });
    }
  }
  return out;
}

/* ---------- pictures: everything printed, drawn in board millimetres (x, t) ---------- */
function canvasTexture(w, h, draw, data = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
/** A picture of the part of the board from (x0, t0) to (x1, t1), px pixels a millimetre. */
const art = (x0, x1, t0, t1, px, draw, data) => canvasTexture(Math.round((x1 - x0) * px), Math.round((t1 - t0) * px), (ctx) => {
  ctx.px = px;
  ctx.scale(px, px);
  ctx.translate(-x0, -t0);
  draw(ctx);
}, data);

const FONT = '"Segoe UI", Arial, sans-serif';
/** Words centred on (x, t), `size` mm tall. turns: quarter turns (1 reads up the board). */
function text(ctx, str, x, t, size, { turns = 0, angle = 0, weight = 600, color, italic = false, stroke = null, align = "center" } = {}) {
  ctx.save();
  ctx.translate(x, t);
  ctx.rotate(angle - (turns * Math.PI) / 2);
  ctx.scale(1 / ctx.px, 1 / ctx.px); // set in pixels: a browser may refuse a font under 1 px
  ctx.font = `${italic ? "italic " : ""}${weight} ${size * ctx.px}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (color) ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  if (stroke) {
    ctx.lineWidth = stroke.w * ctx.px;
    ctx.strokeStyle = stroke.color;
    ctx.strokeText(str, 0, 0);
  }
  ctx.restore();
}
function path(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, t], i) => (i ? ctx.lineTo(x, t) : ctx.moveTo(x, t)));
  if (close) ctx.closePath();
}
const line = (ctx, pts) => {
  path(ctx, pts, false);
  ctx.stroke();
};
function disc(ctx, x, t, r) {
  ctx.beginPath();
  ctx.arc(x, t, r, 0, Math.PI * 2);
}
function rounded(ctx, x, t, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, t);
  ctx.arcTo(x + w, t, x + w, t + h, r);
  ctx.arcTo(x + w, t + h, x, t + h, r);
  ctx.arcTo(x, t + h, x, t, r);
  ctx.arcTo(x, t, x + w, t, r);
  ctx.closePath();
}
/** Brushed metal: a tone, fine streaks along x, and a soft sheen across it. */
function brushedArea(ctx, [x0, x1, t0, t1], tone, seed) {
  const rnd = seeded(seed);
  ctx.fillStyle = tone;
  ctx.fillRect(x0, t0, x1 - x0, t1 - t0);
  ctx.lineWidth = 0.14;
  for (let i = ((x1 - x0) * (t1 - t0)) / 5; i > 0; i -= 1) {
    const x = x0 + rnd() * (x1 - x0), t = t0 + rnd() * (t1 - t0);
    ctx.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.06})` : `rgba(0,0,0,${0.06 + rnd() * 0.14})`;
    line(ctx, [[x, t], [x + 5 + rnd() * 40, t]]);
  }
  const g = ctx.createLinearGradient(x0, t0, x1, t1);
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(x0, t0, x1 - x0, t1 - t0);
}
/** A cut across a heatsink, leaning like the seams ("/"): a dark channel with a lit edge. */
function slash(ctx, xTop, t0, t1, w = 1.6, lean = 16 / 46.5) {
  const xBottom = xTop - (t1 - t0) * lean;
  ctx.lineWidth = w;
  ctx.strokeStyle = "#050506";
  line(ctx, [[xBottom, t1], [xTop, t0]]);
  ctx.lineWidth = 0.22;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  line(ctx, [[xBottom + w / 2 + 0.1, t1], [xTop + w / 2 + 0.1, t0]]);
}
/** n chevrons ">>" pointing right from (x, t). */
function chevrons(ctx, x, t, n, s = 2.2) {
  ctx.lineWidth = s * 0.3;
  ctx.strokeStyle = "#c9cdd4";
  for (let i = 0; i < n; i += 1) line(ctx, [[x + i * s * 1.3, t - s], [x + i * s * 1.3 + s, t], [x + i * s * 1.3, t + s]]);
}

// The PCB is drawn twice with different inks: once in colour, once as a map of how rough (green) and
// how metallic (blue) each spot is, so solder and gold gleam while the black mask stays matte.
const INK = {
  color: {
    base: "#0a0b0d", grain: true, pour: "rgba(255,255,255,0.02)", slash: "rgba(255,255,255,0.03)",
    trace: "rgba(150,162,185,0.14)", via: "rgba(170,176,190,0.3)", pad: "#aab0ba", land: "#b6bcc6",
    silk: "#dfe3ea", silkDim: "rgba(223,227,234,0.6)", gold: "#c9a24a",
    body: { tan: "#9c7a52", black: "#15161a", choke: "#33363c", steel: "#b9bec6" },
  },
  orm: {
    base: "rgb(0,205,0)", trace: "rgba(0,140,0,0.5)", via: "rgb(0,90,255)", pad: "rgb(0,85,255)", land: "rgb(0,80,255)",
    silk: "rgb(0,235,0)", silkDim: "rgb(0,235,0)", gold: "rgb(0,70,255)",
  },
};

function drawSmallPart(ctx, ink, p) {
  const k = KINDS[p.kind];
  const [w, h] = p.turn ? [k.h, k.w] : [k.w, k.h];
  const x0 = p.x - w / 2, t0 = p.t - h / 2;
  const R = (x, t, ww, hh) => ctx.fillRect(x, t, ww, hh);
  ctx.fillStyle = ink.pad;
  if (k.pads === "ends") {
    const e = k.w * 0.3;
    if (p.turn) [t0 - 0.1, t0 + h - e + 0.1].forEach((t) => R(x0 - 0.05, t, w + 0.1, e));
    else [x0 - 0.1, x0 + w - e + 0.1].forEach((x) => R(x, t0 - 0.05, e, h + 0.1));
  } else if (k.pads === "legs") {
    for (let i = 0; i < k.legs; i += 1) {
      if (p.turn) R(x0 - 0.6, t0 + ((i + 0.5) / k.legs) * h - 0.2, w + 1.2, 0.4);
      else R(x0 + ((i + 0.5) / k.legs) * w - 0.2, t0 - 0.6, 0.4, h + 1.2);
    }
  } else R(x0 - 0.15, t0 - 0.15, w + 0.3, h + 0.3);
  if (ink.body) {
    ctx.fillStyle = ink.body[k.mat];
    const cut = k.pads === "ends" ? k.w * 0.19 : 0; // its ends are solder
    if (p.turn) R(x0, t0 + cut, w, h - 2 * cut);
    else R(x0 + cut, t0, w - 2 * cut, h);
  }
  if (k.w > 2.5) {
    ctx.strokeStyle = ink.silkDim;
    ctx.lineWidth = 0.12;
    ctx.strokeRect(x0 - 0.95, t0 - 0.95, w + 1.9, h + 1.9);
  }
  if (p.ref) text(ctx, p.ref, p.x, t0 - 1.5, 0.85, { weight: 500, color: ink.silkDim });
}

function drawPcb(ctx, ink, parts) {
  const rnd = seeded(11);
  const { w: W, h: Hh } = BOARD;
  ctx.fillStyle = ink.base;
  ctx.fillRect(0, 0, W, Hh);
  if (ink.grain) {
    // the solder mask's fine grain
    for (let i = 0; i < 16000; i += 1) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.3)";
      ctx.fillRect(rnd() * W, rnd() * Hh, 0.15 + rnd() * 0.3, 0.15 + rnd() * 0.3);
    }
    // copper areas showing faintly through it
    ctx.fillStyle = ink.pour;
    for (let i = 0; i < 40; i += 1) ctx.fillRect(rnd() * W - 20, rnd() * Hh - 20, 14 + rnd() * 60, 10 + rnd() * 50);
    // the fine diagonal lines ROG boards print across the PCB
    ctx.strokeStyle = ink.slash;
    ctx.lineWidth = 0.35;
    for (let d = -Hh; d < W; d += 5) line(ctx, [[d, Hh], [d + Hh, 0]]);
  }
  // copper traces under the mask, in bundles: each line is the last one moved over by (dx, dt)
  ctx.strokeStyle = ink.trace;
  ctx.lineWidth = 0.28;
  const fan = (n, pts) => {
    for (let i = 0; i < n; i += 1) line(ctx, pts.map(([x, t, dx = 0, dt = 0]) => [x + i * dx, t + i * dt]));
  };
  fan(30, [[146, 64, 0, 2.1], [157, 58, 0, 2.7], [174, 58, 0, 2.7]]); // the socket to the memory
  fan(22, [[102, 124, 1.8, 0], [96, 150, 2, 0], [70, 180, 2.6, 0]]); // to the first slot
  fan(14, [[150, 124, 1.2, 0], [170, 170, 1.5, 0], [176, 196, 1.6, 0]]); // to the chipset
  fan(18, [[212, 30, 0, 3], [218, 33, 0, 3], [229, 33, 0, 3]]);
  fan(12, [[8, 170, 1.2, 0], [8, 236, 1.2, 0], [20, 248, 1.2, 0]]); // down the left edge from the rear ports
  fan(9, [[158, 168, 0, 1.1], [166, 180, 0, 1.1], [224, 180, 0, 1.1]]);
  fan(10, [[214, 44, 1.2, 0], [214, 120, 1.2, 0]]);
  for (let i = 0; i < 14; i += 1) {
    // length-matched lines: little zigzags below the memory
    const x = 176 + i * 2.4;
    line(ctx, Array.from({ length: 9 }, (_, s) => [x + (s % 2 ? 0.6 : -0.6), 168.5 + s * 1.1]));
  }
  // vias
  ctx.fillStyle = ink.via;
  for (let i = 0; i < 900; i += 1) {
    disc(ctx, 3 + rnd() * (W - 6), 3 + rnd() * (Hh - 6), 0.16 + rnd() * 0.08);
    ctx.fill();
  }
  // the audio section's isolation line, bottom left
  ctx.strokeStyle = ink.gold;
  ctx.lineWidth = 0.45;
  line(ctx, [[2, 236], [36, 236], [48.5, 248.5], [48.5, 303]]); // clear of the slots
  // screw-hole lands, each with its ring of vias
  for (const [x, t] of LAYOUT.holes) {
    ctx.fillStyle = ink.land;
    disc(ctx, x, t, 4.2);
    ctx.fill();
    ctx.fillStyle = ink.base;
    for (let a = 0; a < 8; a += 1) {
      disc(ctx, x + Math.cos((a * Math.PI) / 4) * 3.1, t + Math.sin((a * Math.PI) / 4) * 3.1, 0.35);
      ctx.fill();
    }
  }
  for (const p of parts) drawSmallPart(ctx, ink, p);
  // outlines: the socket's keep-out, the M.2 drive's lengths
  ctx.strokeStyle = ink.silkDim;
  ctx.lineWidth = 0.25;
  ctx.strokeRect(LAYOUT.socket.x - 30, LAYOUT.socket.t - 34, 60, 68);
  ctx.strokeRect(66, 154, 88, 22);
  ctx.fillStyle = ink.silk;
  for (const [str, x, t, size, turns = 0, weight = 600] of silkLabels()) text(ctx, str, x, t, size, { turns, weight });
  for (const [x, len] of [[70, "2280"], [90, "2260"], [110, "2242"]]) text(ctx, len, x, 172, 1.3);
}

/** The gold lands in the socket: rows of dots round a window of small capacitors. */
function drawLands(ctx, W, Hh) {
  ctx.fillStyle = "#17120a";
  ctx.fillRect(0, 0, W, Hh);
  const step = W / 46;
  const mid = (x, y) => Math.abs(x - W / 2) < W * 0.19 && Math.abs(y - Hh / 2) < Hh * 0.2;
  ctx.fillStyle = "#e3b95a";
  for (let y = step; y < Hh - step / 2; y += step) {
    for (let x = step; x < W - step / 2; x += step) if (!mid(x, y)) ctx.fillRect(x - step * 0.28, y - step * 0.28, step * 0.56, step * 0.56);
  }
  ctx.fillStyle = "#0d0e10";
  ctx.fillRect(W * 0.32, Hh * 0.31, W * 0.36, Hh * 0.38);
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const x = W * 0.35 + c * W * 0.08, y = Hh * 0.335 + r * Hh * 0.058;
      ctx.fillStyle = "#b9bec6";
      ctx.fillRect(x, y, W * 0.055, Hh * 0.036);
      ctx.fillStyle = "#9c7a52";
      ctx.fillRect(x + W * 0.012, y, W * 0.031, Hh * 0.036);
    }
  }
}

/** The I/O cover's top: its display with the glowing sweep, STRIX and the motto. glowOnly: just what lights up. */
function drawCover(ctx, glowOnly) {
  const box = bounds(SHAPES.cover);
  if (glowOnly) {
    ctx.fillStyle = "#000";
    ctx.fillRect(box[0], box[2], box[1] - box[0], box[3] - box[2]);
  } else {
    brushedArea(ctx, box, "#141619", 31);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i += 1) line(ctx, [[1, 111.5 + i * 4.2], [62, 143 + i * 4.2]]);
    text(ctx, "STRIX", 31, 98, 15, { angle: SLOPE, weight: 900, italic: true, color: "#24272c", stroke: { w: 0.35, color: "#a4aab4" } });
    text(ctx, "FOR THOSE", 14, 134, 2.3, { angle: SLOPE, weight: 700, color: "#b4bac3" });
    text(ctx, "WHO DARE", 29, 152.5, 2.3, { angle: SLOPE, weight: 700, color: "#b4bac3" });
    path(ctx, SHAPES.display);
    ctx.fillStyle = "#040405";
    ctx.fill();
  }
  // the sweep of light on the display
  ctx.save();
  path(ctx, SHAPES.display);
  ctx.clip();
  const g = ctx.createLinearGradient(4, 84, 58, 22);
  g.addColorStop(0, "#2563eb");
  g.addColorStop(0.5, "#7c3aed");
  g.addColorStop(1, "#e879f9");
  ctx.fillStyle = g;
  ctx.shadowColor = "#8b5cf6";
  ctx.shadowBlur = 2.5 * ctx.px;
  const sweep = ([a, c1, c2, b, b2, c3, c4, a2]) => {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.bezierCurveTo(...c1, ...c2, ...b);
    ctx.lineTo(...b2);
    ctx.bezierCurveTo(...c3, ...c4, ...a2);
    ctx.closePath();
    ctx.fill();
  };
  sweep([[4, 63], [18, 46], [36, 38], [58, 36], [58, 47], [40, 47], [22, 54], [4, 69]]);
  sweep([[14, 71], [28, 61], [44, 64], [58, 82], [58, 93], [46, 74], [30, 70], [14, 75]]);
  sweep([[10, 41], [22, 27], [38, 23], [56, 31], [57, 35], [40, 29], [24, 33], [10, 45]]);
  ctx.restore();
  if (!glowOnly) {
    ["R", "O", "G"].forEach((ch, i) => text(ctx, ch, 9 + i * 4.2, 12.5, 2.6, { weight: 800, color: "#c9cdd4" }));
    path(ctx, SHAPES.display);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();
  }
}

// What's printed on each heatsink's top: brushed metal, its cuts and its words.
const PLATE_ART = {
  vrmTop(ctx, box) {
    brushedArea(ctx, box, "#1f2226", 41);
    chevrons(ctx, 101, 19, 3);
    text(ctx, "ROG STRIX  //  18+1+2 POWER STAGES", 134, 17.4, 1.25, { weight: 600, color: "#c3c8d0" });
    text(ctx, "REPUBLIC OF GAMERS  //  FOR THOSE WHO DARE", 134, 20.4, 1.05, { weight: 500, color: "#9399a3" });
  },
  plateA(ctx, box) {
    brushedArea(ctx, box, "#1b1d21", 42);
    ctx.strokeStyle = "#050506";
    ctx.lineWidth = 0.7;
    line(ctx, [[44, 216.2], [106, 216.2]]); // where the two M.2 heatsinks meet
    slash(ctx, 122, 193, 239.5);
    slash(ctx, 127, 193, 239.5, 0.7);
    chevrons(ctx, 62, 204.5, 2);
    ["START", "OPTIONS", "QUIT"].forEach((s, i) => text(ctx, s, 150, 201 + i * 4.6, 1.7, { weight: 700, color: i ? "#7f858f" : "#d5d9df", align: "right" }));
    text(ctx, "M.2_2", 56, 211, 1.5, { color: "#8d939c" });
    text(ctx, "M.2_3", 56, 234.5, 1.5, { color: "#8d939c" });
  },
  rog(ctx, box) {
    ctx.fillStyle = "#0c0d10";
    ctx.fillRect(box[0], box[2], box[1] - box[0], box[3] - box[2]);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.3;
    for (let d = 100; d < 300; d += 2.2) line(ctx, [[d, 240], [d + 16, 193]]);
    ctx.fillStyle = "#16181c"; // the bed the letters stand on
    path(ctx, [[163, 227], [168.5, 208.5], [226, 208.5], [226, 227]]);
    ctx.fill();
    text(ctx, "GAME FIRST", 180, 233.5, 1.9, { weight: 800, color: "#d5d9df" });
    text(ctx, "WORK SECOND", 209, 233.5, 1.9, { weight: 800, color: "#d5d9df" });
    ctx.fillStyle = "#d5d9df";
    path(ctx, [[193, 234.4], [195.6, 232.6], [196.4, 233.2], [194, 234.9]]);
    ctx.fill();
    text(ctx, "ROG STRIX Z790-E", 199, 200.5, 1.6, { weight: 700, color: "#8d939c" });
  },
  chipLow(ctx, box) {
    brushedArea(ctx, box, "#1b1d21", 44);
    ctx.strokeStyle = "#e2e5ea";
    ctx.lineWidth = 0.5;
    line(ctx, [[176.5, 252.5], [180.5, 241]]);
    line(ctx, [[179, 252.5], [183, 241]]);
    text(ctx, "Z790", 212, 246.8, 2.4, { weight: 800, color: "#aeb4bd" });
  },
  plateB(ctx, box) {
    brushedArea(ctx, box, "#1b1d21", 45);
    slash(ctx, 156, 253.5, 276.5);
    ctx.strokeStyle = "#e2e5ea";
    ctx.lineWidth = 0.45;
    line(ctx, [[160, 276.5], [168, 253.5]]);
    chevrons(ctx, 62, 265, 2);
    text(ctx, "M.2_4", 88, 271, 1.5, { color: "#8d939c" });
    text(ctx, "M.2_5", 204, 271, 1.5, { color: "#8d939c" });
    text(ctx, "GAME ON", 122, 262, 1.9, { weight: 800, color: "#c3c8d0" });
  },
};

// The small tops, each drawn in a 1 x 1 square (CELLS gives their order on the sheet).
const TOPS = {
  choke(c) {
    rounded(c, 0.04, 0.04, 0.92, 0.92, 0.12);
    c.fillStyle = "#2b2e33";
    c.fill();
    rounded(c, 0.14, 0.14, 0.72, 0.72, 0.1);
    c.fillStyle = "#393d44";
    c.fill();
    text(c, "R15", 0.5, 0.52, 0.27, { weight: 700, color: "#8d939c" });
  },
  cap(c) {
    disc(c, 0.5, 0.5, 0.46);
    c.fillStyle = "#141519";
    c.fill();
    disc(c, 0.5, 0.5, 0.39);
    c.lineWidth = 0.035;
    c.strokeStyle = "#4d525b";
    c.stroke();
    c.strokeStyle = "#30333a";
    for (const a of [90, 210, 330]) line(c, [[0.5, 0.5], [0.5 + Math.cos((a * Math.PI) / 180) * 0.3, 0.5 + Math.sin((a * Math.PI) / 180) * 0.3]]);
  },
  capGold(c) {
    const g = c.createRadialGradient(0.4, 0.38, 0.05, 0.5, 0.5, 0.48);
    g.addColorStop(0, "#edcb72");
    g.addColorStop(1, "#a57c28");
    disc(c, 0.5, 0.5, 0.46);
    c.fillStyle = g;
    c.fill();
    c.beginPath();
    c.arc(0.5, 0.5, 0.46, -1.0, 2.1);
    c.closePath();
    c.fillStyle = "#17181b";
    c.fill();
  },
  chip(c) {
    rounded(c, 0.03, 0.03, 0.94, 0.94, 0.06);
    c.fillStyle = "#121316";
    c.fill();
    text(c, "ROG", 0.5, 0.36, 0.22, { weight: 700, color: "#7d838c" });
    text(c, "A2314", 0.5, 0.62, 0.15, { weight: 500, color: "#666c75" });
    disc(c, 0.15, 0.85, 0.05);
    c.fillStyle = "#2c2f35";
    c.fill();
  },
  screw(c) {
    const g = c.createRadialGradient(0.38, 0.36, 0.04, 0.5, 0.5, 0.48);
    g.addColorStop(0, "#f1f3f6");
    g.addColorStop(1, "#8b919a");
    disc(c, 0.5, 0.5, 0.46);
    c.fillStyle = g;
    c.fill();
    c.fillStyle = "#34373d";
    c.fillRect(0.2, 0.44, 0.6, 0.12);
    c.fillRect(0.44, 0.2, 0.12, 0.6);
  },
  battery(c) {
    const g = c.createRadialGradient(0.36, 0.34, 0.05, 0.5, 0.5, 0.5);
    g.addColorStop(0, "#eceef1");
    g.addColorStop(1, "#a2a8b1");
    disc(c, 0.5, 0.5, 0.47);
    c.fillStyle = g;
    c.fill();
    disc(c, 0.5, 0.5, 0.4);
    c.lineWidth = 0.012;
    c.strokeStyle = "#7d838c";
    c.stroke();
    text(c, "+", 0.5, 0.22, 0.17, { weight: 700, color: "#4b5059" });
    text(c, "CR2032", 0.5, 0.46, 0.13, { weight: 700, color: "#4b5059" });
    text(c, "3V", 0.5, 0.64, 0.11, { weight: 600, color: "#4b5059" });
  },
  hex(c) {
    const g = c.createRadialGradient(0.38, 0.36, 0.04, 0.5, 0.5, 0.5);
    g.addColorStop(0, "#f1f3f6");
    g.addColorStop(1, "#8f959e");
    path(c, Array.from({ length: 6 }, (_, i) => [0.5 + Math.cos((i * Math.PI) / 3) * 0.46, 0.5 + Math.sin((i * Math.PI) / 3) * 0.46]));
    c.fillStyle = g;
    c.fill();
    c.fillStyle = "#2c2f35";
    for (let i = 0; i < 6; i += 1) {
      disc(c, 0.5 + Math.cos((i * Math.PI) / 3) * 0.13, 0.5 + Math.sin((i * Math.PI) / 3) * 0.13, 0.07);
      c.fill();
    }
    disc(c, 0.5, 0.5, 0.12);
    c.fill();
  },
  start(c) {
    disc(c, 0.5, 0.5, 0.47);
    c.fillStyle = "#c9cdd3";
    c.fill();
    disc(c, 0.5, 0.5, 0.38);
    c.fillStyle = "#17181b";
    c.fill();
    text(c, "START", 0.5, 0.51, 0.16, { weight: 800, color: "#e7eaef" });
  },
  qcode(c) {
    rounded(c, 0.02, 0.02, 0.96, 0.96, 0.05);
    c.fillStyle = "#120607";
    c.fill();
    c.fillStyle = "#5c1414"; // both digits unlit: every segment shows faintly
    for (const x of [0.1, 0.56]) {
      for (const y of [0.14, 0.47, 0.8]) c.fillRect(x + 0.05, y, 0.24, 0.06);
      for (const y of [0.2, 0.53]) {
        c.fillRect(x, y, 0.05, 0.27);
        c.fillRect(x + 0.29, y, 0.05, 0.27);
      }
    }
  },
  fx(c) {
    rounded(c, 0.02, 0.02, 0.96, 0.96, 0.05);
    c.fillStyle = "#c2c6cd";
    c.fill();
    const rnd = seeded(5);
    c.lineWidth = 0.006;
    for (let i = 0; i < 90; i += 1) {
      c.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.1})`;
      const y = 0.04 + rnd() * 0.92;
      line(c, [[0.04, y], [0.96, y]]);
    }
    c.lineWidth = 0.015;
    c.strokeStyle = "#8d939c";
    c.strokeRect(0.08, 0.08, 0.84, 0.84);
    text(c, "SUPREMEFX", 0.5, 0.5, 0.115, { weight: 800, color: "#2a2d33" });
  },
  sticker(c) {
    const rnd = seeded(9);
    rounded(c, 0.01, 0.01, 0.98, 0.98, 0.04);
    c.fillStyle = "#f4f5f7";
    c.fill();
    c.fillStyle = "#111";
    for (let x = 0.06; x < 0.56; x += 0.012 + rnd() * 0.03) c.fillRect(x, 0.12, 0.006 + rnd() * 0.014, 0.5);
    for (let i = 0; i < 11; i += 1) for (let j = 0; j < 11; j += 1) if (rnd() < 0.5) c.fillRect(0.62 + i * 0.03, 0.12 + j * 0.06, 0.03, 0.06);
    text(c, "Z790-E GAMING WIFI II", 0.31, 0.78, 0.085, { weight: 700, color: "#111" });
  },
};

/** A printed face: a flat rectangle just off a surface, x0..x1, y0..y1 at height z. */
function decal(material, x0, x1, y0, y1, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), material);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  mesh.receiveShadow = true;
  mesh.name = "z790_print";
  return mesh;
}
/** A printed face cut to an outline [[x, t], ...]; its picture covers `box` (the outline's own by default). */
function face(material, pts, z, box = bounds(pts)) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, t]) => new THREE.Vector2(x, T(t)))));
  const [x0, x1, t0, t1] = box;
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - T(t1)) / (t1 - t0));
  const mesh = new THREE.Mesh(g, material);
  mesh.position.z = z;
  mesh.receiveShadow = true;
  mesh.name = "z790_print";
  return mesh;
}
/** A printed face on the board's rear side (facing out of the back of the case), z0..z1 by t0..t1 at x. */
function faceBack(material, x, z0, z1, t0, t1) {
  const g = new THREE.PlaneGeometry(z1 - z0, t1 - t0);
  g.rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, material);
  mesh.position.set(x, T((t0 + t1) / 2), (z0 + z1) / 2);
  mesh.name = "z790_print";
  return mesh;
}
/** A material for a print: it sits a hair off its surface, and is drawn as if a hair nearer still. */
const printed = (map, metalness, roughness, extra = {}) => std("#ffffff", metalness, roughness, { map, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra });

/* ---------- the parts ---------- */

/** A row of square pins on a plastic base (2.54 mm apart). along "y": the row runs up the board. */
function pinHeader(b, cx, cy, cols, rows, { along = "x", base = "black", shroud = false } = {}) {
  const w = cols * 2.54, d = rows * 2.54;
  const [sx, sy] = along === "y" ? [d, w] : [w, d];
  b.at(base, cx, cy, sx + (shroud ? 2.4 : 0), sy + (shroud ? 2.4 : 0), 0, 2.5);
  if (shroud) {
    // a wall round the pins, open on top
    const [ox, oy] = [sx / 2 + 1.2, sy / 2 + 1.2];
    b.box(base, cx - ox, cx + ox, cy + oy - 0.8, cy + oy, 2.5, 8.6);
    b.box(base, cx - ox, cx + ox, cy - oy, cy - oy + 0.8, 2.5, 8.6);
    b.box(base, cx - ox, cx - ox + 0.8, cy - oy, cy + oy, 2.5, 8.6);
    b.box(base, cx + ox - 0.8, cx + ox, cy - oy, cy + oy, 2.5, 8.6);
  }
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const u = (c - (cols - 1) / 2) * 2.54, v = (r - (rows - 1) / 2) * 2.54;
      const [px, py] = along === "y" ? [cx + v, cy + u] : [cx + u, cy + v];
      b.at("gold", px, py, 0.64, 0.64, 2.5, 8.2);
    }
  }
}

/** A 4-pin fan (or lights) header: its pins and the guide tab behind them. */
function fanHeader(b, cx, cy, base = "black", pins = 4) {
  pinHeader(b, cx, cy, pins, 1, { base });
  b.box(base, cx - pins * 1.27, cx + pins * 1.27 - 2.6, cy + 1.27, cy + 2.1, 2.5, 8.4); // the tab, short of the last pin
}

/** A power header: a shroud `cols` x `rows` cavities (4.2 mm apart), 9 mm tall, a pin in each. */
function powerHeader(b, cx, cy, cols, rows, along = "x") {
  const w = cols * 4.2 + 1.6, d = rows * 4.2 + 1.6;
  const [sx, sy] = along === "y" ? [d, w] : [w, d];
  b.at("black", cx, cy, sx, sy, 0, 3.2); // its floor
  const [ox, oy] = [sx / 2, sy / 2];
  b.box("black", cx - ox, cx + ox, cy + oy - 0.9, cy + oy, 3.2, 9);
  b.box("black", cx - ox, cx + ox, cy - oy, cy - oy + 0.9, 3.2, 9);
  b.box("black", cx - ox, cx - ox + 0.9, cy - oy, cy + oy, 3.2, 9);
  b.box("black", cx + ox - 0.9, cx + ox, cy - oy, cy + oy, 3.2, 9);
  // the clip's catch, on its outer side
  if (along === "y") b.box("black", cx + ox, cx + ox + 1.2, cy - 3, cy + 3, 5.5, 8);
  else b.box("black", cx - 3, cx + 3, cy + oy, cy + oy + 1.2, 5.5, 8);
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const u = (c - (cols - 1) / 2) * 4.2, v = (r - (rows - 1) / 2) * 4.2;
      const [px, py] = along === "y" ? [cx + v, cy + u] : [cx + u, cy + v];
      b.at("gold", px, py, 1.1, 1.1, 3.2, 7.6);
    }
  }
}

/** A capacitor can with its printed top. */
function can(b, x, t, top = "cap", r = 2.6, h = 8.5) {
  b.cyl(top === "capGold" ? "gold" : "dark", x, T(t), r, 0, h);
  b.top(top, x, T(t), r * 2, r * 2, h + 0.03);
}
/** A screw head, standing `h` off z. */
function screw(b, x, t, z, r = 1.9) {
  b.cyl("steel", x, T(t), r, z, z + 0.6, 14);
  b.top("screw", x, T(t), r * 2, r * 2, z + 0.63);
}

function socket(b) {
  const { x: sx, t, seat } = LAYOUT.socket;
  const sy = T(t);
  // the bright steel frame bolted to the board round the socket, and its 4 bolts
  const fx = 26.5, fy = 31;
  b.box("steel", sx - fx, sx + fx, sy + fy - 6, sy + fy, 0, 1.4);
  b.box("steel", sx - fx, sx + fx, sy - fy, sy - fy + 6, 0, 1.4);
  b.box("steel", sx - fx, sx - fx + 5.5, sy - fy, sy + fy, 0, 1.4);
  b.box("steel", sx + fx - 5.5, sx + fx, sy - fy, sy + fy, 0, 1.4);
  for (const [dx, dy] of [[-22, 27.5], [22, 27.5], [-22, -27.5], [22, -27.5]]) {
    b.cyl("steel", sx + dx, sy + dy, 2.7, 1.4, 3.2, 6); // six-sided heads
    b.top("hex", sx + dx, sy + dy, 5.4, 5.4, 3.23);
  }
  // the plastic housing: its floor up to the lands, and a low wall round the package (37.5 x 45)
  const hx = 20.6, hy = 24.4;
  b.box("black", sx - hx, sx + hx, sy - hy, sy + hy, 0, seat - 0.15);
  b.box("black", sx - hx, sx + hx, sy + 22.6, sy + hy, 0, seat + 1.9);
  b.box("black", sx - hx, sx + hx, sy - hy, sy - 22.6, 0, seat + 1.9);
  b.box("black", sx - hx, sx - 18.85, sy - hy, sy + hy, 0, seat + 1.9);
  b.box("black", sx + 18.85, sx + hx, sy - hy, sy + hy, 0, seat + 1.9);
  // the two keys that fit the notches in the CPU's long sides (it goes in one way)
  b.box("black", sx - 18.85, sx - 17.9, sy + 11, sy + 13.2, seat - 0.15, seat + 1.2);
  b.box("black", sx + 17.9, sx + 18.85, sy + 11, sy + 13.2, seat - 0.15, seat + 1.2);
  // the hinge block on the left, and the lever's pivot post and hook base on the right
  b.box("steelDark", sx - 25, sx - 21.2, sy - 24, sy + 24, 1.4, seat + 2.4);
  b.box("steelDark", sx + 22.6, sx + 27.5, sy + 24.5, sy + 30, 1.4, seat + 3.6);
  b.box("steelDark", sx + 22.6, sx + 27, sy - 30.5, sy - 25, 1.4, seat - 0.4);
}

function dimmSlots(b) {
  const { x: xs, t, length, floor } = LAYOUT.dimm;
  const yc = T(t), y0 = yc - length / 2, y1 = yc + length / 2;
  xs.forEach((x, i) => {
    const body = i % 2 ? "dark" : "black";
    b.box(body, x - 3.6, x + 3.6, y0, y1, 0, floor); // the floor of the groove
    b.box(body, x - 3.6, x - 1.1, y0, y1, floor, 6.6);
    b.box(body, x + 1.1, x + 3.6, y0, y1, floor, 6.6);
    b.pins(x - 0.45, x + 0.45, y0 + 6, y1 - 6, floor + 0.05, 0.85, "y"); // the contacts down in it
    b.box(body, x - 1.1, x + 1.1, yc + 3.2, yc + 5.2, floor, 5.2); // the key: DDR5's is off-centre
    b.box(body, x - 3.6, x + 3.6, y0 - 3, y0, 0, 9); // the fixed end, at the bottom
    b.box("gray", x - 3.3, x + 3.3, y1, y1 + 7.5, 0, 11.5); // the latch, at the top (one latch: Q-DIMM)
    b.box("gray", x - 2.2, x + 2.2, y1 + 7.5, y1 + 9.5, 7.5, 11.5);
    // the white mark printed across each slot's rails
    for (const dx of [-2.35, 2.35]) b.at("white", x + dx, T(119), 2.3, 3.4, 6.6, 6.66);
  });
}

function pcieSlots(b) {
  LAYOUT.pcie.forEach(({ t, steel }) => {
    const y = T(t);
    const x0 = 51, x1 = 141; // 51 mm in from the rear edge, like the other boards': the card's bracket meets the case
    b.box("black", x0, x1, y - 3.7, y + 3.7, 0, 3.4);
    b.box("black", x0, x1, y - 3.7, y - 1, 3.4, 10.6);
    b.box("black", x0, x1, y + 1, y + 3.7, 3.4, 10.6);
    b.box("black", x0, x0 + 1.4, y - 3.7, y + 3.7, 3.4, 10.6);
    b.box("black", x0 + 13.6, x0 + 15.4, y - 1, y + 1, 3.4, 10.6); // the key between the short and long parts
    b.pins(x0 + 2, x1 - 2, y - 0.95, y + 0.95, 3.45, 1); // the contacts down in it
    if (steel) {
      // SafeSlot: a steel jacket round the slot, soldered down at tabs along it
      b.box("steel", x0 - 0.5, x1 + 0.3, y - 4.4, y - 3.7, 0, 10.9);
      b.box("steel", x0 - 0.5, x1 + 0.3, y + 3.7, y + 4.4, 0, 10.9);
      b.box("steel", x0 - 0.5, x0, y - 4.4, y + 4.4, 0, 10.9);
      for (let x = x0 + 8; x < x1; x += 18) {
        b.box("steel", x - 2, x + 2, y - 5.6, y - 4.4, 0, 1.2);
        b.box("steel", x - 2, x + 2, y + 4.4, y + 5.6, 0, 1.2);
      }
    }
    // the latch at its end (the first slot's is worked from a button near the memory: Q-Release)
    b.box(steel ? "gray" : "dark", x1, x1 + 8, y - 3.2, y + 3.2, 0, 8.5);
    b.box(steel ? "gray" : "dark", x1 + 5.5, x1 + 8, y - 3.2, y + 3.2, 8.5, 13);
  });
  b.at("dark", 219, T(160), 9, 6, 0, 5); // the Q-Release button
  b.cyl("gray", 219, T(160), 2.4, 5, 6.4);
}

/** The raised ROG letters on the chipset block: x at their left, tBase under them, s their scale. */
function rogLetters(b, x, tBase, s, z0, z1) {
  const lean = (pts, dx) => pts.map(([u, v]) => [x + s * (dx + u + 0.25 * v), tBase - s * v]);
  const R = [[0, 0], [0, 16], [16, 16], [20, 12], [20, 9], [16.5, 6.5], [20, 0], [15, 0], [12, 6], [4.5, 6], [4.5, 0]];
  const Rin = [[4.5, 9.5], [4.5, 12.5], [14.5, 12.5], [15.5, 11.5], [15.5, 10.5], [14.5, 9.5]];
  const O = [[3, 0], [17, 0], [20, 3], [20, 13], [17, 16], [3, 16], [0, 13], [0, 3]];
  const Oin = [[4.5, 4.5], [4.5, 11.5], [15.5, 11.5], [15.5, 4.5]];
  const G = [[20, 16], [3, 16], [0, 13], [0, 3], [3, 0], [20, 0], [20, 9.5], [10, 9.5], [10, 6], [15.5, 6], [15.5, 4], [4.5, 4], [4.5, 12], [20, 12]];
  b.prism("steel", lean(R, 0), z0, z1, 0.25, [lean(Rin, 0)]);
  b.prism("steel", lean(O, 23), z0, z1, 0.25, [lean(Oin, 23)]);
  b.prism("steel", lean(G, 46), z0, z1, 0.25);
}

function heatsinks(b) {
  // the left VRM heatsink: the I/O cover runs over most of it, its finned flank shows beside the socket
  b.prism("sink", SHAPES.vrmLeft, 4, 30, 0.6);
  for (let t = 24; t <= 124; t += 5) b.box("hole", 62.8, 75.3, T(t) - 0.6, T(t) + 0.6, 28.2, 30.03);
  // the top one, with a finned lip facing the socket
  b.prism("sink", SHAPES.vrmTop, 4, 28, 0.6);
  for (const t of [12.5, 25.5]) b.box("hole", 100, 156, T(t) - 0.5, T(t) + 0.5, 26.4, 28.09);
  b.box("sink", 96, 160, T(36.2), T(33), 4, 17);
  for (let x = 99; x <= 157; x += 3.6) b.box("hole", x - 0.5, x + 0.5, T(36.22), T(33.3), 9, 17.03);
  b.box("sink", 76, 92, T(30), T(21), 7, 12); // the heat pipe joining them, under its cover
  // the armour over the lower half: two plates over the M.2 slots, the chipset's block between them
  b.box("dark", 46, 150, T(238), T(196), 0, 3.2);
  b.prism("sink", SHAPES.plateA, 3.2, 7.6, 0.5);
  b.box("dark", 160, 226, T(251), T(194.5), 0, 1.5);
  b.prism("sink", SHAPES.rog, 1.5, 9.5, 0.5);
  rogLetters(b, 167, 224, 0.8, 9.5, 11);
  b.prism("sink", SHAPES.chipLow, 1.5, 8, 0.4);
  b.box("dark", 46, 226, T(275), T(255), 0, 3.2);
  b.prism("sink", SHAPES.plateB, 3.2, 7.6, 0.5);
  for (const [x, t] of [[49, 204.5], [49, 228], [136, 228], [49, 265], [216, 265]]) screw(b, x, t, 7.6);
  // M.2_1 is the lab's: its connector, and the posts a 2242, 2260, 2280 or 22110 drive screws onto
  const { x, t, z } = LAYOUT.m2;
  b.box("black", x, x + 5.5, T(t) - 11, T(t) + 11, 0, z + 2.4);
  b.box("gold", x - 0.4, x, T(t) - 9.5, T(t) + 9.5, z - 0.3, z + 0.3);
  for (const len of [42, 60, 80, 110]) {
    b.cyl("gold", x - len, T(t), 2.3, 0, z - 0.5, 12);
    b.cyl("hole", x - len, T(t), 1, z - 0.5, z - 0.45, 8);
  }
}

function power(b) {
  const a = LAYOUT.atx24;
  powerHeader(b, a.x, T(a.t), 12, 2, "y");
  for (const e of LAYOUT.eps8) powerHeader(b, e.x, T(e.t), 4, 2);
  // the VRM's chokes and capacitors that show between the heatsinks and the socket
  const choke = (x, t) => {
    b.at("choke", x, T(t), 8.5, 8.5, 0, 7.5);
    b.top("choke", x, T(t), 8.5, 8.5, 7.53);
  };
  for (let t = 46; t <= 136; t += 10) choke(82, t);
  for (let x = 100; x <= 150; x += 10) choke(x, 41);
  for (let t = 51; t <= 131; t += 10) can(b, 90.6, t, "cap", 2.3);
  for (let x = 96; x <= 152; x += 8) can(b, x, 52);
  for (let x = 62; x <= 86; x += 8) can(b, x, 148.5); // short of the M.2 drive below them
  for (const t of [30, 44, 152]) can(b, 168, t);
}

function headers(b) {
  const H = LAYOUT.headers;
  fanHeader(b, H.cpu_fan.x, T(H.cpu_fan.t), "white");
  fanHeader(b, H.cpu_opt.x, T(H.cpu_opt.t), "white");
  fanHeader(b, 194, T(7), "black"); // AIO_PUMP
  fanHeader(b, 208, T(7), "white", 4); // ADD_GEN2_1 (3 pins on a 4-pin base)
  fanHeader(b, H.add_gen2.x, T(H.add_gen2.t), "white");
  fanHeader(b, 64, T(299.5), "white"); // ADD_GEN2_3
  fanHeader(b, H.rgb.x, T(H.rgb.t), "white");
  fanHeader(b, H.cha_fan.x, T(H.cha_fan.t));
  fanHeader(b, 184, T(299.5)); // CHA_FAN4
  fanHeader(b, 221, T(54)); // CHA_FAN1, _2
  fanHeader(b, 221, T(66));
  pinHeader(b, H.aafp.x, T(H.aafp.t), 5, 2); // front audio
  pinHeader(b, 94, T(299.5), 7, 2, { shroud: true }); // Thunderbolt
  pinHeader(b, H.usb2.x, T(H.usb2.t), 5, 2); // three USB 2.0 headers
  pinHeader(b, 127, T(299.5), 5, 2);
  pinHeader(b, 142, T(299.5), 5, 2);
  pinHeader(b, 212, T(299.5), 10, 2); // the system panel
  pinHeader(b, H.u32g1.x, T(H.u32g1.t), 10, 2, { along: "y", shroud: true }); // two USB 5Gbps headers
  pinHeader(b, 237.5, T(257), 10, 2, { along: "y", shroud: true });
  // the front USB-C (20Gbps) socket, flat on the board
  b.box("steel", 226, 240, T(152), T(146), 0, 4.2);
  b.box("hole", 239.6, 240.05, T(151), T(147), 0.8, 3.4);
  // 4 SATA ports on the right edge, in two stacks, opening to the right
  for (const t of [209, 225]) {
    b.box("black", 230, 244, T(t + 13), T(t), 0, 13);
    for (const z of [1.4, 7.4]) {
      b.box("hole", 243.6, 244.05, T(t + 11.5), T(t + 1.5), z, z + 4.4);
      b.box("gray", 242, 244.02, T(t + 10), T(t + 3), z + 1.6, z + 2.6); // the L-shaped tongue
    }
  }
  // the 2-digit Q-Code display, the 4 Q-LEDs and the Start button, top right
  b.box("black", 213, 231, T(24), T(14), 0, 7);
  b.top("qcode", 222, T(19), 16, 8.4, 7.03);
  for (let i = 0; i < 4; i += 1) b.at("white", 236 + (i % 2) * 3, T(28 + Math.floor(i / 2) * 3), 1.6, 0.9, 0, 0.7);
  b.at("black", 222, T(33.5), 9, 9, 0, 4);
  b.cyl("steel", 222, T(33.5), 3.2, 4, 5.4);
  b.top("start", 222, T(33.5), 6.4, 6.4, 5.43);
  // the clock battery in its holder, by the last slot
  b.cyl("black", 200, T(287.3), 10.4, 0, 2.4, 28);
  b.cyl("steel", 200, T(287.3), 9.6, 2.4, 5, 28);
  b.top("battery", 200, T(287.3), 19.2, 19.2, 5.03);
  // audio: the codec's shield and its gold capacitors
  b.box("steel", 10, 30, T(282), T(262), 0, 3.2);
  b.top("fx", 20, T(272), 20, 20, 3.23);
  for (const [x, t] of [[36, 252], [43, 252], [36, 262], [43, 262], [36, 272], [43, 272], [40, 284]]) can(b, x, t, "capGold", 2.6, 8);
  // bigger chips out in the open, and the label stuck beside the memory
  for (const [x, t, w, h] of [[156, 150, 8, 8], [168, 176, 10, 6], [24, 226, 9, 9]]) {
    b.at("black", x, T(t), w, h, 0, 1.2);
    b.top("chip", x, T(t), w, h, 1.23);
  }
  b.top("sticker", 220.5, T(129.5), 13, 7, 0.08);
}

// The rear panel (the I/O shield, fitted to this board): where it stands, in board mm. It fills the
// case's opening (measured on case-meshify-c.glb: 161 x 44.6 mm, the size ATX gives it). Everything on
// it is placed in panel millimetres [across from the PCB side, down from its top], seen from behind.
const PANEL = { x: -3.5, z0: -3.7, z1: 40.7, t0: 7.8, t1: 168.5 };
const JACKS = [[8, 156, "pink", "MIC IN"], [22, 156, "lime", "LINE OUT"], [36, 156, "sky", "LINE IN"], [22, 146, "dark", "REAR"], [36, 146, "orange", "C/SUB"]];
const ANTENNAS = [[10, 134.5], [34, 134.5]];
const BUTTONS = [[6.5, 43], [6.5, 56]]; // Clear CMOS, BIOS FlashBack

/** The panel's printed face: black, with every port and its label, as ASUS draws it. */
function drawPanel(ctx) {
  const W = PANEL.z1 - PANEL.z0, Hh = PANEL.t1 - PANEL.t0;
  ctx.fillStyle = "#8d939c"; // the plate's bright edge
  ctx.fillRect(0, 0, W, Hh);
  ctx.fillStyle = "#121315";
  ctx.fillRect(0.5, 0.5, W - 1, Hh - 1);
  const label = (str, x, t, size = 1.5) => text(ctx, str, x, t, size, { weight: 700, color: "#eceef1" });
  const rim = (x, t, w, h) => {
    ctx.fillStyle = "#a4aab3";
    ctx.fillRect(x - w / 2, t - h / 2, w, h);
    ctx.fillStyle = "#08080a";
    ctx.fillRect(x - w / 2 + 0.45, t - h / 2 + 0.45, w - 0.9, h - 0.9);
  };
  const usb = (x, t, color) => {
    rim(x, t, 5.8, 13.6);
    ctx.fillStyle = color;
    ctx.fillRect(x - 1.9, t - 5.7, 1.9, 11.4);
    ctx.fillStyle = "#d9b45c";
    for (let i = 0; i < 4; i += 1) ctx.fillRect(x - 0.45, t - 4.6 + i * 2.6, 0.45, 1.4);
  };
  const usbC = (x, t) => {
    rounded(ctx, x - 1.9, t - 4.9, 3.8, 9.8, 1.9);
    ctx.fillStyle = "#a4aab3";
    ctx.fill();
    rounded(ctx, x - 1.4, t - 4.4, 2.8, 8.8, 1.4);
    ctx.fillStyle = "#08080a";
    ctx.fill();
    ctx.fillStyle = "#6a707a";
    ctx.fillRect(x - 0.3, t - 3.2, 0.6, 6.4);
  };
  const outline = (x, t, w, h) => {
    rounded(ctx, x - w / 2, t - h / 2, w, h, 0.9);
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = "#eceef1";
    ctx.stroke();
  };
  // a port with a cut corner: its rim, then its opening
  const shaped = (x, t, pts) => {
    for (const [grow, color] of [[0.45, "#a4aab3"], [0, "#08080a"]]) {
      path(ctx, pts.map(([u, v]) => [x + u + Math.sign(u) * grow, t + v + Math.sign(v) * grow]));
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.fillStyle = "#3a3e45";
    ctx.fillRect(x - 0.4, t - 5.4, 0.8, 10.8);
  };
  // HDMI and DisplayPort, and the mark beside them
  label("HDMI", 9, 7.6);
  label("DP", 25.5, 7.6);
  shaped(9, 21.5, [[-2.4, -7.2], [1, -7.2], [2.4, -5.6], [2.4, 5.6], [1, 7.2], [-2.4, 7.2]]);
  shaped(25.5, 21.5, [[-2.4, -8], [2.4, -8], [2.4, 6.2], [0.8, 8], [-2.4, 8]]);
  ctx.fillStyle = "#d5d9df";
  path(ctx, [[33, 23.5], [41, 17.5], [42.2, 18.6], [36, 23.2], [41.4, 22.4], [38.2, 25.2]]);
  ctx.fill();
  // the two buttons
  rim(BUTTONS[0][0], BUTTONS[0][1], 4.4, 4.4);
  label("CLEAR", 14, 42.2, 1.15);
  label("CMOS", 14, 43.9, 1.15);
  outline(BUTTONS[1][0], BUTTONS[1][1], 7, 9.4);
  rim(BUTTONS[1][0], BUTTONS[1][1], 4.4, 4.4);
  disc(ctx, 13.6, 52.4, 1.5);
  ctx.lineWidth = 0.4;
  ctx.strokeStyle = "#eceef1";
  ctx.stroke();
  label("BIOS", 14, 56.6, 1.15);
  label("FLBK", 14, 58.3, 1.15);
  // the USB ports: blue 5Gbps, red 10Gbps, Type-C
  const BLUE = "#2f6fe0", RED = "#c23a32";
  label("SS", 30.7, 38.4, 1.3);
  usb(26, 47.5, BLUE);
  usb(35.5, 47.5, BLUE);
  label("SS10", 11.7, 63.2, 1.3);
  label("SS", 31.7, 63.2, 1.3);
  [[7, RED], [16.5, RED], [27, BLUE], [36.5, BLUE]].forEach(([x, c]) => usb(x, 72.5, c));
  label("SS10", 7, 86.6, 1.3);
  label("BIOS", 16.5, 87.6, 1.15);
  label("SS10", 31.7, 86.6, 1.3);
  outline(7, 96.5, 6.6, 13.4);
  usbC(7, 96.5);
  outline(16.5, 95.8, 8, 17.4);
  [16.5, 27, 36.5].forEach((x) => usb(x, 96.5, RED));
  label("SS20", 7, 109.8, 1.3);
  label("SS10", 16.5, 109.8, 1.3);
  outline(7, 119.5, 6.6, 13.4);
  usbC(7, 119.5);
  usb(16.5, 119.5, RED);
  // the network port
  rim(30, 119.5, 12.4, 15.4);
  ctx.fillStyle = "#08080a";
  ctx.fillRect(34.5, 116.5, 2.2, 6); // the notch for its clip
  ctx.fillStyle = "#d9b45c";
  for (let i = 0; i < 8; i += 1) ctx.fillRect(25.2, 113.6 + i * 1.5, 2.4, 0.7);
  ctx.fillStyle = "#39d353";
  ctx.fillRect(33.6, 112.6, 1.8, 1.4);
  ctx.fillStyle = "#f5a524";
  ctx.fillRect(33.6, 125, 1.8, 1.4);
  label("2.5G", 40.6, 119.5, 1.25);
  // Wi-Fi, then the audio jacks and the optical output
  label("Wi-Fi 6E", 22, 134.5, 1.6);
  label("SPDIF OUT", 8, 140.6, 1.05);
  for (const [x, t, , name] of JACKS) label(name, x, t - 5.3, 1.05);
  rim(8, 146, 6.6, 6.6);
  ctx.fillStyle = "#2a2d33";
  ctx.fillRect(5.9, 143.9, 4.2, 4.2);
}

function rearPorts(b) {
  const { x, z0, z1, t0, t1 } = PANEL;
  // the plate, and the port blocks soldered to the board behind it
  b.box("black", x, x + 0.6, T(t1), T(t0), z0, z1);
  for (const [a, c, top, mat] of [[13, 31, 19, "steel"], [39, 56, 33, "steel"], [64, 81, 33, "steel"], [87, 105, 33, "steel"], [110, 128, 33, "steel"], [140, 161, 30, "black"]]) {
    b.box(mat, x + 0.6, 17, T(t0 + c), T(t0 + a), 1.5, top);
  }
  // what stands out of the plate: the Wi-Fi antenna sockets, the jacks in their colours, the buttons
  for (const [pz, pt] of ANTENNAS) {
    b.cylX("gold", x - 5.5, x + 3, T(t0 + pt), z0 + pz, 2.9, 14);
    b.cylX("gold", x - 1.2, x, T(t0 + pt), z0 + pz, 4.2, 6); // its nut
    b.cylX("hole", x - 5.55, x - 5.4, T(t0 + pt), z0 + pz, 1.1, 8);
  }
  for (const [pz, pt, mat] of JACKS) {
    b.cylX(mat, x - 1.1, x, T(t0 + pt), z0 + pz, 3.3);
    b.cylX("gold", x - 1.25, x - 1.05, T(t0 + pt), z0 + pz, 2.3);
    b.cylX("hole", x - 1.3, x - 1.2, T(t0 + pt), z0 + pz, 1.6, 10);
  }
  for (const [pz, pt] of BUTTONS) b.cylX("gray", x - 0.7, x, T(t0 + pt), z0 + pz, 1.5, 10);
  // the cover: a slab over the ports and the left VRM heatsink, its walls, and the display raised on it
  b.prism("shroud", SHAPES.cover, 30, 40, 0.8);
  b.box("shroud", 37, 41, T(150), T(4), 3, 30);
  b.box("shroud", 1, 41, T(4), T(0.5), 22, 30);
  b.prism("gloss", SHAPES.display, 40, 40.9, 0.3);
}

/**
 * The whole board, in millimetres (x right, y up, z out of its front, the origin at its bottom-left
 * corner on its front face). The caller scales it into the scene. lite: smaller pictures, a plainer
 * finish, and the small soldered parts only drawn (not standing on the board).
 */
export function buildZ790Board({ lite = false } = {}) {
  const g = new THREE.Group();
  g.name = "z790_board";
  const parts = smallParts();
  const brushed = canvasTexture(256, 256, (ctx) => {
    ctx.px = 4; // a 64 mm tile
    ctx.scale(4, 4);
    brushedArea(ctx, [0, 64, 0, 64], "#e4e4e4", 3);
  });
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;

  const b = new Bag();
  b.box("pcb", 0, BOARD.w, 0, BOARD.h, -BOARD.thick, 0);
  for (const [x, t] of LAYOUT.holes) b.cyl("hole", x, T(t), 2, -BOARD.thick - 0.02, 0.06, 14);
  socket(b);
  dimmSlots(b);
  pcieSlots(b);
  heatsinks(b);
  power(b);
  headers(b);
  rearPorts(b);
  if (!lite) {
    for (const p of parts) {
      const k = KINDS[p.kind];
      const cut = k.pads === "ends" ? k.w * 0.19 : 0;
      const [w, h] = p.turn ? [k.h, k.w - 2 * cut] : [k.w - 2 * cut, k.h];
      b.at(k.mat, p.x, T(p.t), w, h, 0, k.z);
      if (k.top) b.top("chip", p.x, T(p.t), w, h, k.z + 0.03);
    }
  }
  b.meshes(makeMaterials(brushed, lite)).forEach((m) => g.add(m));

  // the small printed tops and the rows of contacts: one sheet each
  const cell = lite ? 64 : 128;
  const tops = canvasTexture(cell * 4, cell * 4, (ctx) => {
    CELLS.forEach((name, i) => {
      ctx.save();
      ctx.translate((i % 4) * cell, Math.floor(i / 4) * cell);
      ctx.scale(cell, cell);
      ctx.px = cell;
      TOPS[name](ctx);
      ctx.restore();
    });
  });
  g.add(b.sheet("tops", printed(tops, 0.35, 0.45, { alphaTest: 0.5 })));
  const pins = canvasTexture(8, 8, (ctx) => {
    ctx.fillStyle = "#0c0a06";
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillStyle = "#b8923f";
    ctx.fillRect(0, 0, 3, 8);
  });
  pins.wrapS = pins.wrapT = THREE.RepeatWrapping;
  g.add(b.sheet("pins", printed(pins, 0.85, 0.35)));

  // the PCB's printed face; on a strong device its solder and gold are shiny, its mask matte
  const pcb = art(0, BOARD.w, 0, BOARD.h, lite ? 3 : 8, (ctx) => drawPcb(ctx, INK.color, parts));
  const orm = lite ? null : art(0, BOARD.w, 0, BOARD.h, 4, (ctx) => drawPcb(ctx, INK.orm, parts), true);
  g.add(decal(orm ? printed(pcb, 1, 1, { roughnessMap: orm, metalnessMap: orm }) : printed(pcb, 0.15, 0.72), 0, BOARD.w, 0, BOARD.h, 0.03));
  const s = LAYOUT.socket;
  g.add(decal(printed(canvasTexture(276, 332, drawLands), 0.75, 0.38), s.x - 18.8, s.x + 18.8, T(s.t) - 22.6, T(s.t) + 22.6, s.seat - 0.1));

  // the I/O cover's top and the display on it (one picture; the display also glows)
  const px = lite ? 3 : 6;
  const box = bounds(SHAPES.cover);
  const panel = art(0, PANEL.z1 - PANEL.z0, 0, PANEL.t1 - PANEL.t0, lite ? 5 : 10, drawPanel);
  g.add(faceBack(printed(panel, 0.35, 0.5), PANEL.x - 0.03, PANEL.z0, PANEL.z1, PANEL.t0, PANEL.t1));
  const cover = art(...box, px, (ctx) => drawCover(ctx, false));
  const glow = art(...box, lite ? 2 : 4, (ctx) => drawCover(ctx, true));
  g.add(face(printed(cover, 0.45, 0.55), inset(SHAPES.cover, 0.8), 40.04, box));
  const glass = lite
    ? printed(cover, 0.2, 0.25, { emissiveMap: glow, emissive: "#ffffff", emissiveIntensity: 0.4 })
    : new THREE.MeshPhysicalMaterial({ map: cover, metalness: 0, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 0.4, emissiveMap: glow, emissive: "#ffffff", emissiveIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  g.add(face(glass, inset(SHAPES.display, 0.3), 40.94, box));

  // the heatsinks' tops
  for (const [name, z, d, metal, rough] of [["vrmTop", 28.04, 0.6, 0.7, 0.5], ["plateA", 7.64, 0.5, 0.7, 0.5], ["rog", 9.54, 0.5, 0.3, 0.3], ["chipLow", 8.04, 0.4, 0.7, 0.5], ["plateB", 7.64, 0.5, 0.7, 0.5]]) {
    const area = bounds(SHAPES[name]);
    g.add(face(printed(art(...area, px, (ctx) => PLATE_ART[name](ctx, area)), metal, rough), inset(SHAPES[name], d), z, area));
  }
  return g;
}
