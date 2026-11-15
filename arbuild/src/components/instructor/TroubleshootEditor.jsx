// A troubleshooting task's editor: the PC students get (every part, power cable and case wire, right
// or wrong), what the fixed PC needs, and each fault's points by difficulty. Used when making a lab
// activity (components/class/LabActivityForm.jsx) and editing a task (TaskPanel.jsx).
// Every row that differs from a working PC is tagged as a fault; the list beside it gives each fault
// its points, and a click on one shows its row. Styles: styles/Troubleshoot.css (.tse*).
import { useRef, useState } from "react";
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
// which card a fault's row is on
const CARD_OF = (id) => (id.startsWith("cable:") ? "power" : id.startsWith("wire:") ? "wires" : "parts");

/** One part, cable or wire: its name, its settings, and whether it's a fault. ids: its faults' ids. */
function Row({ ids = [], bad = false, name, note, children }) {
  return (
    <div className={`tse-row ${bad ? "is-fault" : ""}`} data-faults={ids.join(" ")}>
      <span className="tse-row__name">{name}</span>
      <div className="tse-row__controls">{children}</div>
      <span className="tse-row__state">
        {bad ? (
          <span className="tse-flag">Fault</span>
        ) : ids.length > 0 ? (
          <span className="tse-ok" title="As in a working PC">
            <Icon name="check" size={15} />
          </span>
        ) : null}
      </span>
      {note && <small className="tse-row__note">{note}</small>}
    </div>
  );
}

/** A section's card: its icon, its name, and how many faults are in it (none given: no count). */
function Card({ icon, title, faults, children }) {
  return (
    <section className="tse-card">
      <header className="tse-card__head">
        <span className="tse-card__icon">
          <Icon name={icon} size={17} />
        </span>
        <h4>{title}</h4>
        {faults === undefined ? null : faults > 0 ? (
          <span className="tse-count is-bad">
            {faults} {faults === 1 ? "fault" : "faults"}
          </span>
        ) : (
          <span className="tse-count">All right</span>
        )}
      </header>
      <div className="tse-card__body">{children}</div>
    </section>
  );
}

/**
 * task: the task being edited (platform, ramSticks, requireGpu, scenario, faultPoints, bootPoints,
 * and the rest of it for the preview). onChange(patch) merges a change into it.
 */
