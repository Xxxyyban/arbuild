// A troubleshooting task's editor: the PC students get (every part, power cable and case wire, right
// or wrong), what the fixed PC needs, and each fault's points by difficulty. Used when making a lab
// activity (components/class/LabActivityForm.jsx) and editing a task (TaskPanel.jsx).
// Styles: styles/Troubleshoot.css (.tse*).
import { useState } from "react";
import { CATALOG, PLATFORM_LABEL, categoryOf, correctPicks, optionsFor } from "../../lab/Catalog";
import { CABLES, SCREW_COUNT, cableNeeded, isGpuCable, psuCableFixed } from "../../lab/Rules";
import { HEADERS, WIRES, WIRE_GROUPS, WIRE_IDS, wireName } from "../../lab/Wires";
import {
  BENCH_SLOTS, BOOT_POINTS, DIFFICULTIES, DIFFICULTY_POINTS, MAX_FAULT_POINTS, SCENARIO_SLOTS,
  addRandomFault, benchedBy, canSwap, difficultyOf, faultPointsFor, normalizeScenario, scenarioFaults, wireSpotsFor, workingScenario,
} from "../../lab/Faults";
import { MAX_TASK_POINTS, encodeTask } from "../../lab/Tasks";
import Icon from "../Icon";

const SLOT_LABEL = { cpu: "CPU", ram1: "RAM stick 1", ram2: "RAM stick 2", cpu_cooler: "CPU cooler", storage: "SSD", gpu: "Graphics card", psu: "PSU" };
const AREA_LABEL = { parts: "Parts", cooling: "Cooling", power: "Power", wires: "Wires" };
const capital = (t) => t[0].toUpperCase() + t.slice(1);

/**
 * task: the task being edited (platform, ramSticks, requireGpu, scenario, faultPoints, bootPoints,
 * and the rest of it for the preview). onChange(patch) merges a change into it.
 */
