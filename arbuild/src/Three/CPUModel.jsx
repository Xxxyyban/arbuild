import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/cpu.glb";
const TARGET_WIDTH = 0.177; // world units — small square chip, roughly AM5 size

/**
 * Real CPU model (.glb). A CPU is flat and thin (like the motherboard),
 * so this uses the same "thin axis" orientation logic as
 * MotherboardModel: measure the raw model, find its thinnest dimension
 * (the chip's height/thickness), and rotate that to point up so it
 * lies flat, chip-side up, ready to seat into the socket.
 */
export default function CPUModel({ spinY = 0, path = MODEL_PATH, ...props }) {
  const [modelExists, setModelExists] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setModelExists(null);
    fetch(path, { method: "HEAD" })
      .then((res) => !cancelled && setModelExists(res.ok))
      .catch(() => !cancelled && setModelExists(false));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (modelExists === false) {
    return <PlaceholderCPU {...props} rotation={[0, spinY, 0]} />;
  }
  if (modelExists === null) {
    return null;
  }
  return <RealCPU {...props} path={path} spinY={spinY} />;
}

function PlaceholderCPU(props) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.02, 0.22]} />
        <meshStandardMaterial color="#0d1117" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[-0.09, 0.011, -0.09]}>
        <boxGeometry args={[0.02, 0.002, 0.02]} />
        <meshStandardMaterial color="#e8a33d" emissive="#e8a33d" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[0.19, 0.004, 0.19]} />
        <meshStandardMaterial color="#c0c4cc" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function RealCPU({ spinY = 0, path, ...props }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [cloned]);

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(cloned);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);

    const dims = [
      { value: rawSize.x, normal: new THREE.Vector3(1, 0, 0) },
      { value: rawSize.y, normal: new THREE.Vector3(0, 1, 0) },
      { value: rawSize.z, normal: new THREE.Vector3(0, 0, 1) },
    ];
    dims.sort((a, b) => a.value - b.value);
    const thinAxisNormal = dims[0].normal;

    const quat = new THREE.Quaternion().setFromUnitVectors(
      thinAxisNormal,
      new THREE.Vector3(0, 1, 0)
    );
    cloned.quaternion.copy(quat);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const horizontal = Math.max(size.x, size.z) || 1;
    const s = TARGET_WIDTH / horizontal;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned]);

  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}