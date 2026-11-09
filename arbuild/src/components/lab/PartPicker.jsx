// Packet Tracer style parts drawer: a rail of category icons, and the options for the open category.
// Picking an option lays that part on the bench. The tools are docked at the end of the rail, not on the
// bench: the thermal paste (pressing it picks the tube up) and the cables (pressing it opens the Cables
// drawer, components/lab/CableDrawer.jsx). Styles: styles/BuildLabParts.css (.picker*).
import { useState } from "react";
import { CATEGORIES, OPTIONAL_SLOTS, optionsFor, badgesFor } from "../../lab/Catalog";
import Icon from "../Icon";
import { useSizeVar } from "./useSizeVar";

// Headings when a category fills more than one slot (RAM), and the "leave it out" choice
// for parts a build can do without.
const SLOT_HEADING = { ram1: "Stick 1", ram2: "Stick 2 (optional)" };
const NONE_LABEL = {
  ram2: "No second stick (run on one stick)",
  gpu: "No graphics card (use the CPU's built-in graphics)",
};

const ICON_PATHS = {
  motherboard: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="6" height="6" />
      <path d="M16 7v10M18.5 7v10M7 16.5h6" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </>
  ),
  ram: (
    <>
      <rect x="2" y="7" width="20" height="9" rx="1" />
      <path d="M5 10h3v3H5zM10.5 10h3v3h-3zM16 10h3v3h-3zM5 16v2M8 16v2M11 16v2M15 16v2M19 16v2" />
    </>
  ),
  cpu_cooler: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10c0-3 2-5 4-5M14 12c3 0 5 2 5 4M12 14c0 3-2 5-4 5M10 12c-3 0-5-2-5-4" />
    </>
  ),
  storage: (
    <>
      <rect x="2" y="8" width="20" height="8" rx="1" />
      <path d="M5 11h6M5 13h4M19 10v4" />
    </>
  ),
  gpu: (
    <>
      <rect x="2" y="5" width="20" height="11" rx="1.5" />
      <circle cx="8" cy="10.5" r="3" />
      <circle cx="16" cy="10.5" r="3" />
      <path d="M5 16v3h9v-3" />
    </>
  ),
  psu: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <circle cx="10" cy="12" r="4" />
      <path d="M10 8v8M6 12h8M17 9v6" />
    </>
  ),
  // a syringe of paste: tip down to the left, plunger up to the right
  paste: (
    <>
      <path d="M4.2 16.2l9-9 3.6 3.6-9 9z" />
      <path d="M12 6l6 6M15 9l4-4M17.5 3.5l3 3M6 18l-3 3M7.2 13.2l3.6 3.6" />
    </>
  ),
  // a plug and its cable
  cables: (
    <>
      <path d="M6 3v4M10 3v4" />
      <path d="M4 7h8v3a4 4 0 0 1-8 0V7z" />
      <path d="M8 14v3a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V4" />
    </>
  ),
};

export function CategoryIcon({ id, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[id]}
    </svg>
  );
}

/**
 * picks      { motherboard: "mb_b550", ram1: "ram_ddr4", ram2: null, ... } what is on the bench now, by slot
 * locked     slot -> reason string, for slots that can't be swapped right now
 * showSpecs  false hides the socket / memory / watt badges (instructor turned part info off)
 * onPick(slot, id | null), onInspect(id)
 * parts      false: the parts are laid out already (an auto-picked task), the rail has only the tools
 * paste      the thermal paste at the end of the rail: { applied, ready (the CPU is in and the cooler
 *            isn't), waiting (hints: it's next), disabled }; onPaste() picks the tube up
 * cables     beside it: { open (the drawer, or a cable on its way), done, dim (nothing to connect yet, it
 *            still opens and says why), disabled }; onCables() opens or closes the drawer
 * onOpenPart a part's options are opening (they take the place of the Cables drawer)
 */
