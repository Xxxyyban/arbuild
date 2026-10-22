// Short, kid-friendly info for the in-scene cards.
// Each part: what it does, a fun fact, install steps, do/don't, and a 1-tap quiz.

export const PARTS = {
  cpu: {
    tag: "CPU",
    name: "Ryzen 9 5900X",
    what: "The brain of your PC. It runs every program and makes every decision.",
    fact: "This one has 12 cores. Think of 12 workers doing jobs at the same time!",
    steps: [
      "Touch the metal case first to zap static.",
      "Lift the socket lever all the way up.",
      "Match the gold triangle on the CPU to the triangle on the socket.",
      "Lower it straight down. Never push or slide it.",
      "Drop the lever to lock it.",
      "Add thermal paste, then mount the cooler.",
    ],
    dos: ["Hold it by the edges.", "Match the triangles before it goes in."],
    donts: ["Never touch the gold pins underneath.", "Never press it down to make it fit."],
    quiz: { q: "What do you line up before placing the CPU?", options: ["The gold triangles", "The logo", "The screws"], answer: 0, why: "Triangle meets triangle. It only fits one way." },
  },
  cpu_cooler: {
    tag: "COOLER",
    name: "CPU Cooler (AM4)",
    what: "Keeps the CPU cool. A heatsink soaks up heat and the fan blows it away.",
    fact: "Without a cooler, a CPU can overheat in seconds and shut itself off.",
    steps: [
      "Seat and lock the CPU first.",
      "Peel the plastic film off the cooler base.",
      "No pre-applied paste? Add a pea-sized dot on the CPU.",
      "Lower it straight down. No twisting.",
      "Tighten the screws a little at a time, side to side.",
      "Plug the fan cable into the CPU fan header.",
    ],
    dos: ["Remove the plastic film first.", "Tighten evenly, criss-cross."],
    donts: ["Never power on without a cooler.", "Don't use too much paste."],
    quiz: { q: "Where does the cooler's fan cable plug in?", options: ["CPU fan header", "Power button pins", "Hard drive"], answer: 0, why: "The CPU fan header sits right next to the socket." },
  },
  motherboard: {
    tag: "MOTHERBOARD",
    name: "ASUS ROG Strix B550-F",
    what: "The main circuit board. Every part plugs into it and it shares power between them.",
    fact: "Tap the board once to zoom in, then tap a quarter to explore it!",
    steps: [
      "Snap the I/O shield into the case first.",
      "Add brass standoffs only where the board has screw holes.",
      "Lower the board in, holding the edges.",
      "Screw it down criss-cross. Snug, not tight.",
    ],
    dos: ["Match standoffs to the screw holes.", "Follow the manual for front panel wires."],
    donts: ["Don't put it on carpet or bare metal.", "Don't overtighten the screws."],
    quiz: { q: "Why do we use standoffs?", options: ["They lift the board so it can't short on the case", "They look cool"], answer: 0, why: "Metal touching the back of the board can short it." },
  },
  motherboard_rear: {
    tag: "REAR PORTS",
    name: "Rear I/O Panel",
    what: "The back ports where your keyboard, mouse, monitor and internet plug in.",
    fact: "It has USB, LAN, audio jacks and even a BIOS Flashback button.",
    steps: ["Line the ports up with the I/O shield openings.", "Plug cables in gently and straight."],
    dos: ["Check the plug direction first."],
    donts: ["Don't force a plug in upside down.", "Don't use these video ports if you have a graphics card."],
    quiz: { q: "Graphics card installed. Where does the monitor plug in?", options: ["Into the card", "Into the motherboard"], answer: 0, why: "The card does the drawing, so use its ports." },
  },
  ram: {
    tag: "RAM",
    name: "DDR4 Memory",
    what: "Short-term memory. It holds whatever you're working on right now.",
    fact: "Two sticks in the right slots run in dual-channel, which is faster.",
    steps: [
      "Open the latches on both ends of the slot.",
      "Line up the notch with the key in the slot.",
      "Press both ends down with your thumbs.",
      "Listen for the click as the latches snap shut.",
    ],
    dos: ["Use matching pairs in alternating slots.", "Press evenly on both ends."],
    donts: ["Don't rock it in at an angle.", "Don't touch the gold contacts."],
    quiz: { q: "How do you know RAM is seated?", options: ["The latches click shut", "It feels warm", "The LED blinks"], answer: 0, why: "Both latches snapping in means it's locked." },
  },
  storage: {
    tag: "SSD",
    name: "M.2 NVMe SSD",
    what: "Long-term memory. It keeps Windows, apps and files, even when the power is off.",
    fact: "An M.2 drive plugs straight into the board. No cables needed!",
    steps: [
      "Lift off the board's M.2 heatsink, if it has one.",
      "Slide the drive in at a slight angle, gold side first.",
      "Press the far end down flat.",
      "Hold it with the tiny screw.",
      "Put the heatsink back on.",
    ],
    dos: ["Match the notch to the slot key.", "Always screw down the far end."],
    donts: ["Don't force it in.", "Don't leave the end loose."],
    quiz: { q: "Which cables does an M.2 SSD need?", options: ["None", "A SATA data cable", "Two power cables"], answer: 0, why: "The slot supplies both power and data." },
  },
  psu: {
    tag: "PSU",
    name: "Power Supply",
    what: "Turns wall power into safe power for every part inside the case.",
    fact: "Power hungry graphics cards need more watts, so pick a strong one.",
    steps: [
      "Switch it off and unplug it before touching anything.",
      "Mount it with its fan facing a vent.",
      "Plug the 24-pin cable into the board.",
      "Plug the 8-pin cable into the CPU power spot.",
      "Run PCIe cables straight to the graphics card.",
    ],
    dos: ["Pick enough watts for your parts.", "Use the cables that came with it."],
    donts: ["Never open it. It holds a dangerous charge.", "Don't mix cables from other brands."],
    quiz: { q: "Which cable powers the CPU?", options: ["8-pin CPU", "SATA", "HDMI"], answer: 0, why: "No 8-pin plugged in means the PC won't start." },
  },
  gpu: {
    tag: "GPU",
    name: "RTX 3060 Ti Graphics Card",
    what: "Draws every picture, video and game you see on screen.",
    fact: "It has its own fans and its own memory, like a mini computer.",
    steps: [
      "Remove the matching slot covers on the case.",
      "Open the PCIe slot latch.",
      "Press the card straight down until it clicks.",
      "Screw its bracket to the case.",
      "Plug in the PCIe power cables from the PSU.",
    ],
    dos: ["Press evenly along the whole card.", "Plug your monitor into the card."],
    donts: ["Don't force it in at an angle.", "Don't carry it by the fan shroud."],
    quiz: { q: "Where does your monitor cable go?", options: ["The graphics card", "The motherboard"], answer: 0, why: "The card's ports use the card's power." },
  },
};

