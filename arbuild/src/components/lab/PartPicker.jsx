// Packet Tracer style parts drawer: a rail of category icons, and the options for the open category.
// Picking an option lays that part on the bench. Styles: styles/BuildLab.css (.picker*).
import { useState } from "react";
import { CATEGORIES, optionsFor, badgesFor } from "../../lab/Catalog";

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
};

export function CategoryIcon({ id, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[id]}
    </svg>
  );
}

/**
 * picks      { motherboard: "mb_b550", ... } what is on the bench now
 * locked     category -> reason string, for categories that can't be swapped right now
 * showSpecs  false hides the socket / memory / watt badges (instructor turned part info off)
 * onPick(category, id), onInspect(id)
 */
export default function PartPicker({ picks, locked = {}, showSpecs, onPick, onInspect }) {
  const [open, setOpen] = useState(null);
  const options = open ? optionsFor(open) : [];

  return (
    <div className="picker" onPointerDown={(e) => e.stopPropagation()}>
      <div className="picker__rail" role="toolbar" aria-label="Parts">
        {CATEGORIES.map((c) => {
          const has = !!picks[c.id];
          return (
            <button
              key={c.id}
              type="button"
              className={["picker__cat", open === c.id ? "is-open" : "", has ? "is-picked" : ""].join(" ").trim()}
              aria-pressed={open === c.id}
              title={has ? `${c.label}: picked` : `${c.label}: not picked yet`}
              onClick={() => setOpen(open === c.id ? null : c.id)}
            >
              <CategoryIcon id={c.id} />
              <span>{c.label}</span>
              {has && <i className="picker__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="picker__drawer">
          <div className="picker__head">
            <strong>{CATEGORIES.find((c) => c.id === open).label}</strong>
            <button type="button" className="picker__close" aria-label="Close" onClick={() => setOpen(null)}>×</button>
          </div>
          {locked[open] && <p className="picker__locked">{locked[open]}</p>}
          <ul className="picker__list">
            {options.map((o) => {
              const chosen = picks[open] === o.id;
              return (
                <li key={o.id} className={chosen ? "is-chosen" : ""}>
                  <button
                    type="button"
                    className="picker__option"
                    disabled={!!locked[open]}
                    onClick={() => {
                      onPick(open, o.id);
                      if (!chosen) setOpen(null);
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
                    <button type="button" className="picker__info" aria-label={`About ${o.name}`} onClick={() => onInspect(o.id)}>i</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
