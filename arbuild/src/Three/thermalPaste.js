// The thermal paste on a CPU's lid and the tube it comes out of, built with plain three.js like
// Three/cableStubs.js. Sizes are real millimetres, scaled to the scene (MM).
import * as THREE from "three";
import { MM } from "./orient";
import { dabRadius, dabHeight, onLid } from "../lab/Paste";

const GREY = "#6a7078";
const pasteMaterial = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.55, metalness: 0.12 });

/* ---------- the paste on the lid: a height field over the CPU ---------- */

const SPAN = 46; // mm: covers the whole package
const SINK = 0.3; // mm: beyond the paste the surface dips under the lid, so its outline is where the two meet
const FILM_HEIGHT = 0.2; // mm: how thick a pressed film is drawn (thin enough to read as a film, clear of the lid)
const LIP = 1.4; // mm: how far paste squeezed over the edge hangs down the lid's side
const BEAD_WIDTH = 3; // mm: the most it stands out from the lid

// paste isn't glass smooth: broad, soft ridges
const ripple = (x, z) =>
  0.65 * Math.sin(0.9 * x + 1.7 * Math.sin(0.31 * z)) * Math.sin(0.8 * z + 1.3 * Math.sin(0.37 * x)) +
  0.35 * Math.sin(1.3 * x + 0.5 * z + 1.1 * Math.sin(0.5 * z)) * Math.sin(1.2 * z - 0.4 * x);

/**
 * The paste on one CPU's lid: { mesh, drawDabs(dabs), drawFilm(spread), dispose() }. mesh sits in the CPU
 * model's own frame (up is +Y, the lid's plane is X and Z). drawDabs: as squeezed out of the tube.
 * drawFilm: pressed flat by the cooler (lab/Paste.js squeeze), with what got squeezed out over the edge.
 */
