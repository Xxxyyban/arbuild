// The Build Lab's rules and score for the power cord, what the PC screen says, and how often a class lab
// saves to the database (lab/Rules.js, Scoring.js, Setup.js, Faults.js, Screen.js, rowSaver.js, reportEvent.js).
// `npm test` runs it from the app folder; ext-register.mjs lets Node load the app's extensionless imports.
// Exits 1 if anything fails.
import { pathToFileURL } from "node:url";
import path from "node:path";
const src = (p) => pathToFileURL(path.resolve("src", p)).href;
const R = await import(src("lab/Rules.js"));
const S = await import(src("lab/Scoring.js"));
const C = await import(src("lab/Catalog.js"));
const Setup = await import(src("lab/Setup.js"));
const F = await import(src("lab/Faults.js"));
const Sc = await import(src("lab/Screen.js"));
const K = await import(src("lab/Constants.js"));

let fails = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

console.log("-- the cord's rules");
const picks = C.correctPicks("am4");
eq("no PSU picked", R.cordBlock({}, {})?.msg, "Pick a PSU first.");
eq("PSU on the bench", !!R.cordBlock({}, picks), true);
eq("PSU in, screws out", !!R.cordBlock({ psu: true }, picks, [true, false, true, true]), true);
const allIn = Object.fromEntries(C.buildSlots(picks).map((p) => [p, true]));
const screwed = [true, true, true, true];
eq("PSU in and screwed, the rest still out", R.cordBlock({ psu: true }, picks, screwed)?.msg, "Put the Motherboard in first (and 6 more parts): the power cord goes in last.");
eq("all in but the second stick", R.cordBlock({ ...allIn, ram2: false }, picks, screwed)?.msg, "Put the RAM 2 in first: the power cord goes in last.");
eq("no second stick picked: not needed", R.cordBlock({ ...allIn, ram2: false }, { ...picks, ram2: null }, screwed), null);
eq("every part in and the PSU screwed", R.cordBlock(allIn, picks, screwed), null);
eq("cordIn: neither", R.cordIn(R.NO_CORD), false);
eq("cordIn: one end", R.cordIn({ psu: true, wall: false }), false);
eq("cordIn: both", R.cordIn(R.CORD_IN), true);
eq("cordIn: nothing yet", R.cordIn(undefined), false);

console.log("-- powering on");
const full = Setup.buildStart({ startMode: "assemble", startState: "full", platform: "am4" });
const state = (cord) => ({ ...full, cord, cables: full.cables, picks: full.picks });
eq("a full PC, cord in, starts", R.evaluateBoot(state(R.CORD_IN)).status, "hello");
eq("no cord: dead", R.evaluateBoot(state(R.NO_CORD)).status, "dead");
eq("no cord: it's the cord's fault", R.evaluateBoot(state(R.NO_CORD)).part, "power_cord");
eq("in the PSU only: names the strip", /power strip/.test(R.evaluateBoot(state({ psu: true, wall: false })).message), true);
eq("in the strip only: names the PSU", /the PSU/.test(R.evaluateBoot(state({ psu: false, wall: true })).message), true);
eq("hints off: says no more", R.evaluateBoot(state(R.NO_CORD), { hints: false }).message, "Nothing happens.");
eq("older callers (no cord given) aren't checked", R.evaluateBoot({ ...full, cord: undefined }).status, "hello");
eq("no PSU comes first", R.evaluateBoot({ ...state(R.NO_CORD), installed: { motherboard: true } }).message, "Nothing happens, there's no power supply installed.");

console.log("-- how a lab starts");
eq("empty bench", Setup.buildStart({ startMode: "assemble", startState: "empty", platform: "am4" }).cord, R.NO_CORD);
eq("a PC to take apart", Setup.buildStart({ startMode: "disassemble", startState: "full", platform: "am4" }).cord, R.CORD_IN);
eq("a running PC, build mode", full.cord, R.CORD_IN);
eq("custom, building, PSU in: goes in last", Setup.buildStart({ startMode: "assemble", startState: "custom", customInstalled: ["psu"], platform: "am4" }).cord, R.NO_CORD);
eq("custom, taking apart, PSU in", Setup.buildStart({ startMode: "disassemble", startState: "custom", customInstalled: ["psu"], platform: "am4" }).cord, R.CORD_IN);
eq("custom, taking apart, no PSU", Setup.buildStart({ startMode: "disassemble", startState: "custom", customInstalled: ["cpu"], platform: "am4" }).cord, R.NO_CORD);
eq("a faulty PC is plugged in", F.scenarioStart(undefined, "am4")?.cord, R.CORD_IN);

