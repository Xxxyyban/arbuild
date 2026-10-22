// Side panel with the facts of one part, opened by clicking it on the bench or in the picker.
// The instructor can turn it off (setup.partInfo) so students work it out themselves.
// Styles: styles/BuildLab.css (.partinfo*).
import { CATALOG } from "../../lab/Catalog";
import { PARTS } from "../../Three/ar/partInfo";
import { CategoryIcon } from "./PartPicker";

export default function PartInfoPanel({ itemId, mode, onClose }) {
  const item = CATALOG[itemId];
  if (!item) return null;
  const guide = PARTS[item.category] || {};
  const steps = guide.steps || [];

  return (
    <aside className="partinfo" aria-label={`${item.name} details`} onPointerDown={(e) => e.stopPropagation()}>
      <header className="partinfo__head">
        <span className="partinfo__icon"><CategoryIcon id={item.category} size={20} /></span>
        <div>
          <span className="partinfo__tag">{guide.tag || item.category}</span>
          <h2>{item.name}</h2>
        </div>
        <button type="button" className="picker__close" aria-label="Close" onClick={onClose}>×</button>
      </header>

      <div className="partinfo__body">
        {item.specs?.length > 0 && (
          <dl className="partinfo__specs">
            {item.specs.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
        {item.note && <p className="partinfo__note">{item.note}</p>}

        {guide.what && (
          <section>
            <h3>What it does</h3>
            <p>{guide.what}</p>
          </section>
        )}

        {steps.length > 0 && (
          <section>
            <h3>{mode === "disassemble" ? "How it went in (undo it in reverse)" : "How to install it"}</h3>
            <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </section>
        )}

        {(guide.dos?.length > 0 || guide.donts?.length > 0) && (
          <section className="partinfo__rules">
            {guide.dos?.map((d) => <p key={d} className="is-do"><b>Do</b>{d}</p>)}
            {guide.donts?.map((d) => <p key={d} className="is-dont"><b>Don't</b>{d}</p>)}
          </section>
        )}
      </div>
    </aside>
  );
}
