import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Environment, Lightformer } from "@react-three/drei";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import CaseModel from "../Three/CaseModel";
import MotherboardModel from "../Three/MotherboardModel";
import CPUModel from "../Three/CPUModel";
import RAMModel from "../Three/RAMModel";
import PSUModel from "../Three/PSUModel";
import GPUModel from "../Three/GPUModel"; // ✅ GPU added
import "../styles/Main.css";

const BOARD_LABEL = "ASUS ROG Strix B550-F Gaming";

const PARTS_DATA = {
  cpu: {
    name: "AMD Ryzen 9 5900X Processor (Socket AM4)",
    purpose: "High-performance desktop processor executing multi-threaded instructions for gaming, rendering, and professional lab applications.",
    specs: "Socket AM4 package (Zen 3 architecture, 12 cores, 24 threads), PCIe 4.0 support, unlocked for overclocking.",
    tips: [
      "Ground yourself first by touching the bare metal of the case, or wear an anti-static wrist strap.",
      "Hold the processor by its edges only. Never touch the gold pins on the underside.",
      "Look into the socket with a flashlight before installing. Bent socket pins are extremely fragile.",
      "Lift the socket retention lever fully, match the golden triangle on the corner of the CPU with the triangle marker on the socket, and lower it straight down without pushing or sliding.",
      "If it does not sit flat by itself, lift it out and recheck the orientation. Never press it down to make it fit.",
      "Lower the retention lever to lock the CPU securely into place.",
      "Apply thermal paste, mount the CPU cooler, and plug its fan cable into the CPU fan header.",
    ],
    dos: [
      "Align the gold triangle marker with the socket pin 1 triangle indicator before dropping it in.",
      "Check that the retention arm lifts and locks properly without applying vertical force.",
    ],
    donts: [
      "Do not drop the processor into the socket; lower it vertically with zero angle.",
      "Never touch or bend the delicate gold pins on the underside of the AM4 processor.",
    ],
  },
  motherboard: {
    name: BOARD_LABEL + " (AMD AM4, B550, ATX)",
    purpose: "The main circuit board. It connects the processor, memory, storage, and expansion cards and distributes power to them. This view covers the front (component side) of the board.",
    specs: "AMD AM4 socket for 3rd Gen AMD Ryzen and Ryzen 5000 Series CPUs[cite: 7], AMD B550 chipset, DDR4 DIMM slots, PCIe 4.0 x16 slot, PCIe 3.0 x16 slot, M.2 slots with heatsinks, SATA 6 Gb/s ports.",
    tips: [
      "Work on a clean, non-conductive surface with the power cable unplugged, and ground yourself before touching parts.",
      "Snap the I/O shield into the case before mounting the board. It is very hard to fit afterwards.",
      "Install brass standoffs only where the board has screw holes. An extra standoff under the board can short it.",
      "Tighten mounting screws in a criss-cross pattern until snug. Do not overtighten.",
      "Hold the board by its edges and avoid pressing on heatsinks or the back of the socket.",
    ],
    dos: [
      "Verify brass standoffs align precisely with the mounting screw holes in the chassis.",
      "Connect front panel headers (power switch, reset, LEDs) according to manual pinouts.",
    ],
    donts: [
      "Do not rest the bare motherboard on conductive metallic surfaces or carpet during tests.",
      "Avoid over-tightening motherboard mounting screws to prevent PCB hairline cracks.",
    ],
    sectionsTitle: "Parts on the front of the board",
    sections: [
      {
        title: "Processor and memory",
        items: [
          { name: "CPU socket (Socket AM4)", text: "Holds the Ryzen processor. Its pin grid is delicate; never touch them.", tip: "Never touch the socket pins, and check for bent pins with a flashlight before installing." },
          { name: "DIMM slots", text: "Hold the DDR4 memory sticks. Latches on each end lock the module in.", tip: "Open both latches first, then press both ends until they click." },
        ],
      },
      {
        title: "Expansion slots",
        items: [
          { name: "PCI Express x16 slots", text: "Hold graphics cards. PCIe 4.0 slot runs directly from the CPU for maximum bandwidth.", tip: "Remove the matching rear slot cover first, and press the card straight down until the latch clicks." },
          { name: "PCI Express x1 slots", text: "Hold smaller add-in cards such as sound, network, or capture cards." },
          { name: "M.2 NVMe slots", text: "High-speed storage slots located under integrated heatsinks for fast SSDs." },
        ],
      },
      {
        title: "Storage",
        items: [
          { name: "SATA ports", text: "Connect hard disks, SSDs, and optical drives with SATA data cables.", tip: "Connectors are L-shaped and only fit one way. Never force them." },
        ],
      },
      {
        title: "Power connectors",
        items: [
          { name: "24-pin ATX connector", text: "Main power from the power supply to the board.", tip: "Press evenly until the clip clicks. It only fits one way." },
          { name: "8-pin CPU power", text: "Extra power connector near the CPU socket for the processor.", tip: "Required for the PC to start. Do not use the graphics card (PCIe) cable here." },
        ],
      },
      {
        title: "Headers (small pin groups on the board)",
        items: [
          { name: "Front panel header", text: "Power switch, reset switch, power LED, and drive activity LED wires from the case connect here. See the manual for the pinout.", tip: "LED wires have polarity (+ and -), switch wires do not. Flip an LED plug if it does not light." },
          { name: "USB headers", text: "Connect the case's front USB ports to the motherboard.", tip: "Never force a keyed connector into the wrong header orientation." },
          { name: "Front audio header", text: "Connects the case's front headphone and microphone jacks.", tip: "Keyed 9-pin header. Match the missing pin and push straight on." },
          { name: "Fan headers", text: "Power and control for the CPU fan and case fans.", tip: "Plug the CPU cooler into the CPU fan header." },
        ],
      },
      {
        title: "Cooling and power delivery",
        items: [
          { name: "VRM heatsinks", text: "Cool the power circuits around the CPU socket that supply steady voltage to the processor.", tip: "Route cables away from them so airflow is not blocked." },
          { name: "Chipset heatsink", text: "Cools the B550 chipset, which handles secondary system lanes." },
        ],
      },
      {
        title: "Other parts",
        items: [
          { name: "CMOS battery", text: "Small coin battery that keeps the clock and BIOS settings.", tip: "Do not pry it out with a metal tool. If the clock keeps resetting, replace the coin battery." },
          { name: "BIOS Flashback button", text: "Allows updating the BIOS using a USB drive without a CPU installed." },
        ],
      },
    ],
  },
  motherboard_rear: {
    name: BOARD_LABEL + ": Rear I/O Panel",
    purpose: "The back panel of the board, where external devices plug in from outside the case.",
    specs: "Display output (HDMI, DisplayPort), network (2.5Gb Ethernet), USB 3.2 Gen 2 Type-A/Type-C, BIOS Flashback button, and audio ports with Optical S/PDIF.",
    tips: [
      "Ensure the pre-mounted I/O shield aligns properly with the chassis cutout when mounting.",
      "Line the board's ports up with the shield openings before tightening any screws.",
      "Plug cables in gently and straight. If a plug does not go in, check its orientation instead of forcing it.",
    ],
    dos: [
      "Verify the integrated I/O shield is correctly positioned against the back chassis cutout.",
      "Check plug orientation before inserting any cable.",
    ],
    donts: [
      "Do not force a plug in upside down.",
      "Do not plug a monitor into these ports when using a dedicated graphics card; use the card's ports.",
    ],
    sectionsTitle: "Ports on the rear panel",
    sections: [
      {
        title: "USB and Controls",
        items: [
          { name: "USB 3.2 Gen 2 / Gen 1 ports", text: "High-speed ports for external drives, keyboards, and mice." },
          { name: "USB Type-C port", text: "Reversible high-speed data connection port." },
          { name: "BIOS Flashback button", text: "Special button to flash system BIOS from a designated USB slot." },
        ],
      },
      {
        title: "Video",
        items: [
          { name: "HDMI / DisplayPort", text: "Monitor outputs driven by processors featuring integrated graphics (APUs).", tip: "With a dedicated graphics card installed, use the card's ports instead." },
        ],
      },
      {
        title: "Network",
        items: [
          { name: "2.5G LAN port (RJ-45)", text: "High-speed wired network connection." },
        ],
      },
      {
        title: "Audio",
        items: [
          { name: "3.5 mm audio jacks", text: "Gold-plated audio jacks for speakers, line-in, and microphones." },
          { name: "Optical S/PDIF out", text: "Digital audio output for external sound systems." },
        ],
      },
    ],
  },
  ram: {
    name: "DDR4 Memory Module (DIMM) with Heatsink",
    purpose: "Provides high-speed volatile working memory for active tasks and the operating system.",
    specs: "Unbuffered non-ECC DDR4 desktop module with a metal heat spreader, gold edge connectors, and a center notch key. Install in matching pairs for dual-channel operation.",
    tips: [
      "Touch the bare metal of the case first to discharge static, and hold the module by its edges.",
      "Open the latches at both ends of the slot before inserting.",
      "Line up the notch on the module with the key in the slot. It only fits one way.",
      "Press down firmly with your thumbs at both ends, not in the middle, until both latches snap shut.",
      "Check the manual for which slots to use. Matching pairs go in alternating slots for dual-channel optimization.",
      "If it will not seat, take it out and recheck the notch. Never rock it in at an angle.",
    ],
    dos: [
      "Push down firmly and evenly on both ends until the plastic side latches snap inward.",
      "Match the memory slot notch orientation properly with the board's slot keyway.",
    ],
    donts: [
      "Do not force the RAM module backward or at a slanted angle into the slot.",
      "Avoid touching the exposed gold contact pins with bare fingers to prevent oil residue.",
    ],
  },
  psu: {
    name: "Power Supply Unit (PSU) - Modular & Form Factors",
    purpose: "Converts AC wall power into regulated DC low-voltage power for internal PC components.",
    specs: "Standard ATX form factor, available in Non-Modular, Semi-Modular, and Full-Modular wiring designs, offering efficiency ratings (80 Plus Bronze/Gold/Platinum).",
    connectsTo: "Connects to AC wall outlet, Motherboard (24-pin ATX, 8-pin CPU), Graphics Card (PCIe), and Storage Drives (SATA).",
    tips: [
      "Ensure the PSU wattage rating comfortably exceeds your system component power requirements.",
      "Modular designs allow you to attach only the cables you need, improving airflow and case cable management.",
      "Always flip the physical power switch off and unplug the unit before servicing internal hardware.",
    ],
    dos: [
      "Match the PSU physical form factor (e.g., standard ATX vs. SFX) to your chassis specifications.",
      "Use dedicated PCIe cables from the PSU for graphics cards rather than daisy-chained splits when pulling high wattage.",
    ],
    donts: [
      "Do not mix modular cables from different PSU brands or series, as internal pin layouts can vary and short-circuit components.",
      "Never open the PSU casing yourself, as hazardous high-voltage capacitors retain a lethal charge even when unplugged.",
    ],
  },
  // ✅ New GPU reference entry
  gpu: {
    name: "ASUS Dual GeForce RTX 3060 Ti / 3060 (PCIe x16 Graphics Card)",
    purpose: "Dedicated graphics processor that renders images, video, and 3D graphics independently of the CPU, offloading the heaviest visual workloads for gaming and content creation.",
    specs: "PCI Express 4.0 x16 interface, dual-fan open-air cooling shroud, GDDR6 video memory, rear I/O bracket with DisplayPort and HDMI outputs, supplementary PCIe power connector(s) on the card's top edge.",
    connectsTo: "The motherboard's primary PCIe x16 slot (nearest the CPU), and one or more PCIe power cables directly from the power supply.",
    tips: [
      "Ground yourself first and handle the card by its metal bracket and edges, not the fan shroud or heatsink fins.",
      "Remove the matching rear slot covers on the case before inserting the card so the I/O bracket has somewhere to sit.",
      "Open the PCIe slot's retention latch, then press the card straight down evenly until it clicks and sits flush.",
      "Screw the card's rear bracket to the case afterward so it doesn't sag or twist over time.",
      "Connect the PCIe power cable(s) directly from the PSU. Never use a SATA-to-PCIe adapter for a card that needs meaningful wattage.",
      "Support the card while inserting it — a long, heavy card can flex or crack the slot if only pushed from one end.",
    ],
    dos: [
      "Remove the correct rear slot covers before installing the card.",
      "Press evenly along the card's length until the PCIe slot latch clicks shut.",
      "Screw the bracket into the case and connect all required PCIe power cables.",
    ],
    donts: [
      "Do not install or remove the card while the system is powered on.",
      "Do not lift or carry the card by the fan shroud; support it from the bracket and PCB edge.",
      "Do not force the card in at an angle — a bent PCIe slot can damage the motherboard.",
    ],
  },

  // ---- Motherboard sub-parts (opened by the clickable markers) ----
  io_usb: {
    name: "Rear USB Ports",
    purpose: "Connect keyboards, mice, flash drives, and other external peripherals.",
    specs: "High-speed USB 3.2 Gen 2 and Gen 1 ports offering fast data transfer rates.",
    connectsTo: "Peripherals plug in from outside the case. Internally the ports run through the rear I/O assembly.",
    tips: [
      "Check the plug orientation before pushing. USB plugs only fit one way.",
      "Use blue or red ports for fast external storage devices.",
    ],
    dos: [
      "Use high-speed USB ports for external drives that need faster transfer speeds.",
      "Check the plug orientation before inserting.",
    ],
    donts: [
      "Do not force a USB plug in upside down.",
      "Do not pull a storage device out while it is still copying files.",
    ],
  },
  io_video: {
    name: "Video Output Ports (HDMI / DisplayPort)",
    purpose: "Send display signals from an integrated graphics processor (APU) to a monitor.",
    specs: "Supports high-resolution digital video and audio streaming.",
    connectsTo: "Monitor, using an HDMI or DisplayPort cable. Use these ports only when running on integrated graphics; if a dedicated graphics card is installed, plug the monitor into the card instead.",
    tips: [
      "With a graphics card installed, plug the monitor into the card, not the motherboard.",
      "Power off before changing display cables, and push the plug in straight.",
    ],
    dos: [
      "Match the cable type to a port on the monitor.",
      "Power off the system before changing display cables.",
    ],
    donts: [
      "Do not plug the monitor into the motherboard when a dedicated graphics card is installed and in use.",
      "Do not bend the cable sharply at the connector.",
    ],
  },
  io_lan: {
    name: "2.5G LAN Port (RJ-45 Ethernet)",
    purpose: "High-speed wired network and internet connection.",
    specs: "Standard RJ-45 jack supporting up to 2.5 Gbps bandwidth transfers.",
    connectsTo: "Router, switch, or wall network port using a Cat5e or Cat6 cable.",
    tips: [
      "Push the cable in until it clicks. Pinch the clip to release it instead of pulling the cable.",
    ],
    dos: [
      "Push the cable in until the clip clicks.",
      "Check the link LED after connecting.",
    ],
    donts: [
      "Do not pull on the cable itself to unplug it; press the clip first.",
      "Do not use a cable with a cracked latch.",
    ],
  },
  io_audio: {
    name: "Audio Jacks & Optical S/PDIF",
    purpose: "Connect speakers, headphones, and microphones to high-definition onboard audio codecs.",
    specs: "Multi-channel gold-plated analog jacks and optical digital output.",
    connectsTo: "Speakers, headset, or microphone plugged in from outside the case.",
    tips: [
      "Match the plug to the jack color. If the sound does not work, check the audio settings before assuming a fault.",
    ],
    dos: [
      "Match the plug to the jack color.",
      "Check the sound settings in the operating system after connecting.",
    ],
    donts: [
      "Do not plug speakers into the microphone jack.",
      "Do not force the plug in at an angle.",
    ],
  },
  pcie: {
    name: "PCI Express Slots",
    purpose: "Hold expansion cards such as a graphics card, sound card, or network card.",
    specs: "PCIe 4.0 x16 slot reinforced with steel armor nearest the CPU for primary graphics cards.",
    connectsTo: "Expansion cards seated directly in the slot. High-power graphics cards also need a PCIe power cable from the power supply.",
    tips: [
      "Remove the matching slot cover from the back of the case before installing a card.",
      "Open the slot latch, press the card straight down evenly until the latch clicks, then secure the bracket with a screw.",
      "Plug the card's power cable (if it has one) before closing the case. Use only PCIe power cables.",
    ],
    dos: [
      "Remove the matching slot cover at the back of the case first.",
      "Secure the card bracket with a screw after seating it.",
    ],
    donts: [
      "Do not push a card in without releasing the slot latch if the slot has one.",
      "Do not install or remove a card while the system is powered.",
    ],
  },
  sata: {
    name: "SATA Ports",
    purpose: "Connect storage drives such as hard disks and 2.5-inch SSDs.",
    specs: "SATA 6 Gb/s ports supporting high-speed data transfer rates.",
    connectsTo: "The drive, using a SATA data cable. The drive also needs a separate SATA power cable from the power supply.",
    tips: [
      "SATA connectors are L-shaped. If it does not fit, flip it. Never force it.",
      "Do not pull on the cable itself when unplugging; hold the connector.",
      "The drive also needs its own SATA power cable from the power supply.",
    ],
    dos: [
      "Use L-shaped connectors, which only fit one way.",
      "Plug the boot drive into the lowest-numbered SATA port.",
    ],
    donts: [
      "Do not bend the data cable tightly.",
      "Do not forget the separate power cable to the drive.",
    ],
  },
  atx_power: {
    name: "24-pin ATX Power Connector",
    purpose: "Main power input that feeds the motherboard from the power supply.",
    specs: "24-pin connector with a locking clip. A separate 8-pin connector near the CPU supplies power to the processor.",
    connectsTo: "The 24-pin cable from the power supply unit (PSU).",
    tips: [
      "Line the connector up with the clip on the correct side and press down evenly until the clip clicks.",
      "Also plug in the 8-pin CPU power cable near the CPU socket. The PC will not start without it.",
      "Connect or remove power cables only with the power supply switched off and unplugged.",
    ],
    dos: [
      "Line up the clip side and press down evenly on the whole connector until the clip locks.",
      "Also connect the 8-pin CPU power cable.",
    ],
    donts: [
      "Do not connect or disconnect the cable while the PSU is on or plugged into the wall.",
      "Do not force the connector; it only fits one way.",
    ],
  },
  front_panel: {
    name: "Front Panel Header",
    purpose: "Connects the case's power button, reset button, and LED indicators to the motherboard.",
    specs: "Rows of small pins labeled PWR_SW, RESET_SW, HDD_LED, and PWR_LED.",
    connectsTo: "The small labeled wires coming from the front of the case.",
    tips: [
      "Use the pinout printed in the manual. Do not guess pin positions.",
      "Power and reset switch wires have no polarity, but LED wires do. If an LED does not light, flip its plug.",
      "Push each plug on straight so pins do not bend.",
    ],
    dos: [
      "Follow the pinout diagram in the motherboard manual.",
      "Connect the LED wires with the positive (+) lead on the marked pin.",
    ],
    donts: [
      "Do not guess the pin positions.",
      "Do not bend the pins while pushing on the connectors.",
    ],
  },
};