export function buildPasteSurface(lid, { cell = 0.5 } = {}) {
  const n = Math.round(SPAN / cell) + 1;
  const half = (n - 1) * cell * 0.5;
  const heights = new Float32Array(n * n);
  const solid = new Uint8Array(n * n); // has paste on it
  const mask = new Uint8Array(n * n);
  // grid points just past the paste's outline are moved onto it, so it's smooth and not in steps
  const gap = new Float32Array(n * n); // how far outside the outline each is (Infinity: not close, stays put)
  const edgeX = new Float32Array(n * n);
  const edgeY = new Float32Array(n * n);
  const edgeZ = new Float32Array(n * n);
  // each grid point off the lid: the nearest point on the lid, and how far that is
  const nearX = new Float32Array(n * n);
  const nearZ = new Float32Array(n * n);
  const off = new Float32Array(n * n);
  const positions = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const c = j * n + i;
      const x = i * cell - half;
      const z = j * cell - half;
      positions[c * 3] = x;
      positions[c * 3 + 2] = z;
      mask[c] = onLid(lid, x, z) ? 1 : 0;
      off[c] = Infinity;
      if (mask[c]) continue;
      for (const r of lid.rects) {
        const px = Math.max(r[0], Math.min(r[2], x));
        const pz = Math.max(r[1], Math.min(r[3], z));
        const d = Math.hypot(x - px, z - pz);
        if (d < off[c]) {
          off[c] = d;
          nearX[c] = px;
          nearZ[c] = pz;
        }
      }
    }
  }
  const index = new Uint16Array((n - 1) * (n - 1) * 6);

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const normalAttr = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
  const indexAttr = new THREE.BufferAttribute(index, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);
  geometry.setAttribute("normal", normalAttr);
  geometry.setIndex(indexAttr);
  geometry.setDrawRange(0, 0);

  const mesh = new THREE.Mesh(geometry, pasteMaterial);
  mesh.name = "thermal-paste";
  mesh.scale.setScalar(MM);
  mesh.position.y = lid.top * MM;
  mesh.raycast = () => {}; // clicks go through to the CPU
  mesh.frustumCulled = false;
  mesh.visible = false;

  // A grid point off the lid goes `w` out from the lid's edge, on its own line from the edge.
  const moveFromLid = (c, x, z, w, y) => {
    const k = off[c] > 0 ? w / off[c] : 0;
    edgeX[c] = nearX[c] + (x - nearX[c]) * k;
    edgeZ[c] = nearZ[c] + (z - nearZ[c]) * k;
    edgeY[c] = y;
    gap[c] = 0;
  };

  // what's on the grid now goes to the GPU: only the cells with paste, so nothing shows anywhere else
  const commit = () => {
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const c = j * n + i;
        const onEdge = !solid[c] && gap[c] < Infinity;
        positions[c * 3] = onEdge ? edgeX[c] : i * cell - half;
        positions[c * 3 + 1] = onEdge ? edgeY[c] : heights[c];
        positions[c * 3 + 2] = onEdge ? edgeZ[c] : j * cell - half;
      }
    }
    let count = 0;
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const c = j * n + i;
        const l = positions[(i > 0 ? c - 1 : c) * 3 + 1];
        const r = positions[(i < n - 1 ? c + 1 : c) * 3 + 1];
        const d = positions[(j > 0 ? c - n : c) * 3 + 1];
        const u = positions[(j < n - 1 ? c + n : c) * 3 + 1];
        const nx = l - r;
        const ny = 2 * cell;
        const nz = d - u;
        const len = 1 / Math.hypot(nx, ny, nz);
        normals[c * 3] = nx * len;
        normals[c * 3 + 1] = ny * len;
        normals[c * 3 + 2] = nz * len;
        if (i < n - 1 && j < n - 1 && (solid[c] || solid[c + 1] || solid[c + n] || solid[c + n + 1])) {
          index[count] = c;
          index[count + 1] = c + n;
          index[count + 2] = c + 1;
          index[count + 3] = c + 1;
          index[count + 4] = c + n;
          index[count + 5] = c + n + 1;
          count += 6;
        }
      }
    }
    geometry.setDrawRange(0, count);
    positionAttr.needsUpdate = true;
    normalAttr.needsUpdate = true;
    indexAttr.needsUpdate = true;
    mesh.visible = count > 0;
  };

  const drawDabs = (dabs) => {
    heights.fill(0);
    gap.fill(Infinity);
    for (const d of dabs) {
      const R = Math.max(dabRadius(d.v), 0.8); // the first drop still shows
      const H = dabHeight(R);
      const reach = R + 1.5 * cell;
      const i0 = Math.max(0, Math.floor((d.x - reach + half) / cell));
      const i1 = Math.min(n - 1, Math.ceil((d.x + reach + half) / cell));
      const j0 = Math.max(0, Math.floor((d.y - reach + half) / cell));
      const j1 = Math.min(n - 1, Math.ceil((d.y + reach + half) / cell));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const c = j * n + i;
          const dx = i * cell - half - d.x;
          const dz = j * cell - half - d.y;
          const away = Math.hypot(dx, dz);
          const k = 1 - (away * away) / (R * R);
          if (k > 0) {
            // dabs blend into each other: the sum of their heights to the 4th power
            heights[c] += H * H * H * H * k * k;
          } else if (mask[c] && away <= reach && away - R < gap[c]) {
            gap[c] = away - R;
            edgeX[c] = d.x + (dx * R) / away;
            edgeY[c] = 0;
            edgeZ[c] = d.y + (dz * R) / away;
          }
        }
      }
    }
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const c = j * n + i;
        const x = i * cell - half;
        const z = j * cell - half;
        solid[c] = mask[c] && heights[c] > 0 ? 1 : 0;
        heights[c] = solid[c] ? Math.sqrt(Math.sqrt(heights[c])) * (1 + 0.05 * ripple(x, z)) : -SINK;
        if (off[c] <= 1.5 * cell) moveFromLid(c, x, z, 0, 0); // the paste stops at the lid's edge
      }
    }
    commit();
  };

  const drawFilm = (s) => {
    gap.fill(Infinity);
    const g = s.size;
    const shift = g / 2 - 0.5;
    // A field of 1 mm cells, softened so nothing shows the cells, counting only the cells it applies
    // to; the other cells get what's next to them, so sampling near the lid's edge doesn't fade out.
    const soften = (start, counts) => {
      let from = start;
      let to = new Float32Array(g * g);
      for (let pass = 0; pass < 2; pass += 1) {
        for (let j = 0; j < g; j += 1) {
          for (let i = 0; i < g; i += 1) {
            let sum = 0;
            let weight = 0;
            for (let b = -1; b <= 1; b += 1) {
              for (let a = -1; a <= 1; a += 1) {
                const p = i + a;
                const q = j + b;
                if (p < 0 || q < 0 || p >= g || q >= g || !counts(q * g + p)) continue;
                const w = (2 - Math.abs(a)) * (2 - Math.abs(b));
                sum += from[q * g + p] * w;
                weight += w;
              }
            }
            to[j * g + i] = weight ? sum / weight : 0;
          }
        }
        [from, to] = [to, from === start ? new Float32Array(g * g) : from];
      }
      return from;
    };
    const full = new Float32Array(g * g);
    for (let c = 0; c < g * g; c += 1) full[c] = s.onCell[c] ? Math.min(1, s.film[c] / s.cap) : 0;
    const wet = soften(full, (c) => s.onCell[c]);
    const out = soften(s.ooze, (c) => !s.onCell[c]);
    const sample = (field, x, z) => {
      const fx = Math.max(0, Math.min(g - 1.001, x + shift));
      const fz = Math.max(0, Math.min(g - 1.001, z + shift));
      const i = Math.floor(fx);
      const j = Math.floor(fz);
      const ax = fx - i;
      const az = fz - j;
      const c = j * g + i;
      return (
        field[c] * (1 - ax) * (1 - az) + field[c + 1] * ax * (1 - az) +
        field[c + g] * (1 - ax) * az + field[c + g + 1] * ax * az
      );
    };
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const c = j * n + i;
        const x = i * cell - half;
        const z = j * cell - half;
        if (mask[c]) {
          // crosses zero at the outline, so the outline falls between the grid's points
          const v = (sample(wet, x, z) - 0.5) / 0.25;
          solid[c] = v > 0 ? 1 : 0;
          heights[c] = v > 0 ? FILM_HEIGHT * Math.min(1, v) * (1 + 0.3 * ripple(x, z)) : Math.max(-SINK, FILM_HEIGHT * v);
          continue;
        }
        solid[c] = 0;
        heights[c] = -LIP;
        if (off[c] > BEAD_WIDTH + 1.5 * cell) continue;
        // what got squeezed out: a rounded bead along the edge, as wide as there's paste for
        const along = off[c] > 0 ? 0.7 / off[c] : 0;
        const here = sample(out, nearX[c] + (x - nearX[c]) * along, nearZ[c] + (z - nearZ[c]) * along);
        const w = here > 0.03 ? Math.min(BEAD_WIDTH, 1.3 * Math.sqrt(here)) : 0;
        if (off[c] < w) {
          const k = off[c] / w;
          solid[c] = 1;
          heights[c] = Math.min(0.7, 0.35 * Math.sqrt(here)) * Math.sqrt(1 - k * k) - LIP * k * k;
        } else if (off[c] <= w + 1.5 * cell) {
          moveFromLid(c, x, z, w, w > 0 ? -LIP : 0);
        }
      }
    }
    commit();
  };

  return {
    mesh, drawDabs, drawFilm,
    dispose: () => geometry.dispose(),
  };
}

