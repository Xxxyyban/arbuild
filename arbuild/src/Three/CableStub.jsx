// A "cut-off" power cable in the scene: the plug and a short length of wire.
// <CableStub type="atx24" />  types: atx24, eps8, pcie8, sata (see cableStubs.js)
import { useMemo } from "react";
import { buildCableStub } from "./cableStubs";

export default function CableStub({ type, ...props }) {
  const object = useMemo(() => buildCableStub(type), [type]);
  return (
    <group {...props}>
      <primitive object={object} />
    </group>
  );
}
