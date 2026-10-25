// Every model loads through drei's useGLTF from here. The bigger .glb files are Draco-compressed;
// their decoder comes from this site (public/draco, copied from three's examples/jsm/libs/draco/gltf)
// rather than a CDN. Set before any model module calls useGLTF.preload.
import { useGLTF } from "@react-three/drei";

useGLTF.setDecoderPath("/draco/");

export { useGLTF };