/* ---------- the tube ---------- */

// a small syringe, the size it's sold in: about 60 mm long and 7 mm across
const TUBE_SCALE = 0.72;
const R = 4.6; // the barrel's radius, before TUBE_SCALE
const NOZZLE = 13; // from the tip to the barrel
const BARREL = 40;
const ROD = 38;

const tubeMaterials = {
  barrel: new THREE.MeshStandardMaterial({ color: "#e8eef4", transparent: true, opacity: 0.3, roughness: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  plastic: new THREE.MeshStandardMaterial({ color: "#eef1f4", roughness: 0.45 }),
  plunger: new THREE.MeshStandardMaterial({ color: "#dfe3e8", roughness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.75 }),
  cap: new THREE.MeshStandardMaterial({ color: "#059669", roughness: 0.5 }),
};

let labelMaterial = null;
function label() {
  if (labelMaterial) return labelMaterial;
  // the label's text runs along the tube
  const W = 300;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(0, 0, W, 34);
  ctx.fillRect(0, H - 34, W, 34);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 62px system-ui, sans-serif";
  ctx.fillText("THERMAL", 0, -14);
  ctx.fillText("PASTE", 0, 52);
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillText("CPU COMPOUND", 0, 94);
  ctx.restore();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  labelMaterial = new THREE.MeshStandardMaterial({ map, roughness: 0.5 });
  return labelMaterial;
}

const lathe = (points, segments = 20) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/**
 * The syringe of paste: the tip at the origin, the barrel up +Y, the label facing +Z. Its plunger
 * follows what's left: object.userData.setFill(0..1). With `capped`, a cap on the tip (the tube on the bench).
 */
export function buildSyringe({ capped = false } = {}) {
  const root = new THREE.Group();
  root.name = "paste-tube";
  root.scale.setScalar(MM * TUBE_SCALE);
  const add = (parent, geometry, material, y = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.y = y;
    parent.add(m);
    return m;
  };

  const top = NOZZLE + BARREL;
  add(root, lathe([[0, 0], [0.75, 0], [0.95, 0.4], [1.25, 7], [1.9, 10.5], [R, NOZZLE - 0.6], [R, NOZZLE]]), tubeMaterials.plastic);
  add(root, new THREE.CylinderGeometry(R, R, BARREL, 24, 1, true), tubeMaterials.barrel, NOZZLE + BARREL / 2).renderOrder = 2;
  const flange = add(root, new THREE.CylinderGeometry(7.6, 7.6, 1.2, 24), tubeMaterials.plastic, top);
  flange.scale.z = 0.62;
  // the label wraps a bit over half way round
  const wrap = Math.PI * 1.15;
  add(root, new THREE.CylinderGeometry(R + 0.06, R + 0.06, 28, 20, 1, true, -wrap / 2, wrap), label(), NOZZLE + 6 + 14).renderOrder = 3;

  // the paste inside, grown from the nozzle up to the plunger
  const column = add(root, new THREE.CylinderGeometry(R - 0.45, R - 0.45, 1, 20).translate(0, 0.5, 0), pasteMaterial, NOZZLE);
  const plunger = new THREE.Group();
  root.add(plunger);
  add(plunger, new THREE.CylinderGeometry(R - 0.4, R - 0.4, 2.6, 20).translate(0, 1.3, 0), tubeMaterials.rubber);
  add(plunger, new THREE.CylinderGeometry(1.5, 1.5, ROD, 10).translate(0, ROD / 2 + 2.6, 0), tubeMaterials.plunger);
  add(plunger, new THREE.CylinderGeometry(5.4, 5.4, 1.5, 20), tubeMaterials.plunger, ROD + 2.6);

  if (capped) add(root, lathe([[0, -1.2], [1.8, -1.2], [2.4, 0], [2.6, 9.5], [0, 9.5]], 14), tubeMaterials.cap);

  root.userData.setFill = (share) => {
    const level = NOZZLE + 0.2 + (BARREL - 5) * Math.max(0, Math.min(1, share));
    column.scale.y = level - NOZZLE;
    plunger.position.y = level;
  };
  root.userData.setFill(1);
  root.userData.dispose = () => {
    root.traverse((o) => o.isMesh && o.geometry.dispose());
  };
  return root;
}
