// Every model loads through drei's useGLTF from here. The bigger .glb files are Draco-compressed;
// their decoder comes from this site (public/draco, copied from three's examples/jsm/libs/draco/gltf)
// rather than a CDN. Set before any model module calls useGLTF.preload. With the lite graphics
// (graphics.js) a model with a lite copy loads that instead.
import { useGLTF as useDreiGLTF } from "@react-three/drei";
import { modelUrl } from "./graphics";

useDreiGLTF.setDecoderPath("/draco/");

export function useGLTF(path, ...rest) {
  return useDreiGLTF(modelUrl(path), ...rest);
}
useGLTF.preload = (path, ...rest) => useDreiGLTF.preload(modelUrl(path), ...rest);
useGLTF.clear = (path) => useDreiGLTF.clear(modelUrl(path));
useGLTF.setDecoderPath = useDreiGLTF.setDecoderPath;