const firstSentence = (t, max = 130) => {
  const s = ((t || "").split(/(?<=[.!?])\s/)[0] || "").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
};

export function buildPartInfo(id) {
  const p = PARTS[id];
  if (!p) return null;
  const rules = [];
  const n = Math.max(p.dos.length, p.donts.length);
  for (let i = 0; i < n; i++) {
    if (p.dos[i]) rules.push({ head: "Do", tone: "good", body: p.dos[i] });
    if (p.donts[i]) rules.push({ head: "Don't", tone: "bad", body: p.donts[i] });
  }
  return {
    key: id,
    tag: p.tag,
    title: p.name,
    tabs: [
      { label: "About", steps: [{ head: "What it does", body: p.what }, { head: "Fun fact", body: p.fact }] },
      { label: "Install", steps: p.steps.map((s, i) => ({ head: `Step ${i + 1} of ${p.steps.length}`, body: s })) },
      { label: "Do / Don't", steps: rules },
      { label: "Quiz", quiz: p.quiz },
    ],
  };
}

// Each motherboard quadrant gets its own card (data comes from boardQuadrants.js).
export function buildQuadInfo(id, q) {
  if (!q) return null;
  return {
    key: "q" + id,
    tag: q.tag || "QUAD",
    title: q.name || "Motherboard Region",
    tabs: [
      { label: "Overview", steps: [{ head: "What's here", body: firstSentence(q.summary, 150) }] },
      {
        label: "Parts",
        steps: (q.items || []).map((it) => ({
          head: it.name,
          body: firstSentence(it.text),
          extra: it.tip ? "Tip: " + firstSentence(it.tip, 90) : "",
        })),
      },
    ],
  };
}