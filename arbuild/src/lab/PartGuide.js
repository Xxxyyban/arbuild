// The Rig Studio's guide (pages/Main.jsx): what each part of the PC is and does, the motherboard's
// slots, headers and ports, and what each pin of a header or power plug is for.
// Pure data and helpers only: no React, no three.js.
//
// A text is a string, or { am4, am5, lga1700 } when the builds differ. A pinout is rows of pins, top row
// first, each pin [label, kind] or null where a pin is missing (the key that makes a plug fit one way).
import { CATALOG, correctPicks, requiredWatts, PLATFORM_LABEL } from "./Catalog";

/** A text for this platform. */
export const forPlatform = (text, platform) => (text && typeof text === "object" ? text[platform] ?? Object.values(text)[0] : text) || "";

/** A text's sentences: the first says what it is, the rest are its details. */
export const sentences = (text) => text.replace(/([.!?])\s+(?=[A-Z0-9"“])/g, "$1\n").split("\n");

/** A title without what's in its brackets: "USB 3.0 header (19-pin)" -> "USB 3.0 header". */
export const shortTitle = (title) => title.replace(/\s*\(.*\)$/, "");

// what each kind of pin carries: the colours match the wires (yellow 12 V, red 5 V, orange 3.3 V...)
export const PIN_KINDS = {
  "12v": { label: "+12 V", color: "#facc15" },
  "5v": { label: "+5 V", color: "#ef4444" },
  "3v3": { label: "+3.3 V", color: "#f97316" },
  neg: { label: "−12 V", color: "#3b82f6" },
  sb: { label: "+5 V standby", color: "#a855f7" },
  gnd: { label: "Ground", color: "#1f2937" },
  sig: { label: "Signal", color: "#22c55e" },
  ok: { label: "Power good", color: "#9ca3af" },
  data: { label: "Data", color: "#38bdf8" },
  pwm: { label: "Speed control", color: "#2563eb" },
  led: { label: "LED", color: "#f59e0b" },
  sw: { label: "Switch", color: "#8b5cf6" },
  audio: { label: "Audio", color: "#14b8a6" },
  nc: { label: "Not used", color: "transparent" },
};

const PINOUTS = {
  atx24: [
    [["+3.3V", "3v3"], ["−12V", "neg"], ["GND", "gnd"], ["PS_ON", "sig"], ["GND", "gnd"], ["GND", "gnd"], ["GND", "gnd"], ["NC", "nc"], ["+5V", "5v"], ["+5V", "5v"], ["+5V", "5v"], ["GND", "gnd"]],
    [["+3.3V", "3v3"], ["+3.3V", "3v3"], ["GND", "gnd"], ["+5V", "5v"], ["GND", "gnd"], ["+5V", "5v"], ["GND", "gnd"], ["PWR_OK", "ok"], ["+5VSB", "sb"], ["+12V", "12v"], ["+12V", "12v"], ["+3.3V", "3v3"]],
  ],
  eps8: [
    [["+12V", "12v"], ["+12V", "12v"], ["+12V", "12v"], ["+12V", "12v"]],
    [["GND", "gnd"], ["GND", "gnd"], ["GND", "gnd"], ["GND", "gnd"]],
  ],
  pcie8: [
    [["+12V", "12v"], ["+12V", "12v"], ["+12V", "12v"], ["SENSE", "sig"]],
    [["GND", "gnd"], ["SENSE", "sig"], ["GND", "gnd"], ["GND", "gnd"]],
  ],
  pcie6: [
    [["+12V", "12v"], ["+12V", "12v"], ["+12V", "12v"]],
    [["GND", "gnd"], ["SENSE", "sig"], ["GND", "gnd"]],
  ],
  panel: [
    [["PLED+", "led"], ["PLED−", "led"], ["PWR", "sw"], ["PWR", "sw"], null],
    [["HDD+", "led"], ["HDD−", "led"], ["RST", "sw"], ["RST", "sw"], ["NC", "nc"]],
  ],
  usb3: [
    [null, ["5V", "5v"], ["RX−", "data"], ["RX+", "data"], ["GND", "gnd"], ["TX−", "data"], ["TX+", "data"], ["GND", "gnd"], ["D−", "data"], ["D+", "data"]],
    [["5V", "5v"], ["RX−", "data"], ["RX+", "data"], ["GND", "gnd"], ["TX−", "data"], ["TX+", "data"], ["GND", "gnd"], ["D−", "data"], ["D+", "data"], ["ID", "sig"]],
  ],
  usb2: [
    [["5V", "5v"], ["D−", "data"], ["D+", "data"], ["GND", "gnd"], ["NC", "nc"]],
    [["5V", "5v"], ["D−", "data"], ["D+", "data"], ["GND", "gnd"], null],
  ],
  audio: [
    [["GND", "gnd"], ["DETECT", "sig"], ["MIC JD", "sig"], null, ["HP JD", "sig"]],
    [["MIC L", "audio"], ["MIC R", "audio"], ["HP R", "audio"], ["SENSE", "sig"], ["HP L", "audio"]],
  ],
  fan4: [[["GND", "gnd"], ["+12V", "12v"], ["TACH", "sig"], ["PWM", "pwm"]]],
  argb: [[["+5V", "5v"], ["DATA", "data"], null, ["GND", "gnd"]]],
  rgb: [[["+12V", "12v"], ["G", "data"], ["R", "data"], ["B", "data"]]],
};

// what each colour means (the pop-up on the legend): the wire colour a real cable uses for it
export const KIND_INFO = {
  "12v": "Yellow wire on a real PSU cable. +12 volts: the main power, for the CPU, the graphics card and the fans.",
  "5v": "Red wire. +5 volts: USB devices, drives and the fan lights.",
  "3v3": "Orange wire. +3.3 volts: the memory and small chips on the board.",
  neg: "Blue wire. −12 volts: left over from old serial ports. Today's boards barely use it.",
  sb: "Purple wire. +5 V standby: on whenever the PSU is switched on, even with the PC off. It powers the power button, wake-up and USB charging.",
  gnd: "Black wire. Ground: the way back for the current. Every voltage is measured against it, so a plug always has several.",
  sig: "A signal: it tells a part something (start, plugged in, which plug) and carries almost no power.",
  ok: "Gray wire. Power good: the PSU's sign that its voltages are steady and the PC may start.",
  data: "Data: it carries information, not power (USB data, the lights' colours).",
  pwm: "Blue wire on a fan cable. Speed control: the board tells the fan how fast to spin.",
  led: "Lights a small LED on the case. The coloured wire is +, the white one is −.",
  sw: "A button on the case: pressing it joins the two pins for a moment.",
  audio: "Sound: the headphone and microphone channels, left and right.",
};

// what each pin does (the pop-up on a pin): "plug:LABEL" for a pin that means something else on
// that plug, then "LABEL" for the rest
const PIN_INFO = {
  "+12V": "+12 V power: the yellow wires. It feeds the parts that use the most power.",
  "eps8:+12V": "+12 V for the CPU. The voltage regulators around the socket turn it into the about 1.2 V the CPU runs on.",
  "pcie8:+12V": "+12 V for the graphics card, on top of the 75 W the slot gives.",
  "pcie6:+12V": "+12 V for the graphics card, on top of the 75 W the slot gives.",
  "fan4:+12V": "+12 V that turns the fan's motor.",
  "rgb:+12V": "+12 V shared by every LED on the strip.",
  "+5V": "+5 V power: the red wires. USB ports, drives and some lights run on it.",
  "argb:+5V": "+5 V for the LEDs. The arrow on the plug goes on this pin.",
  "5V": "+5 V for the device plugged into the front USB port.",
  "+3.3V": "+3.3 V power: the orange wires. The memory and small chips use it.",
  "−12V": "−12 V: the blue wire. Old serial ports needed it; today's boards barely use it.",
  GND: "Ground: the black wires, the way back for the current. Without enough grounds a plug can't carry its power.",
  PS_ON: "Power on: the green wire. Pressing the case's power button makes the board join it to ground, and the PSU switches its main power on.",
  PWR_OK: "Power good: the gray wire. The PSU raises it once its voltages are steady. Until then the board holds the CPU back.",
  "+5VSB": "+5 V standby: the purple wire. On whenever the PSU is switched on, even with the PC off, so the power button and wake-up still work.",
  NC: "Not connected: nothing uses this spot.",
  "pcie8:SENSE": "Sense: it tells the graphics card which plug is in (6 or 8 pins), so it knows it may draw up to 150 W from it.",
  "pcie6:SENSE": "Sense: it tells the graphics card a 6-pin plug is in, so it may draw up to 75 W from it.",
  "audio:SENSE": "Jack sense: with the detect pins it tells the board something is plugged into a front jack.",
  "PLED+": "Power LED +: the coloured wire. The case's power light is on while the PC runs. An LED only lights one way round.",
  "PLED−": "Power LED −: the white wire, the LED's return.",
  "HDD+": "Drive LED +: the coloured wire. The case's drive light blinks while the SSD reads or writes.",
  "HDD−": "Drive LED −: the white wire, the LED's return.",
  PWR: "Power switch: the case's power button joins these two pins for a moment to start the PC (held 4 seconds, it forces it off). Either way round.",
  RST: "Reset switch: the case's reset button joins these two pins to restart the PC at once. Either way round.",
  "RX−": "USB 3.0 receive, −: data coming in from the device, on a pair of wires twisted together so noise cancels out.",
  "RX+": "USB 3.0 receive, +: the other wire of the receive pair.",
  "TX−": "USB 3.0 transmit, −: data going out to the device, on a twisted pair.",
  "TX+": "USB 3.0 transmit, +: the other wire of the transmit pair.",
  "D−": "USB 2.0 data, −: the slower, older USB data, kept so USB 2.0 devices still work.",
  "D+": "USB 2.0 data, +: the other wire of the USB 2.0 pair.",
  ID: "USB ID: tells whether the port is a host or a device. A front panel doesn't use it.",
  DETECT: "Front panel detect: tells the board an HD Audio front panel is connected.",
  "MIC JD": "Microphone jack detect: the board knows a microphone is plugged into the front and switches over to it.",
  "HP JD": "Headphone jack detect: the board knows headphones are plugged into the front and switches the sound to them.",
  "MIC L": "Microphone, left channel.",
  "MIC R": "Microphone, right channel.",
  "HP L": "Headphones, left channel.",
  "HP R": "Headphones, right channel.",
  TACH: "Tachometer: the green wire. The fan sends two pulses a turn, so the board reads its speed (RPM) and warns if it stops.",
  PWM: "Speed control: the blue wire. The board switches it on and off very fast; the longer it's on, the faster the fan spins.",
  DATA: "Data: the colour for each LED, passed from one LED to the next, so each can show its own colour.",
  G: "Green: the board switches this colour on and off to mix the strip's colour.",
  R: "Red: the board switches this colour on and off to mix the strip's colour.",
  B: "Blue: the board switches this colour on and off to mix the strip's colour.",
};

/** What a pin on this plug does. */
export const pinInfo = (plug, label) => PIN_INFO[`${plug}:${label}`] || PIN_INFO[label] || "";

// the cables and wires in the Rig Studio's PC (the pop-up when the mouse is on one): what it is,
// what its wires' colours mean, and what it does
export const CABLE_INFO = {
  atx24: { title: "24-pin ATX cable", colors: "Inside a real one: yellow +12 V, red +5 V, orange +3.3 V, purple standby, green power-on, gray power-good, black ground.", text: "Powers the motherboard, which passes the power on to the RAM, the SSD, the fans and the slots." },
  eps8: { title: "8-pin CPU cable (4+4)", colors: "Four yellow +12 V wires and four black grounds.", text: "Powers the CPU through the voltage regulators around the socket. Without it the fans spin but the PC never starts." },
  pcie: { title: "8-pin PCIe cable (6+2)", colors: "Yellow +12 V, black ground, and sense wires that tell the card which plug is in.", text: "Extra power for the graphics card: up to 150 W, on top of the 75 W from its slot." },
  pcie6: { title: "6-pin PCIe cable", colors: "Yellow +12 V, black ground and a sense wire.", text: "More power for a card with a second socket: up to 75 W." },
  pwr_sw: { title: "POWER SW wire", colors: "Green and white: a button, so the colours don't matter and it fits either way round.", text: "From the case's power button to the PWR pins. A press starts the PC; holding it 4 seconds forces it off." },
  rst_sw: { title: "RESET SW wire", colors: "Blue and white: a button, so it fits either way round.", text: "From the case's reset button to the RST pins. A press restarts the PC at once." },
  pled: { title: "POWER LED wire", colors: "Red is +, white is −. An LED lights only one way round.", text: "Lights the case's power light while the PC is on." },
  hdd_led: { title: "HDD LED wire", colors: "Orange is +, white is −.", text: "Blinks the case's drive light while the SSD reads or writes." },
  hd_audio: { title: "HD AUDIO cable", colors: "Each colour is one channel (left, right) of the headphones or microphone, or a jack-detect line; black is ground.", text: "From the front headphone and microphone jacks to the AAFP header." },
  usb3: { title: "USB 3.0 cable", colors: "Blue: the colour of USB 3.0. Inside, twisted pairs carry data each way.", text: "Makes the front USB 3.0 ports work, through the 19-pin U32G1 header." },
  cpu_fan: { title: "CPU fan cable", colors: "Black ground, yellow +12 V, green speed reading (TACH), blue speed control (PWM).", text: "Powers the cooler's fan on CPU_FAN. The board speeds it up as the CPU warms, and stops the PC if the fan stops." },
  case_fans: { title: "Case fan cable (hub)", colors: "Black ground, yellow +12 V, green speed reading (TACH), blue speed control (PWM).", text: "Powers the case fans through a hub on CHA_FAN, to move air through the case." },
  argb: { title: "ARGB lights cable", colors: "Red +5 V, green data, white ground.", text: "Lights the fans' LEDs from the 5 V ADD_GEN2 header. Never on the 12 V RGB header: it would burn them out." },
};

/** A pinout's rows, and the kinds of pin it has (for its legend). */
export function pinout(id) {
  const rows = PINOUTS[id];
  if (!rows) return null;
  const kinds = [...new Set(rows.flat().filter(Boolean).map((p) => p[1]))].filter((k) => k !== "nc");
  return { rows, kinds };
}

/*
 * The motherboard's slots, headers and ports. marker: where its marker sits on the board (Three
 * side: components/rig/ShowcaseRig.jsx); pins: its pinout; platforms: only on these builds.
 */
export const BOARD_PARTS = {
  socket: {
    title: { am4: "CPU socket (AM4)", am5: "CPU socket (AM5)", lga1700: "CPU socket (LGA1700)" },
    marker: "socket",
    text: {
      am4:
        "Holds the processor. AM4 is a PGA socket: the 1,331 pins are on the CPU and drop into the socket's holes, and the lever slides the top plate over to grip them. Line the CPU's gold triangle up with the triangle on the socket; it only fits one way.",
      am5:
        "Holds the processor. AM5 is an LGA socket: the 1,718 pins are in the socket and the CPU has flat gold pads. The metal load plate presses the CPU onto the pins. Keep the plastic cap on until the CPU goes in: a bent socket pin can ruin the board.",
      lga1700:
        "Holds the processor. LGA1700 is Intel's socket for 12th to 14th generation Core CPUs: its 1,700 pins are in the socket and the CPU has flat gold pads. The CPU is longer than it is wide, and two notches in its sides fit keys in the socket, so it only goes in one way. The steel cover frame presses it onto the pins, and the lever holds the frame shut. Keep the plastic cap on until the CPU goes in: a bent socket pin can ruin the board.",
    },
  },
  dimm: {
    title: "Memory slots (DIMM)",
    marker: "dimm",
    text: {
      am4: "Four slots for DDR4 RAM. Two sticks run in dual channel (about twice as fast) in alternate slots: 1 and 3, or 2 and 4. Most boards want the second and fourth slots from the CPU first (A2 and B2); the manual says which. The latch clicks shut when a stick is fully in.",
      am5: "Four slots for DDR5 RAM. DDR4 sticks won't go in: the notch in the edge is in a different place. Two sticks run in dual channel in alternate slots: 1 and 3, or 2 and 4 (most boards want A2 and B2 first). The latch clicks shut when a stick is fully in.",
      lga1700: "Four slots for DDR5 RAM (DIMM_A1, A2, B1, B2). DDR4 sticks won't go in: the notch in the edge is in a different place. Two sticks run in dual channel in alternate slots; this board marks A2 and B2 with a star as the pair to fill first. Each slot has one latch, at the top: push the stick down until it clicks.",
    },
  },
  m2: {
    title: "M.2 slot",
    marker: "m2",
    text: "A slot for an NVMe SSD, which lies flat on the board under a heatsink cover. The slot carries both power and data, so the drive needs no cables. A 2280 drive is 22 mm wide and 80 mm long; a small screw holds its end down.",
  },
  pcie: {
    title: "PCIe x16 slot",
    marker: "pcie",
    text: "The long slot for the graphics card: 16 lanes of PCI Express 4.0, and up to 75 W of power. A card that needs more takes it from the PSU through PCIe power cables. The latch at the end of the slot locks the card in.",
  },
  atx24: {
    title: "24-pin ATX power",
    marker: "atx24",
    pins: "atx24",
    text: "The board's main power from the PSU: +3.3 V, +5 V and +12 V for everything on it. PS_ON turns the PSU on: the board connects it to ground when you press the power button. PWR_OK is the PSU saying its power is steady, and +5VSB keeps a little power on while the PC is off.",
  },
  eps8: {
    title: "8-pin CPU power (EPS)",
    marker: "eps8",
    pins: "eps8",
    text: "Power for the CPU: four +12 V pins and four grounds, into the voltage regulators around the socket. The plug splits 4 + 4 for boards with a 4-pin header. Without it the fans spin but the PC never starts.",
  },
  panel: {
    title: "Front panel header",
    marker: "panel",
    pins: "panel",
    text: "The case's buttons and lights. PWR is the power button and RST the reset button: switches, so either way round works. PLED is the power light and HDD the drive activity light: LEDs only light with + on +.",
  },
  usb3: {
    title: "USB 3.0 header (19-pin)",
    marker: "u32g1",
    pins: "usb3",
    text: "Runs the case's front USB ports at USB 3 speed (5 Gbps). Each port gets 5 V power, a USB 2.0 data pair (D+ D−) and two fast pairs (TX and RX). One pin is missing, so the wide blue plug fits one way only.",
  },
  usb2: {
    title: "USB 2.0 header (9-pin)",
    marker: "usb2",
    pins: "usb2",
    text: "Two more USB 2.0 ports, for a case's extra ports or a card reader: 5 V, D− and D+ for each port, and grounds. The missing pin keys it.",
  },
  audio: {
    title: "Front audio header (HD Audio)",
    marker: "aafp",
    pins: "audio",
    text: "The case's headphone and microphone jacks. The jack-detect pins tell the board when something is plugged in, so it can switch over from the rear jacks. It looks like the USB 2.0 header, but its missing pin is in another place.",
  },
  cpufan: {
    title: "CPU fan headers (CPU_FAN, CPU_OPT)",
    marker: "cpu_fan",
    pins: "fan4",
    text: "4-pin headers for the CPU cooler's fan (CPU_FAN) and a second fan or pump (CPU_OPT). The board watches CPU_FAN: with no fan there it stops at \"CPU Fan Error!\" to protect the CPU. TACH reports the fan's speed and PWM sets it.",
  },
  chafan: {
    title: "Case fan header (CHA_FAN)",
    marker: "cha_fan",
    pins: "fan4",
    text: "For the case fans, often several through a hub or splitter. The same 4 pins: the board raises the PWM signal as the PC warms up, and the fans speed up. A 3-pin fan fits too; the board then sets its speed with the voltage.",
  },
  argb: {
    title: "5 V ARGB header",
    marker: "add_gen2",
    pins: "argb",
    text: "Addressable RGB: every LED can show its own colour, set through the data line. 3 pins on a 4-pin header (+5 V, data, a gap, ground). The fans' lights plug in here.",
  },
  rgb: {
    title: "12 V RGB header",
    marker: "rgb",
    pins: "rgb",
    platforms: ["am4", "lga1700"],
    text: "Plain RGB strips: all the LEDs show one colour. 4 pins: +12 V and one each for green, red and blue. Never plug a 5 V ARGB device into it: 12 V can burn it out.",
  },
  rearIo: {
    title: "Rear I/O ports",
    marker: "rearIo",
    text: {
      am4: "The ports on the back of the PC: USB-A and USB-C, Ethernet (LAN), the audio jacks (green for speakers or headphones, pink for a microphone, blue for line in) and HDMI / DisplayPort. The board's video ports only work with a CPU that has built-in graphics; the 5600X has none, so the monitor plugs into the graphics card.",
      am5: "The ports on the back of the PC: USB-A and USB-C, Ethernet (LAN), the audio jacks (green for speakers or headphones, pink for a microphone, blue for line in) and HDMI / DisplayPort. The 7600X has built-in graphics, so these video ports work, but with a graphics card fitted the monitor goes on the card.",
      lga1700: "The ports on the back of the PC, behind a shield that comes fitted to the board: twelve USB ports (Type-A and Type-C), 2.5 Gb Ethernet (LAN), the Wi-Fi antenna's two sockets, five audio jacks and an optical output, HDMI and DisplayPort, and two buttons (BIOS FlashBack and Clear CMOS). The i9-12900K has built-in graphics, so the video ports work, but with a graphics card fitted the monitor goes on the card.",
    },
  },
  vrm: {
    title: "VRM (power stages)",
    marker: "vrm",
    text: "The voltage regulators around the socket, under the heatsinks. They turn the 12 V from the 8-pin CPU cable into the low, steady voltage the CPU runs on (about 1 to 1.4 V), and adjust it many times a second as the CPU's load changes.",
  },
  chipset: {
    title: { am4: "Chipset (B550)", am5: "Chipset (B650)", lga1700: "Chipset (Z790)" },
    text: "The board's second chip, under a heatsink in its lower half. It runs the extra USB and SATA ports and some PCIe slots, and links them to the CPU. The chipset decides what a board can do: how many drives, USB ports and lanes.",
  },
  sata: {
    title: "SATA ports",
    text: "For 2.5\" SSDs and hard drives. A SATA drive needs two cables: SATA data to one of these ports, and SATA power from the PSU. This PC uses an M.2 SSD instead, which needs neither.",
  },
  battery: {
    title: "CMOS battery (CR2032)",
    text: "A coin cell that keeps the BIOS settings and the clock while the PC is unplugged. Taking it out for a minute (with the PC unplugged) resets the BIOS to its defaults.",
  },
};

// The PSU's sockets and the graphics card's ports, and the case's fans and front panel
export const PSU_PARTS = {
  sockets: {
    title: "Modular sockets",
    marker: "psuSockets",
    text: "Each cable plugs into a labelled socket: MB for the 24-pin, CPU for the 8-pin CPU cable, PCI-E for the graphics card. The CPU and PCI-E sockets look alike but are wired differently: a cable in the wrong one can damage parts, so always read the label.",
  },
  rear: {
    title: "Power inlet and switch",
    text: "At the back of the case: the mains cable plugs in here, and the I/O switch beside it cuts the power completely. Switch it off and unplug it before you touch anything inside.",
  },
  fan: {
    title: "Fan",
    text: "Underneath, facing down: it pulls cool air in through the dust filter in the floor of the case and blows it out of the back, so the PSU breathes its own air, apart from the rest of the PC.",
  },
};

export const GPU_PARTS = {
  power: {
    title: "Power socket (8-pin PCIe)",
    marker: "gpuPower",
    pins: "pcie8",
    text: "Extra power from the PSU: the 8-pin PCIe cable adds up to 150 W to the 75 W the slot gives. Some cards take two sockets (8 + 6 pins, like the RX 6700 XT); the 6-pin one adds up to 75 W.",
  },
  outputs: {
    title: "Display outputs",
    text: "At the back of the case: one HDMI 2.1 and three DisplayPort 1.4a. The monitor plugs in here, not into the motherboard: the card draws the picture.",
  },
  edge: {
    title: "PCIe edge connector",
    text: "The row of gold contacts along the bottom of the card, pushed into the x16 slot until the slot's latch clicks. Data and up to 75 W of power go through it.",
  },
};

export const CASE_PARTS = {
  intake: {
    title: "Front intake fans",
    marker: "fansFront",
    text: "Three 120 mm fans behind the mesh front panel pull cool room air into the case. The mesh and its dust filter let air in and keep dust out.",
  },
  exhaust: {
    title: "Rear and top exhaust fans",
    marker: "fansRear",
    text: "One fan at the back and two on top push the warm air out. Heat rises, so air flowing from front to back and bottom to top keeps every part cool.",
  },
  frontIo: {
    title: "Front panel buttons and ports",
    marker: "frontIo",
    text: "On top of the case, at the front: the power button (its ring lights while the PC is on; press it to turn the PC on or off), the reset button and the drive light, two USB 3.0 ports, and the headphone and microphone jacks. Their wires run down inside the front of the case and behind the motherboard tray to the board's front panel, USB 3.0 and HD audio headers.",
  },
  shroud: {
    title: "PSU shroud",
    text: "The cover over the bottom of the case. It hides the PSU and the spare cable lengths, and keeps the PSU's own airflow apart.",
  },
  grommets: {
    title: "Cable cut-outs and grommets",
    text: "Holes in the motherboard tray, with rubber grommets, beside the board. Cables run behind the tray, out of sight, and come through the hole nearest their header: a tidy build is also a cooler one.",
  },
};

// the cables and the case's wires, with the pins at their plug end
export const CABLE_PARTS = {
  atx24: { title: "24-pin ATX cable", marker: "cable:atx24", pins: "atx24", text: "From the PSU's MB socket to the board's 24-pin header. The widest plug in the PC; push until the clip clicks over the header's tab." },
  eps8: { title: "8-pin CPU cable (4+4)", marker: "cable:eps8", pins: "eps8", text: "From the PSU's CPU socket to the 8-pin header above the socket. It's marked CPU; don't confuse it with the PCIe cable, which is marked PCI-E and keyed differently." },
  pcie: { title: "8-pin PCIe cable (6+2)", marker: "cable:pcie", pins: "pcie8", text: "From the PSU's PCI-E socket to the graphics card. Its 2 extra pins clip on beside the 6, so it also fits a 6-pin card." },
  panel: { title: "Front panel wires", marker: "wire:pwr_sw", pins: "panel", text: "Small 2-pin plugs: POWER SW, RESET SW, POWER LED and HDD LED. Each is labelled on the plug; on the LED plugs the coloured wire is +." },
  usb3: { title: "USB 3.0 cable", marker: "wire:usb3", pins: "usb3", text: "The thick blue cable with the 19-pin plug, from the front USB ports to the U32G1 header. Press it straight down; its pins bend easily." },
  audio: { title: "HD AUDIO cable", marker: "wire:hd_audio", pins: "audio", text: "From the front headphone and microphone jacks to the AAFP header at the bottom-left of the board." },
  fans: { title: "Fan cables", marker: "wire:cpu_fan", pins: "fan4", text: "4-pin plugs: the cooler's fan on CPU_FAN, the case fans (through a hub) on CHA_FAN. A ridge on the plug fits a guide on the header." },
  argb: { title: "ARGB cable", marker: "wire:argb", pins: "argb", text: "The fans' lights: a 3-pin 5 V plug on the ARGB header. The arrow on the plug goes on +5 V." },
};

/**
 * The guide's parts, in the order the list shows them. icon: its picture (components/Icon.jsx);
 * model: the scene part to highlight; catalog: the slot the build's part comes from (its name and
 * specs); note: what the list says under its name when no catalog part does; parts: the sub-items;
 * groups: a long list of them, in order, under headings.
 */
export const GUIDE = [
  {
    id: "motherboard",
    icon: "board",
    title: "Motherboard",
    model: "board",
    catalog: "motherboard",
    text: "The main circuit board. Every part plugs into it or connects to it with a cable, and it carries power and data between them.",
    parts: BOARD_PARTS,
    groups: [
      ["Slots", ["socket", "dimm", "m2", "pcie"]],
      ["Power", ["atx24", "eps8"]],
      ["Headers", ["panel", "usb3", "usb2", "audio", "cpufan", "chafan", "argb", "rgb"]],
      ["Ports and chips", ["rearIo", "vrm", "chipset", "sata", "battery"]],
    ],
  },
  {
    id: "cpu",
    icon: "cpu",
    title: "CPU",
    model: "cpu",
    catalog: "cpu",
    text: {
      am4: "The processor: it runs every program. The Ryzen 5 5600X has 6 cores (12 threads) and no built-in graphics, so this PC needs a graphics card. Its pins are on the CPU itself. Under the cooler, with a thin layer of thermal paste between them so the heat flows into the cooler.",
      am5: "The processor: it runs every program. The Ryzen 5 7600X has 6 cores (12 threads) and small built-in graphics, enough for a desktop without a graphics card. It has gold pads instead of pins. Under the cooler, with a thin layer of thermal paste between them so the heat flows into the cooler.",
      lga1700: "The processor: it runs every program. The Intel Core i9-12900K has 16 cores of two kinds: 8 fast performance cores and 8 smaller efficiency cores (24 threads), and small built-in graphics. It has gold pads instead of pins, and it is longer than it is wide. Under the cooler, with a thin layer of thermal paste between them so the heat flows into the cooler.",
    },
  },
  {
    id: "cpu_cooler",
    icon: "fan",
    title: "CPU cooler",
    model: "cooler",
    catalog: "cpu_cooler",
    text: {
      am4: "Carries the CPU's heat away. The AMD Wraith Stealth's base sits on the CPU with thermal paste; heat spreads into its aluminium fins and the fan blows it off. Rated for 65 W, just right for the 5600X. Its fan plugs into CPU_FAN.",
      am5: "Carries the CPU's heat away. Copper heat pipes in the base take it up into a tall stack of fins, and the 120 mm fan pushes air through them toward the rear exhaust fan. Rated for 150 W: the 7600X makes 105 W, too much for a small stock cooler. Its fan plugs into CPU_FAN.",
      lga1700: "Carries the CPU's heat away. Copper heat pipes in the base take it up into a tall stack of fins, and the 120 mm fan pushes air through them toward the rear exhaust fan. Rated for 150 W: the i9-12900K makes 125 W at its base power, and more when it is pushed. It needs the bracket for LGA1700; an AMD stock cooler has none. Its fan plugs into CPU_FAN.",
    },
  },
  {
    id: "ram",
    icon: "ram",
    title: "RAM",
    model: "ram",
    catalog: "ram1",
    text: "Fast working memory for the programs that are running; it's emptied when the PC turns off. Two matching sticks in alternate slots run in dual channel, about twice as fast as one. The light bar on top is RGB: the board sets its colours.",
  },
  {
    id: "storage",
    icon: "ssd",
    title: "SSD",
    model: "ssd",
    catalog: "storage",
    text: "Stores Windows, programs and files, and keeps them with the power off. An NVMe SSD talks to the CPU over PCIe lanes: several times faster than a SATA SSD, and no cables. It sits in the M.2 slot under the board's heatsink cover.",
  },
  {
    id: "gpu",
    icon: "gpu",
    title: "Graphics card",
    model: "gpu",
    catalog: "gpu",
    text: "Draws everything you see on the screen, and does the heavy work in games. It sits in the PCIe x16 slot, takes extra power through an 8-pin PCIe cable, and the monitor plugs into its ports at the back.",
    parts: GPU_PARTS,
  },
  {
    id: "psu",
    icon: "psu",
    title: "Power supply",
    model: "psu",
    catalog: "psu",
    text: "Turns the mains power from the wall into steady 12 V, 5 V and 3.3 V for the parts. This one is modular: only the cables the PC needs are plugged in. It sits under the shroud at the bottom, its fan facing down.",
    parts: PSU_PARTS,
  },
  {
    id: "case",
    icon: "pcCase",
    note: "Mesh front panel and six fans",
    title: "Case and airflow",
    model: "case",
    text: "Holds everything and steers the air through it: cool air in at the front, warm air out at the back and the top. Watch the airflow with the power on.",
    parts: CASE_PARTS,
  },
  {
    id: "cables",
    icon: "cable",
    note: "Power cables and the case's wires",
    title: "Cables and wires",
    model: "cables",
    text: "Power cables from the PSU to the board and the graphics card, and the case's thinner wires to the board's headers. Each plug fits only its own socket, one way round: look at its shape and count its pins.",
    parts: CABLE_PARTS,
    groups: [
      ["Power cables", ["atx24", "eps8", "pcie"]],
      ["Case wires", ["panel", "usb3", "audio", "fans", "argb"]],
    ],
  },
];

export const guidePart = (id) => GUIDE.find((g) => g.id === id) || null;

/** The sub-items a part shows on this platform (the AM5 board has no 12 V RGB header; the others do). */
export const partsFor = (part, platform) =>
  Object.entries(part?.parts || {}).filter(([, p]) => !p.platforms || p.platforms.includes(platform));

/** The build on this platform, for the overview: its part for each guide part, and the power it needs. */
export function buildSummary(platform) {
  const picks = correctPicks(platform);
  const name = (slot) => CATALOG[picks[slot]]?.name;
  const psu = CATALOG[picks.psu];
  return {
    platform: PLATFORM_LABEL[platform],
    names: {
      motherboard: name("motherboard"),
      cpu: name("cpu"),
      cpu_cooler: name("cpu_cooler"),
      ram: `2 × ${name("ram1")}`,
      storage: name("storage"),
      gpu: name("gpu"),
      psu: name("psu"),
    },
    watts: requiredWatts(picks),
    psuWatts: psu?.watts ?? 0,
  };
}

/** The catalog entry behind a guide part on this platform (name and specs), if it has one. */
export function guideItem(part, platform) {
  if (!part?.catalog) return null;
  const id = correctPicks(platform)[part.catalog];
  return id ? { id, ...CATALOG[id] } : null;
}