export default function TroubleshootEditor({ task, onChange }) {
  const [note, setNote] = useState("");
  const root = useRef(null);
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
  const faultIds = new Set(faults.map((f) => f.id));
  const bad = (...ids) => ids.some((id) => faultIds.has(id));
  const inCard = (card) => faults.filter((f) => CARD_OF(f.id) === card).length;

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

  // a fault in the list: show its row, and light it up for a moment
  function jump(id) {
    const row = root.current?.querySelector(`[data-faults~="${id}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("is-flash");
    void row.offsetWidth; // restart the animation
    row.classList.add("is-flash");
  }

  // the task as it is now, in the lab, in a new tab (nothing is saved)
  const preview = () =>
    window.open(`/lab?preview=${encodeTask({ ...task, mode: "troubleshoot", scenario: s })}`, "_blank", "noopener");

  return (
    <div className="tse" ref={root}>
      <p className="ins-muted ins-small">
        Set the PC up the way students will find it. Everything you change from a working PC becomes a fault for them to
        find and fix, and is tagged <span className="tse-flag">Fault</span> here. Give each fault its points.
      </p>
      <div className="tse-tools">
        <button type="button" className="btn" onClick={reset}>
          <Icon name="refresh" size={16} />
          Start from a working PC
        </button>
        <div className="tse-add" role="group" aria-label="Add a random fault">
          <span>Add a random fault</span>
          {DIFFICULTIES.map((d) => (
            <button key={d.id} type="button" onClick={() => addFault(d)}>
              <Icon name="plus" size={13} />
              {d.label}
            </button>
          ))}
        </div>
        <span className="ins-spacer" />
        <button type="button" className="btn btn--primary" onClick={preview}>
          <Icon name="play" size={15} />
          Try it as a student
        </button>
      </div>
      {note && (
        <p className="tse-note" role="status">
          {note}
        </p>
      )}

      <div className="tse-cols">
        <div className="tse-pc">
          <Card icon="cpu" title="Parts" faults={inCard("parts")}>
            <Row name="Motherboard">
              <span className="tse-row__fixed">
                {CATALOG[s.parts.motherboard].name} ({PLATFORM_LABEL[platform]}), in the case
              </span>
            </Row>
            {SCENARIO_SLOTS.map((slot) => {
              const id = s.parts[slot];
              const ram = slot === "ram1" || slot === "ram2";
              const i = slot === "ram1" ? 0 : 1;
              const ids = ram ? [`part:${slot}`, "ram:slots"] : [`part:${slot}`];
              return (
                <Row key={slot} ids={ids} bad={bad(...ids)} name={SLOT_LABEL[slot]} note={benched[slot] ? `${benched[slot]} It waits on the bench.` : null}>
                  <select
                    className="ins-select tse-part"
                    value={id ?? ""}
                    aria-label={SLOT_LABEL[slot]}
                    onChange={(e) => set({ parts: { ...s.parts, [slot]: e.target.value || null } })}
                  >
                    {slot !== "psu" && <option value="">None</option>}
                    {optionsFor(categoryOf(slot)).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
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
                    <select className="ins-select" value={s.ramSlots[i]} aria-label={`${SLOT_LABEL[slot]}'s slot`} onChange={(e) => setRamSlot(i, Number(e.target.value))}>
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          Slot {n + 1}
                        </option>
                      ))}
                    </select>
                  )}
                  {slot === "psu" && <span className="tse-row__fixed">in the case</span>}
                </Row>
              );
            })}
            <Row ids={["paste"]} bad={bad("paste")} name="Thermal paste">
              <label className="ins-check ins-check--inline">
                <input type="checkbox" checked={s.paste} disabled={!fitted("cpu")} onChange={(e) => set({ paste: e.target.checked })} />
                <span>On the CPU</span>
              </label>
            </Row>
            <Row ids={["screws"]} bad={bad("screws")} name="Board screws">
              <select className="ins-select" value={s.screws} aria-label="Board screws in" onChange={(e) => set({ screws: Number(e.target.value) })}>
                {Array.from({ length: SCREW_COUNT + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n} of {SCREW_COUNT} in
                  </option>
                ))}
              </select>
            </Row>
          </Card>

          <Card icon="bolt" title="Power cables" faults={inCard("power")}>
            {Object.keys(CABLES)
              .filter((c) => cableNeeded(c, s.parts))
              .map((c) => {
                const fixed = psuCableFixed(c, s.parts);
                const card = isGpuCable(c);
                return (
                  <Row
                    key={c}
                    ids={[`cable:${c}`]}
                    bad={bad(`cable:${c}`)}
                    name={CABLES[c].label}
                    note={card && !fitted("gpu") ? "The card is on the bench, so this cable isn't plugged into it." : null}
                  >
                    <select className="ins-select tse-part" value={s.cables[c]} aria-label={CABLES[c].label} onChange={(e) => set({ cables: { ...s.cables, [c]: e.target.value } })}>
                      <option value="in">Plugged in at both ends</option>
                      <option value="part">Unplugged at the {card ? "graphics card" : "board"}</option>
                      {!fixed && <option value="psu">Unplugged at the PSU</option>}
                    </select>
                    {fixed && <span className="tse-row__fixed">fixed to this PSU</span>}
                  </Row>
                );
              })}
            {canSwap(s.parts) && (
              <label className="ins-check tse-swap">
                <input type="checkbox" checked={s.swapped} disabled={s.cables.eps8 === "psu" || s.cables.pcie === "psu"} onChange={(e) => set({ swapped: e.target.checked })} />
                <span>Swap the 8-pin CPU and PCIe cables at the PSU. Their sockets look alike; the PSU trips at power on.</span>
              </label>
            )}
          </Card>

          <Card icon="cable" title="Case and fan wires" faults={inCard("wires")}>
            {WIRE_GROUPS.map((g) => (
              <div key={g.id} className="tse-group">
                <span className="tse-group__head">{g.label}</span>
                {WIRE_IDS.filter((id) => WIRES[id].group === g.id).map((id) => {
                  const w = s.wires[id];
                  const onIt = (h) => WIRE_IDS.find((o) => o !== id && s.wires[o]?.at === h);
                  return (
                    <Row
                      key={id}
                      ids={[`wire:${id}`]}
                      bad={bad(`wire:${id}`)}
                      name={wireName(id)}
                      note={id === "cpu_fan" && w && !fitted("cpu_cooler") ? "The cooler isn't fitted, so its fan isn't plugged in." : null}
                    >
                      <select className="ins-select tse-part" value={w?.at ?? ""} aria-label={`Where the ${wireName(id)} plug is`} onChange={(e) => setWire(id, e.target.value || null)}>
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
                          <input type="checkbox" checked={!!w.flipped} onChange={(e) => set({ wires: { ...s.wires, [id]: { ...w, flipped: e.target.checked } } })} />
                          <span>Wrong way round</span>
                        </label>
                      )}
                    </Row>
                  );
                })}
              </div>
            ))}
          </Card>

          <Card icon="check" title="What the fixed PC needs">
            <label className="ins-check ins-check--inline">
              <input type="checkbox" checked={task.requireGpu} onChange={(e) => onChange({ requireGpu: e.target.checked })} />
              <span>A graphics card</span>
            </label>
            <small className="tse-hint">
              {ownCpu.igpu === false && !task.requireGpu
                ? `The ${ownCpu.short} has no built-in graphics, so this PC needs a card anyway.`
                : "Two RAM sticks, always: RAM goes in pairs."}
            </small>
          </Card>
        </div>

        <aside className="tse-side" aria-label="Faults to fix and their points">
          <div className="tse-sum">
            <div>
              <strong>{faults.length}</strong>
              <span>{faults.length === 1 ? "fault to fix" : "faults to fix"}</span>
            </div>
            <div className={total > MAX_TASK_POINTS ? "is-over" : ""}>
              <strong>{total}</strong>
              <span>points</span>
            </div>
          </div>
          {faults.length === 0 && (
            <p className="ins-muted ins-small tse-empty">
              Nothing is wrong with this PC yet. Change a part, a cable or a wire, or add a random fault. A PC with nothing wrong
              is a task too: students check it over and power it on.
            </p>
          )}
          <ul className="tse-faults">
            {faults.map((f) => {
              const level = difficultyOf(points[f.id]);
              return (
                <li key={f.id}>
                  <button type="button" className="tse-faults__text" onClick={() => jump(f.id)} title="Show it in the PC">
                    <em>{AREA_LABEL[f.area]}</em>
                    {f.text}
                  </button>
                  <div className="tse-faults__pts">
                    <div className="tse-seg" role="radiogroup" aria-label="Difficulty">
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          role="radio"
                          aria-checked={level === d.id}
                          className={level === d.id ? "is-on" : ""}
                          onClick={() => setPoints(f.id, DIFFICULTY_POINTS[d.id])}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <span className="tse-pts">
                      <input
                        type="number"
                        min="1"
                        max={MAX_FAULT_POINTS}
                        step="1"
                        inputMode="numeric"
                        value={task.faultPoints?.[f.id] ?? points[f.id]}
                        aria-label="Points"
                        onChange={(e) => setPoints(f.id, e.target.value)}
                      />
                      pts
                    </span>
                  </div>
                </li>
              );
            })}
            <li className="tse-faults__boot">
              <span className="tse-faults__text">
                <em>At the end</em>
                It starts, with nothing wrong
              </span>
              <div className="tse-faults__pts">
                <input
                  type="number"
                  min={faults.length ? 0 : 1}
                  max={MAX_FAULT_POINTS}
                  step="1"
                  inputMode="numeric"
                  value={task.bootPoints ?? BOOT_POINTS}
                  aria-label="Points for the PC starting at the end"
                  onChange={(e) => onChange({ bootPoints: e.target.value })}
                />
                <span>pts</span>
              </div>
            </li>
          </ul>
          {total > MAX_TASK_POINTS && (
            <p className="tse-total is-over">
              These add up to {total}, more than the {MAX_TASK_POINTS} a task can be worth, so the score is scaled down to {MAX_TASK_POINTS}.
            </p>
          )}
          <p className="ins-muted ins-small">
            Easy {DIFFICULTY_POINTS.easy}, medium {DIFFICULTY_POINTS.medium}, hard {DIFFICULTY_POINTS.hard} points, or type your own
            (1 to {MAX_FAULT_POINTS}). Click a fault to see it in the PC. Taking longer than the target time lowers the score.
          </p>
        </aside>
      </div>
    </div>
  );
}
