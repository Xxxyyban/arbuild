import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

function Button3D({ position, label, color, lit = false, dim = false, disabled = false, onPress }) {
  const cap = useRef();
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);

  useFrame((_, dt) => {
    const g = cap.current;
    if (!g) return;
    const target = down ? -0.035 : hover && !disabled ? 0.012 : 0;
    g.position.y += (target - g.position.y) * (1 - Math.exp(-dt * 22));
  });

  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  const inactive = disabled || dim;
  const base = inactive ? "#4b5563" : color;
  const glow = lit ? 0.95 : hover && !disabled ? 0.4 : 0.1;

  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.42, 0.04, 0.34]} />
        <meshStandardMaterial color="#11141a" roughness={0.7} />
      </mesh>
      <group ref={cap}>
        <mesh
          position={[0, 0.07, 0]}
          castShadow
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = disabled ? "not-allowed" : "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            setDown(false);
            document.body.style.cursor = "";
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!disabled) setDown(true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            setDown(false);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onPress();
          }}
        >
          <boxGeometry args={[0.38, 0.06, 0.3]} />
          <meshStandardMaterial
            color={base}
            emissive={base}
            emissiveIntensity={inactive ? 0.02 : glow}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
        <Text
          position={[0, 0.103, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.06}
          maxWidth={0.34}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#ffffff"
          fillOpacity={inactive ? 0.55 : 1}
          raycast={() => null}
        >
          {label}
        </Text>
      </group>
    </group>
  );
}

// buttons: [{ key, label, color, lit, dim, onPress }]
export default function ControlConsole({ position = [3.6, 0, 0.8], rotationY = -0.5, buttons, disabled = false }) {
  const n = buttons.length;
  const width = Math.max(1.2, n * 0.44 + 0.2);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[width + 0.2, 0.08, 1.0]} />
        <meshStandardMaterial color="#2a2f38" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[width, 0.12, 0.6]} />
        <meshStandardMaterial color="#202531" roughness={0.6} />
      </mesh>
      {buttons.map((b, i) => (
        <Button3D
          key={b.key}
          position={[(i - (n - 1) / 2) * 0.44, 0.12, 0]}
          label={b.label}
          color={b.color}
          lit={b.lit}
          dim={b.dim}
          disabled={disabled}
          onPress={b.onPress}
        />
      ))}
    </group>
  );
}