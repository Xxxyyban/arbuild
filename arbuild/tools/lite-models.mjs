// Makes the lite models (public/models/lite/) that phones, tablets and computers with a weak graphics
// chip load instead (Three/graphics.js): textures no bigger than 1024 px (512 for the maps other than
// colour), plainer materials (no clearcoat), lighter meshes, and far fewer draw
// calls (the meshes that share a material merged into one). What the code relies on stays as it is:
// the nodes it finds by name (keep), each mesh's place in the world, and the model's bounds as
// three.js measures them (Box3.setFromObject: each mesh's own box turned into the world; every part
// is fitted and mounted by them). Each model is checked for that before it is written.
//
// Run it after changing a model in public/models:
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer draco3dgltf sharp
//   node tools/lite-models.mjs                 every model
//   node tools/lite-models.mjs motherboard     just these
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, PropertyType, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, flatten, join, prune, simplifyPrimitive, textureCompress, transformMesh, weldPrimitive } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argDir = process.argv.indexOf("--models");
const DIR = argDir > 0 ? process.argv[argDir + 1] : path.join(HERE, "..", "public", "models");
const OUT = path.join(DIR, "lite");

// Each model: texture sizes (colour and glow; the other maps), how far its meshes may be thinned
// (ratio of triangles kept, 1 = as they are; error: how far the surface may move, as a share of each
// mesh's size; exact: materials whose meshes aren't thinned; flags: the simplifier's options, such as
// "Permissive" to thin across seams and "Prune" to drop specks too small to see; bake: the merged
// meshes put in world space, where a merged mesh's own box turned into the world would measure the
// model bigger) and the nodes the code finds by name, left whole and as they are.
// cpu1.glb has no lite copy: it is already light (1024 px textures, 6k triangles).
const MODELS = {
  motherboard: { tex: [1024, 512], ratio: 0.2, error: 0.006, flags: ["Permissive", "Prune"], keep: ["Object_25", "Object_224", "Object_23", "Object_213", "Object_64", "Object_65"] }, // MotherboardModel.jsx: M.2 cover, socket
  motherboard1: { tex: [1024, 512], ratio: 0.5, error: 0.001, keep: ["silver"] }, // MotherboardModel1.jsx: the socket lever
  "case-meshify-c": { tex: [1024, 512], ratio: 0.45, error: 0.004, exact: ["Material.001"], bake: true }, // its perforated panels: thinning eats their strands
  case_fan: { tex: [512, 256], ratio: 1 }, // CaseFanModel.jsx cuts its rotor out by shape
  cpu: { tex: [512, 256], ratio: 0.5, error: 0.001 },
  cpu_cooler: { tex: [1024, 512], ratio: 0.6, error: 0.001, bake: true, keep: ["Object_12", "Object_56", "Object_60"] }, // rig: the fan that turns
  cpu_cooler1: { tex: [1024, 512], ratio: 0.5, error: 0.003, keep: ["Object_2", "Object_6"] },
  gpu: { tex: [1024, 512], ratio: 0.4, error: 0.001 },
  gpu1: { tex: [1024, 512], ratio: 1 },
  psu: { tex: [1024, 512], ratio: 0.6, error: 0.001 },
  psu1: { tex: [1024, 512], ratio: 1, bake: true },
  ram: { tex: [1024, 512], ratio: 0.7, error: 0.001 }, // its light bar is found by material name (rigMotion.js)
  ram1: { tex: [1024, 512], ratio: 0.6, error: 0.001 },
  ssd: { tex: [512, 256], ratio: 1 },
  ssd1: { tex: [512, 256], ratio: 0.6, error: 0.001 },
};

// layers the lite look goes without (three.js then uses its plain standard material). A specular
// layer stays where it changes the look (a sticker or a fan that shouldn't shine); one that only
// repeats the default goes.
const SPECULAR = "KHR_materials_specular";
const DROP = ["KHR_materials_clearcoat", "KHR_materials_sheen", "KHR_materials_iridescence", "KHR_materials_transmission", "KHR_materials_volume", "KHR_materials_ior", "KHR_materials_anisotropy", "KHR_materials_dispersion"];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const sceneOf = (doc) => doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const named = (doc, name) => doc.getRoot().listNodes().find((n) => n.getName() === name);
const trianglesOf = (mesh) => mesh.listPrimitives().reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0);

const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** The model's bounds as three.js measures them by default: each mesh's own box, turned into the world. */
function looseBounds(doc) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  sceneOf(doc).traverse((n) => {
    const world = n.getWorldMatrix();
    for (const p of n.getMesh()?.listPrimitives() || []) {
      const pos = p.getAttribute("POSITION");
      const lo = pos.getMin([]);
      const hi = pos.getMax([]);
      for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
        const v = apply(world, [x, y, z]);
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], v[i]);
          max[i] = Math.max(max[i], v[i]);
        }
      }
    }
  });
  return { min, max };
}

/** What the model costs to draw, and what must not change. */
function measure(doc, keep) {
  let draws = 0;
  let tris = 0;
  sceneOf(doc).traverse((n) => {
    const m = n.getMesh();
    if (!m) return;
    draws += m.listPrimitives().length;
    tris += trianglesOf(m);
  });
  let texMB = 0;
  for (const t of doc.getRoot().listTextures()) {
    const [w, h] = t.getSize() || [0, 0];
    texMB += (w * h * 4 * 1.33) / 1048576;
  }
  const kept = Object.fromEntries(
    keep.map((name) => {
      const n = named(doc, name);
      return [name, n ? { world: n.getWorldMatrix(), tris: n.getMesh() ? trianglesOf(n.getMesh()) : 0, bounds: getBounds(n) } : null];
    })
  );
  // the materials the meshes use, by name (the RAM's light bar is found by its material's name)
  const materials = new Set();
  sceneOf(doc).traverse((n) => n.getMesh()?.listPrimitives().forEach((p) => p.getMaterial()?.getName() && materials.add(p.getMaterial().getName())));
  return { draws, tris: Math.round(tris), texMB: Math.round(texMB), bounds: looseBounds(doc), kept, materials };
}