export default function PartPicker({ picks, locked = {}, showSpecs, onPick, onInspect, parts = true, paste = null, onPaste, cables = null, onCables, onOpenPart }) {
  const [open, setOpen] = useState(null);
  const railRef = useSizeVar("--lab-pick-h"); // the overlays under the strip on a phone clear it
  const cat = CATEGORIES.find((c) => c.id === open);
  const options = open ? optionsFor(open) : [];

  return (
    <div className={parts ? "picker" : "picker is-tools-only"} onPointerDown={(e) => e.stopPropagation()}>
      <div className="picker__rail" role="toolbar" aria-label="Parts" ref={railRef}>
        {parts && CATEGORIES.map((c) => {
          const has = c.slots.some((s) => picks[s]);
          return (
            <button
              key={c.id}
              type="button"
              className={["picker__cat", open === c.id ? "is-open" : "", has ? "is-picked" : ""].join(" ").trim()}
              aria-pressed={open === c.id}
              title={has ? `${c.label}: picked` : `${c.label}: not picked yet`}
              onClick={() => {
                onOpenPart?.();
                setOpen(open === c.id ? null : c.id);
              }}
            >
              <CategoryIcon id={c.id} />
              <span className={c.short ? "picker__label has-short" : "picker__label"}>{c.label}</span>
              {c.short && <span className="picker__short">{c.short}</span>}
              {has && <i className="picker__dot" aria-hidden="true" />}
            </button>
          );
        })}
        {paste && (
          <>
            {parts && <span className="picker__rule" aria-hidden="true" />}
            <button
              type="button"
              className={["picker__cat", paste.applied ? "is-picked" : "", paste.waiting ? "is-waiting" : "", paste.ready || paste.applied ? "" : "is-dim"]
                .join(" ")
                .trim()}
              disabled={!!paste.disabled}
              title={
                paste.applied
                  ? "Thermal paste: on the CPU"
                  : paste.ready
                  ? "Thermal paste: pick it up and put it on the CPU"
                  : "Thermal paste: it goes on the CPU, before the cooler"
              }
              onClick={() => {
                setOpen(null);
                onPaste();
              }}
            >
              <CategoryIcon id="paste" />
              <span className="picker__label">Paste</span>
              {paste.applied && <i className="picker__dot" aria-hidden="true" />}
            </button>
          </>
        )}
        {cables && (
          <button
            type="button"
            className={["picker__cat", cables.open ? "is-open" : "", cables.done ? "is-picked" : "", cables.dim && !cables.open ? "is-dim" : ""].join(" ").trim()}
            aria-pressed={cables.open}
            disabled={!!cables.disabled}
            title={cables.done ? "Cables: all connected" : "Cables: connect the PSU cables, and the case's and fans' wires"}
            onClick={() => {
              setOpen(null);
              onCables();
            }}
          >
            <CategoryIcon id="cables" />
            <span className="picker__label">Cables</span>
            {cables.done && <i className="picker__dot" aria-hidden="true" />}
          </button>
        )}
      </div>

      {open && (
        <div className="picker__drawer">
          <div className="picker__head">
            <strong>{cat.label}</strong>
            <button type="button" className="picker__close" aria-label="Close" onClick={() => setOpen(null)}><Icon name="x" size={16} /></button>
          </div>
          {cat.slots.map((slot) => (
            <div key={slot} className="picker__slot">
              {cat.slots.length > 1 && <h3 className="picker__slot-head">{SLOT_HEADING[slot] || slot}</h3>}
              {locked[slot] && <p className="picker__locked">{locked[slot]}</p>}
              <ul className="picker__list">
                {options.map((o) => {
                  const chosen = picks[slot] === o.id;
                  return (
                    <li key={o.id} className={chosen ? "is-chosen" : ""}>
                      <button
                        type="button"
                        className="picker__option"
                        disabled={!!locked[slot]}
                        onClick={() => {
                          onPick(slot, o.id);
                          if (!chosen && cat.slots.length === 1) setOpen(null);
                        }}
                      >
                        <span className="picker__name">{o.name}</span>
                        {showSpecs && (
                          <span className="picker__badges">
                            {badgesFor(o).map((b) => <em key={b}>{b}</em>)}
                          </span>
                        )}
                        <span className="picker__state">{chosen ? "On the bench" : "Place on bench"}</span>
                      </button>
                      {showSpecs && (
                        <button type="button" className="picker__info" aria-label={`About ${o.name}`} onClick={() => onInspect(o.id)}><Icon name="info" size={15} /></button>
                      )}
                    </li>
                  );
                })}
                {OPTIONAL_SLOTS.includes(slot) && (
                  <li className={!picks[slot] ? "is-chosen" : ""}>
                    <button type="button" className="picker__option" disabled={!!locked[slot]} onClick={() => onPick(slot, null)}>
                      <span className="picker__name">{NONE_LABEL[slot]}</span>
                      <span className="picker__state">{!picks[slot] ? "Chosen" : "Leave it out"}</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
