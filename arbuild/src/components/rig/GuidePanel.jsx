// The Rig Studio's guide (pages/Main.jsx): the build's parts, each part's slots, headers and ports,
// and what each pin of a header or plug carries. Beside the 3D view it's as tall as the view: its top
// and foot stay put and its middle scrolls. Styles: styles/RigStudio.css (.rguide*, .pins*).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GUIDE, PIN_KINDS, KIND_INFO, pinInfo, guidePart, guideItem, partsFor, buildSummary, forPlatform, pinout, sentences, shortTitle } from "../../lab/PartGuide";
import Icon from "../Icon";

/**
 * The pop-up beside a pin or a colour in the legend: what it is and what it does. It opens while the
 * mouse is on it, while it has the keyboard's focus, or on a tap (phones have no mouse). Drawn on the
 * page itself, so the guide's scrolling middle doesn't cut it off.
 */
function PinTip({ tip }) {
  if (!tip) return null;
  const W = 260;
  const left = Math.min(Math.max(tip.x, W / 2 + 8), window.innerWidth - W / 2 - 8);
  const below = tip.top < 150; // no room above: open under it
  return createPortal(
    <div
      className={`pintip ${below ? "is-below" : ""}`}
      role="tooltip"
      id="pintip"
      style={{ left, top: below ? tip.bottom + 8 : tip.top - 8, width: W }}
    >
      <strong>
        {tip.color && <i style={{ background: tip.color }} />}
        {tip.title}
        {tip.kind && <em>{tip.kind}</em>}
      </strong>
      <span>{tip.text}</span>
    </div>,
    document.body
  );
}

/** Opens a PinTip on hover, focus and tap. info: { title, kind, color, text }. */
function tipProps(info, tip, setTip) {
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ ...info, x: r.left + r.width / 2, top: r.top, bottom: r.bottom, el: e.currentTarget });
  };
  const hide = () => setTip(null);
  return {
    tabIndex: 0,
    "aria-describedby": tip?.title === info.title && tip?.text === info.text ? "pintip" : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onClick: show, // a tap on a phone; tapping anywhere else closes it again (blur)
    onKeyDown: (e) => e.key === "Escape" && hide(),
  };
}

/** One pin, coloured by what it carries; a gap where one is missing. */
function Pin({ pin, plug, tip, setTip }) {
  if (!pin) {
    const info = { title: "Key (no pin)", text: "No pin here on purpose: the plug's blocked hole lines up with it, so the plug fits only one way round." };
    return (
      <span className="pins__pin is-key" {...tipProps(info, tip, setTip)}>
        <i />
        <small>key</small>
      </span>
    );
  }
  const kind = PIN_KINDS[pin[1]];
  const info = { title: pin[0], kind: pin[1] === "nc" ? "" : kind.label, color: pin[1] === "nc" ? "" : kind.color, text: pinInfo(plug, pin[0]) };
  return (
    <span className={`pins__pin ${pin[1] === "nc" ? "is-nc" : ""}`} aria-label={`${pin[0]}: ${kind.label}`} {...tipProps(info, tip, setTip)}>
      <i style={{ background: kind.color }} />
      <small>{pin[0]}</small>
    </span>
  );
}

/**
 * A header's or plug's pins, top row first. A long plug (the 24-pin) fits by standing on its side, a
 * quarter turn to the right, instead of scrolling sideways: its top row is then on the right.
 * Every pin and every colour in the legend says what it is when pointed at or tapped.
 */
