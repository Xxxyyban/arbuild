// The Rig Studio's guide (pages/Main.jsx): the build's parts, each part's slots, headers and ports,
// and what each pin of a header or plug carries. Styles: styles/RigStudio.css (.rguide*, .pins*).
import { GUIDE, PIN_KINDS, guidePart, guideItem, partsFor, buildSummary, forPlatform, pinout } from "../../lab/PartGuide";
import Icon from "../Icon";

/** A header's or plug's pins, top row first, coloured by what they carry; a gap where one is missing. */
export function PinDiagram({ id }) {
  const p = pinout(id);
  if (!p) return null;
  const cols = Math.max(...p.rows.map((r) => r.length));
  return (
    <figure className="pins">
      <div className="pins__scroll">
        <div className="pins__grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(28px, 1fr))` }}>
          {p.rows.flatMap((row, r) =>
            row.map((pin, c) =>
              pin ? (
                <span key={`${r}-${c}`} className={`pins__pin ${pin[1] === "nc" ? "is-nc" : ""}`} title={`${pin[0]}: ${PIN_KINDS[pin[1]].label}`}>
                  <i style={{ background: PIN_KINDS[pin[1]].color }} />
                  <small>{pin[0]}</small>
                </span>
              ) : (
                <span key={`${r}-${c}`} className="pins__pin is-key" title="No pin here: the key that makes the plug fit one way">
                  <i />
                  <small>key</small>
                </span>
              )
            )
          )}
        </div>
      </div>
      <figcaption>
        <ul className="pins__legend">
          {p.kinds.map((k) => (
            <li key={k}>
              <i style={{ background: PIN_KINDS[k].color }} />
              {PIN_KINDS[k].label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** The build at a glance: each part, and whether the PSU has enough power. */
function Overview({ platform, onSelect }) {
  const s = buildSummary(platform);
  return (
    <>
      <div className="rguide__head">
        <span className="rguide__kicker">{s.platform} build</span>
        <h2>A complete gaming PC</h2>
      </div>
      <dl className="rguide__build">
        {s.rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="rguide__note">
        These parts need about <strong>{s.watts} W</strong>; the power supply gives {s.psuWatts} W.
      </p>
      <h3 className="rguide__sub">Pick a part, or tap one in the 3D view</h3>
      <ul className="rguide__list">
        {GUIDE.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => onSelect(g.id, null)}>
              <span>{g.title}</span>
              <Icon name="forward" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * platform        "am4" | "am5"
 * part, item      what's selected: a GUIDE id, and one of its sub-items (or null)
 * onSelect(part, item)   null part: back to the overview
 * compact         just the selection, for the sheet over the full-screen view and AR
 * folded, onFold  (the sheet) shows just the part's name, and its button folding or unfolding it
 */
export default function GuidePanel({ platform, part, item, onSelect, compact = false, folded = false, onFold, onClose }) {
  const g = guidePart(part);
  if (!g) {
    if (compact) return null;
    return (
      <div className="rguide">
        <Overview platform={platform} onSelect={onSelect} />
      </div>
    );
  }
  const product = guideItem(g, platform);
  const subs = partsFor(g, platform);
  const sub = item ? subs.find(([k]) => k === item)?.[1] : null;

  return (
    <div className={`rguide ${compact ? "rguide--compact" : ""}`}>
      <div className="rguide__nav">
        {sub ? (
          <button type="button" className="rguide__back" onClick={() => onSelect(g.id, null)}>
            <Icon name="back" size={16} />
            {g.title}
          </button>
        ) : (
          !compact && (
            <button type="button" className="rguide__back" onClick={() => onSelect(null, null)}>
              <Icon name="back" size={16} />
              All parts
            </button>
          )
        )}
        <span className="rguide__ends">
          {onFold && (
            <button
              type="button"
              className="rguide__close"
              aria-expanded={!folded}
              aria-label={folded ? "Show the details" : "Fold the details away"}
              title={folded ? "Show the details" : "Fold the details away"}
              onClick={onFold}
            >
              <Icon name={folded ? "up" : "down"} size={16} />
            </button>
          )}
          {onClose && (
            <button type="button" className="rguide__close" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          )}
        </span>
      </div>

      {sub ? (
        <>
          <div className="rguide__head">
            <span className="rguide__kicker">{g.title}</span>
            <h2>{forPlatform(sub.title, platform)}</h2>
          </div>
          {!folded && <p className="rguide__text">{forPlatform(sub.text, platform)}</p>}
          {!folded && sub.pins && <PinDiagram id={sub.pins} />}
        </>
      ) : folded ? (
        <div className="rguide__head">
          {product && <span className="rguide__kicker">{product.name}</span>}
          <h2>{g.title}</h2>
        </div>
      ) : (
        <>
          <div className="rguide__head">
            {product && <span className="rguide__kicker">{product.name}</span>}
            <h2>{g.title}</h2>
          </div>
          <p className="rguide__text">{forPlatform(g.text, platform)}</p>
          {product?.specs && !compact && (
            <dl className="rguide__specs">
              {product.specs.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {subs.length > 0 && (
            <>
              <h3 className="rguide__sub">{g.id === "motherboard" ? "Slots, headers and ports" : g.id === "cables" ? "Each cable" : "Up close"}</h3>
              <ul className="rguide__list rguide__list--sub">
                {subs.map(([k, s]) => (
                  <li key={k}>
                    <button type="button" onClick={() => onSelect(g.id, k)}>
                      <span>{forPlatform(s.title, platform)}</span>
                      {s.marker ? <Icon name="pin" size={15} /> : <Icon name="forward" size={15} />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