export default function TroubleshootEditor({ task, onChange }) {
  const [note, setNote] = useState("");
  const platform = task.platform;
  const s = normalizeScenario(task.scenario ?? workingScenario(platform), platform);
  const faults = scenarioFaults(s, task);
  const points = faultPointsFor(faults, task.faultPoints);
  const bootRaw = Math.floor(Number(task.bootPoints));
  const boot = Math.min(MAX_FAULT_POINTS, Math.max(faults.length ? 0 : 1, Number.isFinite(bootRaw) ? bootRaw : BOOT_POINTS));
  const total = faults.reduce((sum, f) => sum + points[f.id], 0) + boot;
  const benched = benchedBy(s);
  const fitted = (slot) => !!s.parts[slot] && !s.bench.includes(slot) && !benched[slot];
  const ownCpu = CATALOG[correctPicks(platform).cpu];

  const set = (patch) => {
    setNote("");
    onChange({ scenario: normalizeScenario({ ...s, ...patch }, platform) });
  };
  const setBench = (slot, on) => set({ bench: on ? [...s.bench, slot] : s.bench.filter((b) => b !== slot) });
  // a stick into the other one's slot: they swap
  const setRamSlot = (i, n) => {
    const slots = [...s.ramSlots];
    if (slots[1 - i] === n) slots[1 - i] = slots[i];
    slots[i] = n;
    set({ ramSlots: slots });
  };
  // a plug onto a header another wire is on: that one moves to this one's old header (if it fits there)
  const setWire = (id, at) => {
    const wires = { ...s.wires };
    const old = wires[id];
    const other = at ? WIRE_IDS.find((o) => o !== id && wires[o]?.at === at) : null;
    wires[id] = at ? { at, flipped: false } : null;
    if (other) wires[other] = old && wireSpotsFor(other, s.parts.motherboard).includes(old.at) ? { at: old.at, flipped: false } : null;
    set({ wires });
  };
  const setPoints = (id, value) => onChange({ faultPoints: { ...(task.faultPoints || {}), [id]: value } });

  function addFault(d) {
    const next = addRandomFault(s, task, d.id);
    if (!next) return setNote(`There's no ${d.label.toLowerCase()} fault left to add to this PC.`);
    setNote("");
    onChange({ scenario: next });
  }

  function reset() {
    if (faults.length > 0 && !window.confirm("Put every part, cable and wire back where it belongs?")) return;
    setNote("");
    onChange({ scenario: workingScenario(platform), faultPoints: {} });
  }

  // the task as it is now, in the lab, in a new tab (nothing is saved)
  const preview = () =>
    window.open(`/lab?preview=${encodeTask({ ...task, mode: "troubleshoot", scenario: s })}`, "_blank", "noopener");

  return (
    <div className="tse">
      <p className="ins-muted ins-small">
        Set the PC up the way students will find it. Every part, cable or wire you change from a working PC is a
        fault for them to find and fix. Give each one its points.
      </p>
      <div className="tse-tools">
        <button type="button" className="btn" onClick={reset}>
          <Icon name="refresh" size={16} />
          Working PC
        </button>
        <span className="tse-tools__label">Add a random fault:</span>
        {DIFFICULTIES.map((d) => (
          <button key={d.id} type="button" className="btn btn--soft" onClick={() => addFault(d)}>
            <Icon name="plus" size={14} />
            {d.label}
          </button>
        ))}
        <span className="ins-spacer" />
        <button type="button" className="btn" onClick={preview}>
          <Icon name="play" size={16} />
          Try it as a student
        </button>
      </div>
      {note && <p className="tse-note" role="status">{note}</p>}

      <div className="tse-cols">
        <div className="tse-pc">
          <section className="tse-sec">
            <h4>Parts</h4>
            <div className="tse-row">
              <span className="tse-row__name">Motherboard</span>
              <span className="tse-row__fixed">{CATALOG[s.parts.motherboard].name} ({PLATFORM_LABEL[platform]}), in the case</span>
            </div>
            {SCENARIO_SLOTS.map((slot) => {
              const id = s.parts[slot];
              const ram = slot === "ram1" || slot === "ram2";
              const i = slot === "ram1" ? 0 : 1;
              return (
                <div key={slot} className="tse-row">
                  <span className="tse-row__name">{SLOT_LABEL[slot]}</span>
                  <div className="tse-row__controls">
                    <select
                      className="ins-select"
                      value={id ?? ""}
                      aria-label={SLOT_LABEL[slot]}
                      onChange={(e) => set({ parts: { ...s.parts, [slot]: e.target.value || null } })}
                    >
                      {slot !== "psu" && <option value="">None</option>}
                      {optionsFor(categoryOf(slot)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    {BENCH_SLOTS.includes(slot) && id && (
                      <select
                        className="ins-select"
                        value={s.bench.includes(slot) || benched[slot] ? "bench" : "in"}
                        disabled={!!benched[slot]} // it can't go in: it's on the bench either way
                        aria-label={`Where the ${SLOT_LABEL[slot]} is`}
                        onChange={(e) => setBench(slot, e.target.value === "bench")}
                      >
                        <option value="in">{ram ? "In a slot" : "Fitted"}</option>
                        <option value="bench">On the bench</option>
                      </select>
                    )}
                    {ram && fitted(slot) && (
                      <select
                        className="ins-select"
                        value={s.ramSlots[i]}
                        aria-label={`${SLOT_LABEL[slot]}'s slot`}
                        onChange={(e) => setRamSlot(i, Number(e.target.value))}
                      >
                        {[0, 1, 2, 3].map((n) => <option key={n} value={n}>Slot {n + 1}</option>)}
                      </select>
                    )}
                    {slot === "psu" && <span className="tse-row__fixed">in the case</span>}
                  </div>
                  {benched[slot] && <small className="tse-row__note">{benched[slot]} It waits on the bench.</small>}
                </div>
              );
            })}
            <div className="tse-row tse-row--wrap">
              <label className="ins-check ins-check--inline">
                <input type="checkbox" checked={s.paste} disabled={!fitted("cpu")} onChange={(e) => set({ paste: e.target.checked })} />
                <span>Thermal paste on the CPU</span>
              </label>
              <label className="tse-inline">
                <span>Board screws in</span>
                <select className="ins-select" value={s.screws} onChange={(e) => set({ screws: Number(e.target.value) })}>
                  {Array.from({ length: SCREW_COUNT + 1 }, (_, n) => <option key={n} value={n}>{n} of {SCREW_COUNT}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="tse-sec">
            <h4>Power cables</h4>
            {Object.keys(CABLES)
              .filter((c) => cableNeeded(c, s.parts))
              .map((c) => {
                const fixed = psuCableFixed(c, s.parts);
                const card = isGpuCable(c);
                return (
                  <div key={c} className="tse-row">
                    <span className="tse-row__name">{CABLES[c].label}</span>
                    <div className="tse-row__controls">
                      <select
                        className="ins-select"
                        value={s.cables[c]}
                        aria-label={CABLES[c].label}
                        onChange={(e) => set({ cables: { ...s.cables, [c]: e.target.value } })}
                      >
                        <option value="in">Plugged in at both ends</option>
                        <option value="part">Unplugged at the {card ? "graphics card" : "board"}</option>
                        {!fixed && <option value="psu">Unplugged at the PSU</option>}
                      </select>
                      {fixed && <span className="tse-row__fixed">fixed to this PSU</span>}
                    </div>
                    {card && !fitted("gpu") && <small className="tse-row__note">The card is on the bench, so this cable isn't plugged into it.</small>}
                  </div>
                );
              })}
            {canSwap(s.parts) && (
              <label className="ins-check">
                <input
                  type="checkbox"
                  checked={s.swapped}
                  disabled={s.cables.eps8 === "psu" || s.cables.pcie === "psu"}
                  onChange={(e) => set({ swapped: e.target.checked })}
                />
                <span>Swap the 8-pin CPU and PCIe cables at the PSU. Their sockets look alike; the PSU trips at power on.</span>
              </label>
            )}
          </section>

          <section className="tse-sec">
            <h4>Case and fan wires</h4>
            {WIRE_GROUPS.map((g) => (
              <div key={g.id} className="tse-group">
                <span className="tse-group__head">{g.label}</span>
                {WIRE_IDS.filter((id) => WIRES[id].group === g.id).map((id) => {
                  const w = s.wires[id];
                  const onIt = (h) => WIRE_IDS.find((o) => o !== id && s.wires[o]?.at === h);
                  return (
                    <div key={id} className="tse-row">
                      <span className="tse-row__name">{wireName(id)}</span>
                      <div className="tse-row__controls">
                        <select
                          className="ins-select"
                          value={w?.at ?? ""}
                          aria-label={`Where the ${wireName(id)} plug is`}
                          onChange={(e) => setWire(id, e.target.value || null)}
                        >
                          <option value="">Unplugged</option>
                          {wireSpotsFor(id, s.parts.motherboard).map((h) => (
                            <option key={h} value={h}>
                              {capital(HEADERS[h].name)}
                              {h === WIRES[id].goes ? " · its place" : onIt(h) ? ` · swap with ${wireName(onIt(h))}` : ""}
                            </option>
                          ))}
                        </select>
                        {WIRES[id].polar && w && (
                          <label className="ins-check ins-check--inline">
                            <input
                              type="checkbox"
                              checked={!!w.flipped}
                              onChange={(e) => set({ wires: { ...s.wires, [id]: { ...w, flipped: e.target.checked } } })}
                            />
                            <span>Wrong way round</span>
                          </label>
                        )}
                      </div>
                      {id === "cpu_fan" && w && !fitted("cpu_cooler") && (
                        <small className="tse-row__note">The cooler isn't fitted, so its fan isn't plugged in.</small>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <section className="tse-sec">
            <h4>What the fixed PC needs</h4>
            <div className="tse-row tse-row--wrap">
              <label className="tse-inline">
                <span>RAM sticks</span>
                <select className="ins-select" value={task.ramSticks} onChange={(e) => onChange({ ramSticks: Number(e.target.value) })}>
                  <option value={2}>2, in dual channel</option>
                  <option value={1}>1</option>
                </select>
              </label>
              <label className="ins-check ins-check--inline">
                <input type="checkbox" checked={task.requireGpu} onChange={(e) => onChange({ requireGpu: e.target.checked })} />
                <span>A graphics card</span>
              </label>
            </div>
            {ownCpu.igpu === false && !task.requireGpu && (
              <small className="tse-row__note">The {ownCpu.short} has no built-in graphics, so this PC needs a card anyway.</small>
            )}
          </section>
        </div>

        <section className="tse-sec tse-side">
          <h4>Faults to fix · {faults.length}</h4>
          {faults.length === 0 && (
            <p className="ins-muted ins-small">
              Nothing is wrong with this PC yet. Change a part, a cable or a wire, or add a random fault. A PC with nothing
              wrong is a task too: students check it over and power it on.
            </p>
          )}
          <ul className="tse-faults">
            {faults.map((f) => (
              <li key={f.id}>
                <span className="tse-faults__text">
                  <em>{AREA_LABEL[f.area]}</em>
                  {f.text}
                </span>
                <span className="tse-faults__pts">
                  <select
                    className="ins-select"
                    value={difficultyOf(points[f.id])}
                    aria-label="Difficulty"
                    onChange={(e) => setPoints(f.id, DIFFICULTY_POINTS[e.target.value])}
                  >
                    {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    <option value="custom" disabled>Custom</option>
                  </select>
                  <input
                    type="number" min="1" max={MAX_FAULT_POINTS} step="1" inputMode="numeric"
                    value={task.faultPoints?.[f.id] ?? points[f.id]}
                    aria-label="Points"
                    onChange={(e) => setPoints(f.id, e.target.value)}
                  />
                  <span>pts</span>
                </span>
              </li>
            ))}
            <li className="tse-faults__boot">
              <span className="tse-faults__text">
                <em>At the end</em>
                It starts, with nothing wrong
              </span>
              <span className="tse-faults__pts">
                <input
                  type="number" min={faults.length ? 0 : 1} max={MAX_FAULT_POINTS} step="1" inputMode="numeric"
                  value={task.bootPoints ?? BOOT_POINTS}
                  aria-label="Points for the PC starting at the end"
                  onChange={(e) => onChange({ bootPoints: e.target.value })}
                />
                <span>pts</span>
              </span>
            </li>
          </ul>
          <p className={`tse-total ${total > MAX_TASK_POINTS ? "is-over" : ""}`}>
            {total > MAX_TASK_POINTS
              ? `These add up to ${total}, more than the ${MAX_TASK_POINTS} a task can be worth, so the score is scaled down to ${MAX_TASK_POINTS}.`
              : `Worth ${total} points.`}
          </p>
          <p className="ins-muted ins-small">
            Easy {DIFFICULTY_POINTS.easy}, medium {DIFFICULTY_POINTS.medium}, hard {DIFFICULTY_POINTS.hard} points, or type
            your own (1 to {MAX_FAULT_POINTS}). Taking longer than the target time lowers the score.
          </p>
        </section>
      </div>
    </div>
  );
}