const MOTHERBOARD_POSITION = [-0.3, 0.53, -0.3];
const MOTHERBOARD_ROTATION = [0, Math.PI, 0];
const MOTHERBOARD_SCALE = [0.9999999, 1.12, 1.25];

const RAM_SLOT_1_ABS = [0.0361, 1.132, -0.291];
const RAM_SLOT_2_ABS = [0.1191, 1.132, -0.291];
const CPU_SOCKET_ABS = [-0.237, 1.456, -0.37];
const RAM_SCALE = [0.85, 0.959, 0.85];

const PSU_POSITION = [-0.625, 0.48, 0.00005];
const PSU_ROTATION = [Math.PI, (3 * Math.PI) / 2, 0];
const PSU_SCALE = [1, 1, 1];

// ✅ GPU — placed directly in world space (like the PSU) rather than as a
// motherboard child, since a card this size is easier to align against
// the case's rear slot covers than against the board's local offsets.
// Position/rotation and spin values match the tuned settings from
// Assemble.jsx (GPU_TARGET / GPU_SPIN_X/Y/Z) so the card sits the same
// way in both the inspection rig and the assembly lab.
const GPU_POSITION = [-0.326, 1.0379, -0.449];
const GPU_ROTATION = [0, Math.PI, 0];
const GPU_SCALE = [1, 1, 1];
const GPU_SPIN_X = -Math.PI / 2; // lay flat, flipped (top/bottom swapped vs. +Math.PI/2)
const GPU_SPIN_Y = Math.PI / 2;
const GPU_SPIN_Z = 0;

