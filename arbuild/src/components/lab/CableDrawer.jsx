// The Cables drawer, like Packet Tracer's connections box: pick a PSU cable, then connect its ends.
// The PSU end comes first, on the bench (plugged into a modular PSU, or routed out of a fixed PSU's
// bundle), then the part end. Under them, the case's and the fans' wires (lab/Wires.js): pick one,
// then the header it goes on. Styles: styles/BuildLabParts.css (.cable-drawer*); the option cards
// reuse .picker__*.
import { CABLES, plugBlock, psuModular, psuEndDone, psuPlugBlock, psuCableFixed, cableNeeded, cordIn } from "../../lab/Rules";
import { WIRES, WIRE_GROUPS, WIRE_IDS, wireBlock, headerName } from "../../lab/Wires";
import Icon from "../Icon";

// wire colours shown on each card, so students learn to recognise the cables
const SWATCH = {
  atx24: ["#f07c00", "#d42020", "#f2c200", "#141414", "#7a3fb0", "#1f9d45", "#8a8a8a", "#2457c5"],
  eps8: ["#f2c200", "#141414"],
  pcie: ["#f2c200", "#141414"],
  pcie6: ["#f2c200", "#141414"],
};
const PINS = {
  atx24: "24 pins, 2 rows of 12. The widest plug.",
  eps8: "8 pins, splits into 4 + 4.",
  pcie: "8 pins, splits into 6 + 2.",
  pcie6: "6 pins in 2 rows of 3, for the card's 6-pin socket. Any of the PSUs can supply it.",
};
const PART_END = { atx24: "Motherboard", eps8: "Motherboard", pcie: "Graphics card", pcie6: "Graphics card" };

// labels: false when the instructor hides the board's labels (a wire's header isn't named then)
// cord: the mains power cord, { psu, wall }; cordNext: why it can't go in yet (Rules cordBlock)
export default function CableDrawer({ cables, psuCables, installed, picks, active, besidePicker, onPick, onClose, wires, headers, activeWire, onPickWire, labels = true, cord, cordActive, cordNext, onPickCord }) {
  const modular = psuModular(picks);
  const anyFixed = Object.keys(CABLES).some((c) => psuCableFixed(c, picks));
  return (
    <div className={`cable-drawer ${besidePicker ? "is-beside-picker" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="picker__drawer">
        <div className="picker__head">
          <strong>Cables</strong>
          <button type="button" className="picker__close" aria-label="Close" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <p className="picker__locked">
          {!picks?.psu
            ? "Pick a PSU first."
            : !anyFixed
            ? "Modular PSU: plug each cable into the PSU first (on the bench), then into its part."
            : modular
            ? "Semi-modular PSU: the 24-pin and CPU cables are fixed to it, so route them out of the bundle; the PCI-E cable plugs into its socket. Do both on the bench, then plug the other ends into the parts."
            : "Fixed cables: they're already attached to this PSU. Route each one out of the bundle on the bench, then plug its other end into the part."}
        </p>
        <ul className="picker__list">
          {/* the 6-pin PCIe cable only for a card with a 6-pin socket */}
          {Object.keys(CABLES).filter((c) => c !== "pcie6" || cableNeeded(c, picks)).map((c) => {
            const psuDone = psuEndDone(c, picks, psuCables);
            const partDone = !!cables[c];
            // no graphics card (yet): the PCIe cable can still go into the PSU, ready for one
            const spare = c === "pcie" && !picks?.gpu;
            const next = !psuDone ? psuPlugBlock(c, picks) : partDone ? null : plugBlock(c, installed, picks, psuCables);
            const done = psuDone && partDone;
            return (
              <li key={c} className={done || active === c ? "is-chosen" : ""}>
                <button
                  type="button"
                  className="picker__option"
                  disabled={done || !!next}
                  onClick={() => onPick(c)}
                >
                  <span className="picker__name">{CABLES[c].label}</span>
                  <span className="cable-drawer__swatch" aria-hidden="true">
                    {SWATCH[c].map((col, i) => <i key={i} style={{ background: col }} />)}
                  </span>
                  <span className="cable-drawer__ends">
                    <End label={psuCableFixed(c, picks) ? "Routed" : "PSU"} done={psuDone} />
                    <End label={PART_END[c]} done={partDone} />
                  </span>
                  <span className="picker__state">
                    {spare
                      ? psuDone
                        ? "In the PSU, ready if you add a graphics card."
                        : "No graphics card yet. You can still plug it into the PSU now, ready for one later."
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
          {/* the mains cord: last of all, into the PSU and then the power strip */}
          <li className={cordIn(cord) || cordActive ? "is-chosen" : ""}>
            <button type="button" className="picker__option" disabled={cordIn(cord) || !!cordNext} onClick={onPickCord}>
              <span className="picker__name">Power cord</span>
              <span className="cable-drawer__swatch" aria-hidden="true">
                <i style={{ background: "#141518" }} />
              </span>
              <span className="cable-drawer__ends">
                <End label="PSU" done={!!cord?.psu} />
                <End label="Power strip" done={!!cord?.wall} />
              </span>
              <span className="picker__state">
                {cordIn(cord)
                  ? "Plugged in at both ends ✓"
                  : cordActive
                  ? "Connecting…"
                  : cordNext
                  ? cordNext.msg
                  : "A 3-pin plug and a wall plug. It goes in last: the PSU first, then the power strip."}
              </span>
            </button>
          </li>
        </ul>

        {WIRE_GROUPS.map((g) => (
          <div key={g.id} className="picker__slot">
            <h3 className="picker__slot-head">{g.label}</h3>
            <ul className="picker__list">
              {WIRE_IDS.filter((id) => WIRES[id].group === g.id).map((id) => {
                const w = wires?.[id];
                const block = w ? null : wireBlock(id, installed);
                return (
                  <li key={id} className={w || activeWire === id ? "is-chosen" : ""}>
                    <button type="button" className="picker__option" disabled={!!w || !!block} onClick={() => onPickWire(id)}>
                      <span className="picker__name">{WIRES[id].label}</span>
                      <span className="cable-drawer__swatch" aria-hidden="true">
                        {WIRES[id].colors.map((col, i) => <i key={i} style={{ background: col }} />)}
                      </span>
                      <span className="picker__state">
                        {w
                          ? `${labels ? `On ${headerName(w.at, headers)}` : "Plugged in"} (click its plug to pull it off)` // no tick: right or wrong shows at power on
                          : activeWire === id
                          ? "Connecting…"
                          : block
                          ? block.msg
                          : `${WIRES[id].look[0].toUpperCase()}${WIRES[id].look.slice(1)}.`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function End({ label, done }) {
  return <em className={done ? "is-done" : ""}>{done ? `${label} ✓` : label}</em>;
}
