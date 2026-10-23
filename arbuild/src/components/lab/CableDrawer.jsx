// The Cables drawer, like Packet Tracer's connections box: pick a PSU cable, then connect its ends.
// A modular PSU's end goes in first (on the bench), then the part end. Styles: styles/BuildLabParts.css
// (.cable-drawer*); the option cards reuse .picker__*.
import { CABLES, plugBlock, psuModular, psuEndDone, psuPlugBlock } from "../../lab/Rules";

// wire colours shown on each card, so students learn to recognise the cables
const SWATCH = {
  atx24: ["#f07c00", "#d42020", "#f2c200", "#141414", "#7a3fb0", "#1f9d45", "#8a8a8a", "#2457c5"],
  eps8: ["#f2c200", "#141414"],
  pcie: ["#f2c200", "#141414"],
};
const PINS = {
  atx24: "24 pins, 2 rows of 12. The widest plug.",
  eps8: "8 pins, splits into 4 + 4.",
  pcie: "8 pins, splits into 6 + 2.",
};
const PART_END = { atx24: "Motherboard", eps8: "Motherboard", pcie: "Graphics card" };

export default function CableDrawer({ cables, psuCables, installed, picks, active, besidePicker, onPick, onClose }) {
  const modular = psuModular(picks);
  return (
    <div className={`cable-drawer ${besidePicker ? "is-beside-picker" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="picker__drawer">
        <div className="picker__head">
          <strong>Cables</strong>
          <button type="button" className="picker__close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p className="picker__locked">
          {!picks?.psu
            ? "Pick a PSU first."
            : modular
            ? "Modular PSU: plug each cable into the PSU first (on the bench), then into its part."
            : "This PSU's cables are fixed to it: plug their other ends into the parts."}
        </p>
        <ul className="picker__list">
          {Object.keys(CABLES).map((c) => {
            const psuDone = psuEndDone(c, picks, psuCables);
            const partDone = !!cables[c];
            const notNeeded = c === "pcie" && !picks?.gpu;
            const next = !psuDone ? psuPlugBlock(c, picks) : partDone ? null : plugBlock(c, installed, picks, psuCables);
            const done = psuDone && partDone;
            return (
              <li key={c} className={done || active === c ? "is-chosen" : ""}>
                <button
                  type="button"
                  className="picker__option"
                  disabled={notNeeded || done || !!next}
                  onClick={() => onPick(c)}
                >
                  <span className="picker__name">{CABLES[c].label}</span>
                  <span className="cable-drawer__swatch" aria-hidden="true">
                    {SWATCH[c].map((col, i) => <i key={i} style={{ background: col }} />)}
                  </span>
                  <span className="cable-drawer__ends">
                    {modular && <End label="PSU" done={psuDone} />}
                    <End label={PART_END[c]} done={partDone} />
                  </span>
                  <span className="picker__state">
                    {notNeeded
                      ? "Not needed: no graphics card in this build."
                      : done
                      ? "Connected at both ends ✓"
                      : active === c
                      ? "Connecting…"
                      : next
                      ? next.msg
                      : PINS[c]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function End({ label, done }) {
  return <em className={done ? "is-done" : ""}>{done ? `${label} ✓` : label}</em>;
}