console.log("-- the guide's steps");
const base = { installed: {}, picks, pasteApplied: false, booted: false, power: { shutdown: false, unplugged: false, discharged: false } };
const steps = (cord) => R.expertSteps("assemble", { ...base, cord });
const row = (cord) => steps(cord).find((s) => /power cord/i.test(s.label));
eq("a step for it", !!row(R.NO_CORD), true);
eq("not done", row(R.NO_CORD).done, false);
eq("half is not done", row({ psu: true, wall: false }).done, false);
eq("done", row(R.CORD_IN).done, true);
eq("it comes right before powering on", steps(R.NO_CORD).at(-2).label === row(R.NO_CORD).label && /Power on/.test(steps(R.NO_CORD).at(-1).label), true);
eq("teardown: still one unplug step", R.expertSteps("disassemble", { ...base, cord: R.CORD_IN }).filter((s) => /Unplug the power cord/.test(s.label)).length, 1);

console.log("-- the score");
const req = S.taskRequirements({ mode: "assemble" }, []);
const noBoot = S.taskRequirements({ mode: "assemble", mustBoot: false }, []);
const P = (n) => S.actionPoints(n, 0);
eq("10 points, 11 when perfect", [S.POINTS.power_cord, P(S.POINTS.power_cord)], [10, 11]);
eq("a task that must start counts it", S.maxPoints("assemble", req) - S.maxPoints("assemble", noBoot), P(S.POINTS.power_cord) + S.POINTS.bootBase + S.POINTS.bootDualRam + S.POINTS.bootGpu);
eq("a task that needn't start doesn't", Object.keys(S.taskLedger({ "assemble:power_cord": 11, "assemble:psu": 66 }, noBoot)), ["assemble:psu"]);
eq("one that must, does", Object.keys(S.taskLedger({ "assemble:power_cord": 11, "assemble:psu": 66 }, req)), ["assemble:power_cord", "assemble:psu"]);
eq("taking apart isn't changed", S.maxPoints("disassemble", S.taskRequirements({ mode: "disassemble" }, ["atx24", "eps8", "pcie"])), 631);

console.log("-- the greeting");
const at = (h, m = 0) => new Date(2026, 10, 9, h, m);
for (const [h, m, want] of [[4, 59, "Good night"], [5, 0, "Good morning"], [11, 59, "Good morning"], [12, 0, "Good afternoon"], [17, 59, "Good afternoon"], [18, 0, "Good evening"], [21, 59, "Good evening"], [22, 0, "Good night"], [0, 0, "Good night"]]) {
  eq(`${h}:${String(m).padStart(2, "0")}`, Sc.greetingFor(at(h, m)), want);
}

console.log("-- the status");
const lv = (m) => Sc.screenStatus(m)?.level ?? null;
eq("off: none", lv({ status: "off" }), null);
eq("starting, shutting down, busy: yellow", ["booting", "shuttingDown", "loading"].map((status) => lv({ status })), ["warn", "warn", "warn"]);
eq("running: green", lv({ status: "hello" }), "good");
eq("running with a warning about touching: still green", lv({ status: "hello", safety: "x" }), "good");
eq("something odd on the case: yellow", lv({ status: "hello", symptoms: [{ text: "x" }] }), "warn");
eq("built-in graphics: yellow", lv({ status: "hello", lowRes: true }), "warn");
eq("no picture, POST error, crash: red", ["nosignal", "post", "bsod"].map((status) => lv({ status })), ["bad", "bad", "bad"]);
eq("every level has a word", ["booting", "hello", "nosignal", "post", "bsod"].every((status) => !!Sc.screenStatus({ status }).label), true);

console.log("-- what it says to a screen reader");
eq("off", Sc.screenSays({ status: "off" }, "Ana"), "The PC is off.");
eq("running", Sc.screenSays({ status: "hello", seconds: 7 }, "Ana", at(9)), "Good morning, Ana. Your PC started in 7 seconds.");
eq("with its warning", Sc.screenSays({ status: "hello", safety: "Mind it." }, "Ana", at(13)), "Good afternoon, Ana. Your PC is up and running. Mind it.");
eq("odd things", Sc.screenSays({ status: "hello", seconds: 7, symptoms: [{ text: "A." }, { text: "B." }] }, "Ana", at(19)), "Good evening, Ana. Your PC started in 7 seconds. Check the case: A. B.");
eq("a crash", Sc.screenSays({ status: "bsod", detail: "Too hot.", fix: "Cool it." }, "Ana"), "The PC crashed. What failed: Too hot. Cool it.");
eq("POST", Sc.screenSays({ status: "post", title: "No memory", detail: "Add RAM.", code: "MEM-01" }, "Ana"), "The PC won't start. No memory. Add RAM. MEM-01");
eq("POST, hints off", Sc.screenSays({ status: "post", title: "No memory", detail: "", code: "MEM-01" }, "Ana"), "The PC won't start. No memory. MEM-01");
eq("POST, a title that ends itself", Sc.screenSays({ status: "post", title: "CPU Fan Error!", code: "F1" }, "Ana"), "The PC won't start. CPU Fan Error! F1");