function check(name, before, after) {
  const problems = [];
  const size = before.bounds.max.map((v, i) => v - before.bounds.min[i]);
  const span = Math.max(...size);
  for (const k of ["min", "max"]) {
    before.bounds[k].forEach((v, i) => {
      if (Math.abs(v - after.bounds[k][i]) > span * 0.002) problems.push(`bounds ${k}[${i}] ${v.toFixed(5)} -> ${after.bounds[k][i].toFixed(5)}`);
    });
  }
  for (const [n, b] of Object.entries(before.kept)) {
    const a = after.kept[n];
    if (!b) problems.push(`${n} isn't in the original`);
    else if (!a) problems.push(`${n} is gone`);
    else {
      // Draco drops a few zero-area triangles when it packs a mesh again; nothing else may change
      if (Math.abs(a.tris - b.tris) > b.tris * 0.002) problems.push(`${n} triangles ${b.tris} -> ${a.tris}`);
      if (a.world.some((v, i) => Math.abs(v - b.world[i]) > 1e-4 * Math.max(1, Math.abs(b.world[i])))) problems.push(`${n} moved`);
      const extent = Math.max(...b.bounds.max.map((v, i) => v - b.bounds.min[i]));
      for (const k of ["min", "max"]) if (b.bounds[k].some((v, i) => Math.abs(v - a.bounds[k][i]) > extent * 1e-3)) problems.push(`${n} changed shape`);
    }
  }
  for (const m of before.materials) if (!after.materials.has(m)) problems.push(`material ${m} is gone`);
  if (problems.length) throw new Error(`${name}: ${problems.join("; ")}`);
}

const only = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--models");
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const [name, opt] of Object.entries(MODELS)) {
  if (only.length && !only.includes(name)) continue;
  const src = path.join(DIR, `${name}.glb`);
  if (!fs.existsSync(src)) {
    console.warn(`${name}.glb isn't there; skipped`);
    continue;
  }
  const keep = opt.keep || [];
  const doc = await io.read(src);
  const before = measure(doc, keep);

  // plain materials
  for (const m of doc.getRoot().listMaterials()) {
    const sp = m.getExtension(SPECULAR);
    const plain = sp && sp.getSpecularFactor() >= 0.9 && sp.getSpecularColorFactor().every((v) => v > 0.98) && !sp.getSpecularTexture() && !sp.getSpecularColorTexture();
    if (plain) m.setExtension(SPECULAR, null);
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) if (DROP.includes(ext.extensionName)) ext.dispose();
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));

  // smaller textures, as WebP
  const [big, small] = opt.tex;
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 85, resize: [big, big], slots: /^(baseColor|emissive)/ }),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 85, resize: [small, small], slots: /^(?!baseColor|emissive)/ })
  );

  // lighter meshes: all but the ones kept as they are
  const keepMeshes = new Set(keep.map((n) => named(doc, n)?.getMesh()).filter(Boolean));
  if (opt.ratio < 1) {
    await MeshoptSimplifier.ready;
    const flags = opt.flags || [];
    const simplifier = new Proxy(MeshoptSimplifier, {
      get: (s, k) => (k === "simplify" ? (i, p, stride, n, e, f) => s.simplify(i, p, stride, n, e, [...f, ...flags]) : s[k]),
    });
    for (const mesh of doc.getRoot().listMeshes()) {
      if (keepMeshes.has(mesh)) continue;
      for (const prim of mesh.listPrimitives()) {
        if (opt.exact?.includes(prim.getMaterial()?.getName())) continue;
        weldPrimitive(prim);
        simplifyPrimitive(prim, { simplifier, ratio: opt.ratio, error: opt.error ?? 0.001, lockBorder: false });
      }
    }
  }

  // fewer draw calls: every mesh straight under the scene, then the ones sharing a material joined
  // (not the kept ones: the code finds them by name)
  await doc.transform(flatten(), join({ keepNamed: false, filter: (node) => !keep.includes(node.getName()) }));
  if (opt.bake) {
    for (const node of sceneOf(doc).listChildren()) {
      if (!node.getMesh() || keep.includes(node.getName())) continue;
      transformMesh(node.getMesh(), node.getMatrix());
      node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    }
  }
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }), prune(), draco());

  // written next to its place, and only put there once it passes
  const dst = path.join(OUT, `${name}.glb`);
  const tmp = path.join(OUT, `${name}.tmp.glb`);
  await io.write(tmp, doc);
  try {
    check(name, before, measure(await io.read(tmp), keep));
  } catch (err) {
    fs.rmSync(tmp);
    throw err;
  }
  fs.renameSync(tmp, dst);
  const after = measure(await io.read(dst), keep);
  rows.push({
    model: name,
    draws: `${before.draws} -> ${after.draws}`,
    ktris: `${Math.round(before.tris / 1000)} -> ${Math.round(after.tris / 1000)}`,
    texMB: `${before.texMB} -> ${after.texMB}`,
    MB: `${(fs.statSync(src).size / 1048576).toFixed(1)} -> ${(fs.statSync(dst).size / 1048576).toFixed(1)}`,
  });
}
console.table(rows);