const RIG_Y_OFFSET = 2.0;
const CALIBRATE = false;
const REAR_MESH_HINT = /(i\/?o[\s_-]?shield|back[\s_-]?(panel|plate)|rear)/i;

const HOTSPOTS = [
  { id: "motherboard_rear", position: [0.5, 1.0, 0.0], size: [0.2, 0.5, 0.1], calibrated: false },
  { id: "io_usb", position: [0.35, 1.05, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_video", position: [0.35, 0.9, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_lan", position: [0.35, 0.75, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_audio", position: [0.35, 0.6, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "pcie", position: [0.0, 0.3, 0.05], size: [0.2, 0.05, 0.05], calibrated: false },
  { id: "sata", position: [-0.4, 0.3, 0.05], size: [0.1, 0.05, 0.05], calibrated: false },
  { id: "atx_power", position: [-0.45, 0.6, 0.05], size: [0.05, 0.12, 0.05], calibrated: false },
  { id: "front_panel", position: [-0.3, 0.2, 0.05], size: [0.1, 0.04, 0.05], calibrated: false },
];

function Hotspot({ position, size, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={position}
      onClick={(e) => {
        if (CALIBRATE && e.nativeEvent.shiftKey) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={CALIBRATE ? "#ff3b8d" : "#ffffff"}
        transparent
        opacity={CALIBRATE ? 0.35 : hovered ? 0.14 : 0}
        depthWrite={false}
      />
    </mesh>
  );
}

function offsetFrom(abs, base) {
  return [abs[0] - base[0], abs[1] - base[1], abs[2] - base[2]];
}

const RAM_1_OFFSET = offsetFrom(RAM_SLOT_1_ABS, MOTHERBOARD_POSITION);
const RAM_2_OFFSET = offsetFrom(RAM_SLOT_2_ABS, MOTHERBOARD_POSITION);
const CPU_OFFSET = offsetFrom(CPU_SOCKET_ABS, MOTHERBOARD_POSITION);

/* Simple in-canvas loading indicator shown by Suspense while the
   GLTF models are still downloading. Keeps mobile users (slower
   connections) from staring at an empty gradient with no feedback. */
function RigLoadingFallback() {
  const ref = useRef();
  return (
    <group position={[0, RIG_Y_OFFSET, 0]}>
      <mesh ref={ref}>
        <torusGeometry args={[0.4, 0.05, 16, 48]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function DesktopRig({ onOpenModal, onCalibrate }) {
  const mbRef = useRef();
  const cornerA = useRef(null);
  return (
    <group position={[0, RIG_Y_OFFSET, 0]}>
      <pointLight position={[0, 1.2, 1.4]} intensity={25} decay={2} />
      <pointLight position={[0, 1.2, -1.4]} intensity={20} decay={2} />
      <pointLight position={[0, 2.2, 0]} intensity={15} decay={2} />
      <Center>
        <CaseModel position={[0, 0, 0]} />

        {/* PSU Model integration */}
        <group
          position={PSU_POSITION}
          rotation={PSU_ROTATION}
          scale={PSU_SCALE}
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal("psu");
          }}
        >
          <PSUModel />
        </group>

        {/* ✅ GPU Model integration — same pattern as PSU: world-space,
            clickable to open its reference panel. */}
        <group
          position={GPU_POSITION}
          rotation={GPU_ROTATION}
          scale={GPU_SCALE}
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal("gpu");
          }}
        >
          <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
        </group>

        <group
          ref={mbRef}
          position={MOTHERBOARD_POSITION}
          rotation={MOTHERBOARD_ROTATION}
          scale={MOTHERBOARD_SCALE}
          onClick={(e) => {
            e.stopPropagation();
            const meshName = `${e.object?.name || ""} ${e.object?.parent?.name || ""}`.trim();
            if (CALIBRATE && e.nativeEvent.shiftKey && mbRef.current) {
              const p = mbRef.current.worldToLocal(e.point.clone());
              if (!cornerA.current) {
                cornerA.current = p;
                onCalibrate(`Corner 1 saved (mesh: ${meshName || "unnamed"}). Now Shift+click the opposite corner.`);
              } else {
                const a = cornerA.current;
                const r = (n) => Number(n.toFixed(3));
                const position = [(a.x + p.x) / 2, (a.y + p.y) / 2, (a.z + p.z) / 2].map(r);
                const size = [Math.abs(a.x - p.x), Math.abs(a.y - p.y), Math.abs(a.z - p.z)].map((n) => r(Math.max(n, 0.05)));
                const line = `position: [${position.join(", ")}], size: [${size.join(", ")}]`;
                onCalibrate(line);
                cornerA.current = null;
              }
              return;
            }
            onOpenModal(REAR_MESH_HINT.test(meshName) ? "motherboard_rear" : "motherboard");
          }}
        >
          <MotherboardModel />

          {HOTSPOTS.filter((h) => CALIBRATE || h.calibrated).map((h) => (
            <Hotspot key={h.id} position={h.position} size={h.size} onSelect={() => onOpenModal(h.id)} />
          ))}

          <group
            position={[-CPU_OFFSET[0], CPU_OFFSET[1], -CPU_OFFSET[2]]}
            rotation={[Math.PI / 2, 0, Math.PI]}
            onClick={(e) => { e.stopPropagation(); onOpenModal("cpu"); }}
          >
            <CPUModel />
          </group>

          <group
            position={[-RAM_1_OFFSET[0], RAM_1_OFFSET[1], -RAM_1_OFFSET[2]]}
            scale={RAM_SCALE}
            onClick={(e) => { e.stopPropagation(); onOpenModal("ram"); }}
          >
            <RAMModel accentColor="#4fd8c9" />
          </group>

          <group
            position={[-RAM_2_OFFSET[0], RAM_2_OFFSET[1], -RAM_2_OFFSET[2]]}
            scale={RAM_SCALE}
            onClick={(e) => { e.stopPropagation(); onOpenModal("ram"); }}
          >
            <RAMModel accentColor="#e8a33d" />
          </group>
        </group>
      </Center>
    </group>
  );
}

export default function MainPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [modalPart, setModalPart] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calibPoint, setCalibPoint] = useState(null);
  const referencePanelRef = useRef(null);

  const modalInfo = modalPart ? PARTS_DATA[modalPart] : null;
  const closeSidebar = () => setSidebarOpen(false);

  // On phones the reference panel opens as a bottom sheet. Scroll it
  // into view when it appears so it doesn't feel like it's just cutting
  // off the 3D viewport mid-scroll.
  useEffect(() => {
    if (modalInfo && referencePanelRef.current && window.innerWidth <= 860) {
      referencePanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [modalInfo]);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Dims the page behind the mobile bottom sheet so it reads as a
          modal instead of an element awkwardly overlapping the canvas. */}
      {modalInfo && (
        <div
          className="reference-backdrop"
          onClick={() => setModalPart(null)}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? "app-sidebar--open" : ""}`}>
        <div className="sidebar__top-section">
          <div className="sidebar__brand">
            <div className="sidebar__logo-wrapper">
              <svg className="wordmark-logo" viewBox="0 0 100 100" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="6">
                <path d="M25 15 H15 V25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M75 15 H85 V25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M25 85 H15 V75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M75 85 H85 V75" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="30" y="30" width="40" height="40" rx="8" fill="currentColor" fillOpacity="0.15" />
                <line x1="30" y1="42" x2="20" y2="42" />
                <line x1="30" y1="58" x2="20" y2="58" />
                <line x1="70" y1="42" x2="80" y2="42" />
                <line x1="70" y1="58" x2="80" y2="58" />
                <line x1="42" y1="30" x2="42" y2="20" />
                <line x1="58" y1="30" x2="58" y2="20" />
                <line x1="42" y1="70" x2="42" y2="80" />
                <line x1="58" y1="70" x2="58" y2="80" />
              </svg>
            </div>
            <span className="sidebar__brand-name">ARBuild</span>
            <button type="button" className="sidebar__close-btn" onClick={closeSidebar} aria-label="Close menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <nav className="sidebar__nav">
            <p className="sidebar__nav-title">Workspaces</p>
            <Link to="/main" className="sidebar__link active" onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              <span>Rig Studio</span>
            </Link>
            <Link to="/assemble" className="sidebar__link" onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              <span>Assembly Lab</span>
            </Link>
            <Link to="/disassemble" className="sidebar__link" onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /></svg>
              <span>Disassemble Lab</span>
            </Link>
            <Link to="/profile" className="sidebar__link" onClick={closeSidebar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              <span>Profile</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar__footer">
          <div className="sidebar__footer-row">
            <span className="sidebar__footer-label">Appearance</span>
            <ThemeToggle />
          </div>
          <div className="sidebar__footer-divider" />
          <span className="sidebar__term">CSS NC II Professional Suite</span>
        </div>
      </aside>

      <main className="app-main">
        <header className="main__header">
          <button type="button" className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu" aria-expanded={sidebarOpen}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="main__title-group">
            <span className="main__badge-pill">Interactive 3D Environment</span>
            <h1 className="main__greeting">Workstation Explorer</h1>
            <p className="main__section">Examine institutional hardware components in real-time stereoscopic layout.</p>
          </div>
        </header>

        <div className="lab-instruction-card">
          <div className="lab-instruction-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="lab-instruction-text">
            <span><strong>Inspection Mode:</strong> Click directly on any 3D workstation component in the viewport to open official handling guidelines and architectural specifications.</span>
          </div>
        </div>

        <section className="immersive-learn-section">
          <div className="main__section-header">
            <h2 className="main__section-label">Live Viewport Canvas</h2>
            <span className="main__section-count">Orbit &amp; Zoom Enabled</span>
          </div>

          <div className="lab-split">
            <div className="viewport-3d buildcores-viewport">
              <Canvas shadows camera={{ position: [3, 2, 3.5], fov: 50 }}>
                <ambientLight intensity={2.0} />
                <hemisphereLight skyColor="#ffffff" groundColor="#666666" intensity={1.2} />
                <directionalLight position={[6, 8, 6]} intensity={2.4} />
                <directionalLight position={[-6, 4, -4]} intensity={1.6} />
                <directionalLight position={[0, 3, 8]} intensity={1.6} />
                <Environment resolution={256}>
                  <Lightformer form="rect" intensity={4} position={[0, 5, 5]} scale={[10, 6, 1]} />
                  <Lightformer form="rect" intensity={3} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 5, 1]} />
                  <Lightformer form="rect" intensity={3} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 5, 1]} />
                  <Lightformer form="rect" intensity={2} position={[0, 2, -5]} rotation-y={Math.PI} scale={[10, 5, 1]} />
                </Environment>
                {/* Suspense is required here: the model components use
                    useGLTF, which suspends while the .glb files download.
                    Without this boundary, slower connections (mobile data)
                    leave the canvas empty with no fallback and no error. */}
                <Suspense fallback={<RigLoadingFallback />}>
                  <DesktopRig onOpenModal={setModalPart} onCalibrate={setCalibPoint} />
                </Suspense>
                <OrbitControls
                  enablePan
                  enableZoom
                  enableRotate
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={0.6}
                  maxDistance={9}
                  autoRotate={false}
                />
              </Canvas>
              <div className="viewport-badge">
                <span className="live-dot" />
                <span>Interactive Rig Active</span>
              </div>
              {CALIBRATE && calibPoint && (
                <div style={{ position: "absolute", top: 12, left: 12, zIndex: 5, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 10px", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }}>
                  {calibPoint}
                </div>
              )}
            </div>

            {modalInfo && (
              <aside className="reference-panel" ref={referencePanelRef} aria-label="Component reference">
                <div className="modal-header">
                  <div className="modal-badge-tag">CSS NC II Standard Reference</div>
                  <button className="modal-close-btn" onClick={() => setModalPart(null)} aria-label="Close">×</button>
                </div>

                <h2 className="modal-title">{modalInfo.name}</h2>
                <p className="modal-desc">{modalInfo.purpose}</p>

                <div className="modal-section-box">
                  <span className="info-label">Technical Specifications</span>
                  <p className="info-text">{modalInfo.specs}</p>
                </div>

                {modalInfo.connectsTo && (
                  <div className="modal-section-box">
                    <span className="info-label">Connects To</span>
                    <p className="info-text">{modalInfo.connectsTo}</p>
                  </div>
                )}

                {modalInfo.sections && (
                  <div className="modal-section-box">
                    <span className="info-label">{modalInfo.sectionsTitle || "Parts on this board"}</span>
                    <div className="parts-groups">
                      {modalInfo.sections.map((section) => (
                        <div key={section.title} className="parts-group">
                          <h5 className="parts-group-title">{section.title}</h5>
                          <ul className="parts-list">
                            {section.items.map((item) => (
                              <li key={item.name}>
                                <strong>{item.name}</strong>
                                <span>{item.text}</span>
                                {item.tip && <span className="parts-tip">Tip: {item.tip}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {modalInfo.tips && (
                  <div className="modal-section-box tips-box">
                    <span className="info-label">Assembly tips</span>
                    <ul className="tips-list">
                      {modalInfo.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="modal-grid-rules">
                  <div className="rule-card dos">
                    <h4 className="rule-title">Standard Protocols (Dos)</h4>
                    <ul>
                      {modalInfo.dos.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rule-card donts">
                    <h4 className="rule-title">Safety Precautions (Don'ts)</h4>
                    <ul>
                      {modalInfo.donts.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="gate-btn primary" onClick={() => setModalPart(null)}>
                    Close reference
                  </button>
                </div>
              </aside>
            )}
          </div>
        </section>

        <section className="progression-gate-card">
          <div className="gate-content">
            <h3>Ready for Hands-On Practice?</h3>
            <p>Proceed to simulated assembly or structural troubleshooting modules.</p>
          </div>
          <div className="gate-actions">
            <button className="gate-btn primary" onClick={() => navigate("/assemble")}>
              Launch Assembly Lab
            </button>
            <button className="gate-btn secondary" onClick={() => navigate("/disassemble")}>
              Launch Disassemble Lab
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}