console.log("-- every PSU in the catalog");
const psus = Object.entries(C.CATALOG).filter(([, i]) => i.category === "psu");
eq("three of them", psus.map(([id]) => id), ["psu_500", "psu_550", "psu_850"]);
eq("variants", psus.map(([, i]) => i.variant), [1, 0, 2]);

console.log("-- the tags' and badge's dots stand out on the dark pill (WCAG: 3:1)");
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
};
const ratio = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const check = (name, fg, bg, need = 4.5) => {
  const r = ratio(fg, bg);
  if (r < need) fails++;
  console.log(`${r < need ? "FAIL" : "ok  "} ${name}: ${r.toFixed(1)}:1 (${fg} on ${bg})`);
};
const PILL = "#0b1220"; // Three/Hardware.jsx PILL_BG
Object.entries(K.PART_DOT).forEach(([k, c]) => check(`pill dot: ${k}`, c, PILL, 3));
Object.entries(Sc.STATUS_COLOR).forEach(([k, c]) => check(`badge dot: ${k}`, c, PILL, 3));

console.log("-- how often a class lab saves (the free plan allows the school 20,000 writes a day)");
const RS = await import(src("lab/rowSaver.js"));
const Ev = await import(src("lab/reportEvent.js"));
// a made-up clock: a timer fires when time is moved past it
function fakeClock() {
  let t = 1e12;
  let id = 0;
  const timers = new Map();
  return {
    now: () => t,
    later: (fn, ms) => (timers.set(++id, { at: t + ms, fn }), id),
    cancel: (i) => timers.delete(i),
    run(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        t = next[1].at;
        next[1].fn();
      }
      t = end;
    },
  };
}
// one student, second by second: something changes every `every` s until `doneAt`, when the task is finished
function lab({ seconds = 3600, every = 0, doneAt = Infinity }) {
  const clock = fakeClock();
  const start = clock.now();
  const saves = [];
  const saver = RS.createRowSaver((d) => saves.push({ at: clock.now() - start, d }), clock); // at: ms into the lab
  for (let s = 0; s < seconds; s++) {
    if (s === doneAt) saver.push({ score: s, taskDone: true, phaseDone: true });
    else if (s < doneAt && (s === 0 || (every && s % every === 0))) saver.push({ score: s, taskDone: false, phaseDone: false });
    if (s % (RS.BEAT_CHECK / 1000) === 0) saver.beat();
    clock.run(1000);
  }
  return { saves, saver, clock };
}
const gaps = (saves) => saves.slice(1).map((x, i) => x.at - saves[i].at);
const busy = lab({ every: 5 }).saves;
eq("working nonstop for an hour: one save every 30 s", busy.length, 120);
eq("never two closer than 30 s", Math.min(...gaps(busy)) >= RS.GAP, true);
eq("each save carries the newest progress", busy[1].d.score, 30);
const idle = lab({}).saves;
eq("nothing changing for an hour: a 'still here' a minute", idle.length, 60);
eq("never quiet long enough for the monitor to call them idle (90 s)", Math.max(...gaps(idle)) <= 75000, true);
eq("a 'still here' saves nothing else", idle[1].d, {});
const done = lab({ every: 5, doneAt: 601 }).saves;
eq("finishing is saved within a second, not at the next turn", done.find((x) => x.d.taskDone).at, 601000 + RS.BURST);
eq("and nothing more once the task is done", done.at(-1).d.taskDone, true);
eq("a 20-minute build, left open for the hour", lab({ every: 5, doneAt: 1200 }).saves.length, 41);
const leaving = lab({ seconds: 10, every: 5 });
leaving.saver.flush();
eq("leaving the page saves what was waiting", leaving.saves.at(-1).d.score, 5);
leaving.saver.flush();
eq("but only once", leaving.saves.length, 2);
const stopped = lab({ seconds: 10, every: 5 });
stopped.saver.stop();
stopped.clock.run(60000);
eq("leaving the class drops what was waiting", stopped.saves.length, 1);
eq("correct steps aren't saved to the log", ["success", "pick", "reset"].some((t) => Ev.SAVED_TYPES.includes(t)), false);
eq("mistakes, exam warnings and the finish are", ["miss", "safety", "bootfail", "integrity", "task"].every((t) => Ev.SAVED_TYPES.includes(t)), true);

console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