export function PinDiagram({ id }) {
  const [tip, setTip] = useState(null);
  // the pop-up stays where it opened: close it once the guide or the page scrolls
  useEffect(() => {
    if (!tip) return undefined;
    const close = () => setTip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tip]);
  useEffect(() => setTip(null), [id]);
  const p = pinout(id);
  if (!p) return null;
  const cols = Math.max(...p.rows.map((r) => r.length));
  const tall = cols > 7;
  const pins = tall ? p.rows[0].flatMap((_, c) => [p.rows[1][c], p.rows[0][c]]) : p.rows.flat();
  return (
    <figure className="pins">
      <div className={`pins__grid ${tall ? "is-tall" : ""}`} style={tall ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(28px, 1fr))` }}>
        {pins.map((pin, i) => (
          <Pin key={i} pin={pin} plug={id} tip={tip} setTip={setTip} />
        ))}
      </div>
      <figcaption>
        <p className="pins__hint">Point at a pin or a colour to see what it does.</p>
        <ul className="pins__legend">
          {p.kinds.map((k) => (
            <li key={k} {...tipProps({ title: PIN_KINDS[k].label, color: PIN_KINDS[k].color, text: KIND_INFO[k] }, tip, setTip)}>
              <i style={{ background: PIN_KINDS[k].color }} />
              {PIN_KINDS[k].label}
            </li>
          ))}
        </ul>
      </figcaption>
      <PinTip tip={tip} />
    </figure>
  );
}

/** What's open: its picture, its name, and what it is in the build. */
function Head({ icon, title, note, headingRef }) {
  return (
    <div className="rguide__head">
      <span className="rguide__tile">
        <Icon name={icon} size={22} strokeWidth={1.8} />
      </span>
      <div>
        <h2 ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
        {note && <p>{note}</p>}
      </div>
    </div>
  );
}

/** A row that opens something. */
function Row({ icon, title, note, onClick }) {
  return (
    <li>
      <button type="button" className="rguide__row" onClick={onClick}>
        {icon && (
          <span className="rguide__tile">
            <Icon name={icon} size={20} strokeWidth={1.8} />
          </span>
        )}
        <span className="rguide__label">
          <b>{title}</b>
          {note && <small>{note}</small>}
        </span>
        <Icon name="chevron" size={16} />
      </button>
    </li>
  );
}

/** How much of what the power supply gives the build needs. */
function PowerMeter({ watts, supply }) {
  return (
    <div className="rguide__power">
      <div className="rguide__power-head">
        <span>Power needed</span>
        <strong>
          {watts} W <small>of {supply} W</small>
        </strong>
      </div>
      <div
        className="rguide__meter"
        role="meter"
        aria-label="Power needed"
        aria-valuemin={0}
        aria-valuemax={supply}
        aria-valuenow={watts}
        aria-valuetext={`${watts} watts of the ${supply} the power supply gives`}
      >
        <i style={{ width: `${Math.min(100, (watts / supply) * 100)}%` }} />
      </div>
    </div>
  );
}

/** The build at a glance: each part, and whether the PSU has enough power. */
function Overview({ platform, onSelect, headingRef }) {
  const s = buildSummary(platform);
  return (
    <>
      <div className="rguide__top">
        <Head icon="pcCase" title="A complete gaming PC" note={`${s.platform} build`} headingRef={headingRef} />
      </div>
      <div className="rguide__body">
        <p className="rguide__hint">Tap a part here or in the 3D view.</p>
        <ul className="rguide__rows">
          {GUIDE.map((g) => (
            <Row key={g.id} icon={g.icon} title={g.title} note={s.names[g.id] || g.note} onClick={() => onSelect(g.id, null)} />
          ))}
        </ul>
      </div>
      <div className="rguide__foot">
        <PowerMeter watts={s.watts} supply={s.psuWatts} />
      </div>
    </>
  );
}

/** A part's slots, headers, ports or cables, under headings when there are many. */
function SubList({ part, subs, platform, onSelect }) {
  const groups = part.groups
    ? part.groups.map(([label, keys]) => [label, subs.filter(([k]) => keys.includes(k))]).filter(([, list]) => list.length)
    : [["Up close", subs]];
  return (
    <>
      {subs.some(([, s]) => s.marker) && <p className="rguide__hint">Tap a ring on the 3D view, or pick one here.</p>}
      {groups.map(([label, list]) => (
        <section key={label} className="rguide__group">
          <h3 className="rguide__sub">{label}</h3>
          <ul className="rguide__rows rguide__rows--sub">
            {list.map(([k, s]) => (
              <Row key={k} title={forPlatform(s.title, platform)} onClick={() => onSelect(part.id, k)} />
            ))}
          </ul>
        </section>
      ))}
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
  const subs = g ? partsFor(g, platform) : [];
  const sub = item ? subs.find(([k]) => k === item)?.[1] : null;

  const root = useRef(null);
  const body = useRef(null);
  const heading = useRef(null);
  const pickedHere = useRef(false);

  // a new pick starts at its top; one made in the guide brings the keyboard along, to its heading
  useEffect(() => {
    body.current?.scrollTo(0, 0);
    root.current?.parentElement?.scrollTo(0, 0); // the sheet over the full-screen view scrolls itself
    if (pickedHere.current) heading.current?.focus({ preventScroll: true });
    pickedHere.current = false;
  }, [part, item]);

  const pick = (p, i = null) => {
    pickedHere.current = true;
    onSelect(p, i);
  };

  if (!g) {
    if (compact) return null;
    return (
      <div className="rguide" ref={root}>
        <Overview platform={platform} onSelect={pick} headingRef={heading} />
      </div>
    );
  }

  const product = guideItem(g, platform);
  const [lead, ...facts] = sentences(forPlatform(sub ? sub.text : g.text, platform));

  // the ones either side of this one, to step through without going back to the list
  const line = sub
    ? subs.map(([k, s]) => ({ part: g.id, item: k, title: shortTitle(forPlatform(s.title, platform)) }))
    : GUIDE.map((x) => ({ part: x.id, item: null, title: x.title }));
  const at = line.findIndex((x) => (sub ? x.item === item : x.part === g.id));
  const before = line[at - 1];
  const after = line[at + 1];

  return (
    <div className={`rguide ${compact ? "rguide--compact" : ""}`} ref={root}>
      <div className="rguide__top">
        {sub ? (
          <button type="button" className="rguide__back" onClick={() => pick(g.id, null)}>
            <Icon name="back" size={16} />
            {g.title}
          </button>
        ) : (
          !compact && (
            <button type="button" className="rguide__back" onClick={() => pick(null, null)}>
              <Icon name="back" size={16} />
              All parts
            </button>
          )
        )}
        {(onFold || onClose) && (
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
        )}
        <Head icon={g.icon} title={sub ? forPlatform(sub.title, platform) : g.title} note={buildSummary(platform).names[g.id]} headingRef={heading} />
      </div>

      {!folded && (
        <div className="rguide__body" ref={body}>
          <p className="rguide__lead">{lead}</p>
          {!sub && !compact && product?.specs && (
            <dl className="rguide__specs">
              {product.specs.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {facts.length === 1 && <p className="rguide__text">{facts[0]}</p>}
          {facts.length > 1 && (
            <ul className="rguide__facts">
              {facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          {sub?.pins && <PinDiagram id={sub.pins} />}
          {!sub && subs.length > 0 && <SubList part={g} subs={subs} platform={platform} onSelect={pick} />}
        </div>
      )}

      {!compact && (before || after) && (
        <nav className="rguide__foot rguide__steps" aria-label="Previous and next">
          {before && (
            <button type="button" onClick={() => pick(before.part, before.item)}>
              <Icon name="back" size={15} />
              <span>{before.title}</span>
            </button>
          )}
          {after && (
            <button type="button" className="is-next" onClick={() => pick(after.part, after.item)}>
              <span>{after.title}</span>
              <Icon name="forward" size={15} />
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
