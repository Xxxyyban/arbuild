// Gets a 3D view ready before it's drawn, while its loading note shows. Left to the first frame, all
// of it would happen at once and stop the page: over a second for a whole PC on a computer, more on
// a phone. Its Canvas keeps frameloop "never" until onReady.
//   1. wait until the models have stopped arriving
//   2. compile every material's shaders, off the page's thread (three.js compileAsync)
//   3. a few at a time, so the page keeps answering: each shader's first use (three.js reads back its
//      settings from the graphics driver) and each texture's upload
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";

const EVERY = 150; // ms between looks
const SETTLED = 3; // looks in a row with nothing new and nothing loading
const GIVE_UP = 45000; // ms: draw it anyway

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function prepare(gl, scene, camera, stopped) {
  await gl.compileAsync(scene, camera);
  const materials = new Set();
  const textures = new Set();
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  const programs = new Set([...materials].map((m) => gl.properties.get(m).currentProgram).filter(Boolean));
  for (const program of programs) {
    if (stopped()) return;
    program.getUniforms();
    await tick();
  }
  for (const texture of textures) {
    if (stopped()) return;
    gl.initTexture(texture);
    await tick();
  }
}

export default function WarmUp({ onReady }) {
  const { gl, scene, camera } = useThree();
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });

  useEffect(() => {
    let done = false;
    let last = "";
    let same = 0;
    const start = performance.now();
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      ready.current();
    };
    const timer = setInterval(() => {
      if (performance.now() - start > GIVE_UP) return finish();
      // what's in the scene: its meshes and their materials (the RAM's lights change a material)
      let meshes = 0;
      const materials = new Set();
      scene.traverse((o) => {
        if (!o.material) return;
        meshes++;
        for (const m of [].concat(o.material)) materials.add(m.uuid);
      });
      const now = `${meshes}:${materials.size}`;
      same = now === last ? same + 1 : 0;
      last = now;
      if (same < SETTLED || useProgress.getState().active) return;
      clearInterval(timer);
      prepare(gl, scene, camera, () => done)
        .catch(() => {})
        .finally(finish);
    }, EVERY);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [gl, scene, camera]);

  return null;
}
