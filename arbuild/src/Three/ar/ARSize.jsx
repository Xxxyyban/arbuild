// The AR size buttons, beside the pinch: bigger, the size as a percentage, smaller, back to 100%.
// Used by the Build Lab, the Rig Studio and Marker AR. Styles: styles/ARSize.css.
import Icon from "../../components/Icon";
import { MIN_SCALE, MAX_SCALE } from "./twoFinger";
import "../../styles/ARSize.css";

/** size: 1 = as placed. onBy(factor) grows or shrinks it; onReset() puts it back to 1. */
export default function ARSize({ size, onBy, onReset, label = "Size" }) {
  return (
    <div className="ar-size" role="group" aria-label={label}>
      <button type="button" aria-label="Make it bigger" disabled={size >= MAX_SCALE} onClick={() => onBy(1.25)}>
        <Icon name="plus" size={20} />
      </button>
      <span className="ar-size__value" aria-live="polite">{Math.round(size * 100)}%</span>
      <button type="button" aria-label="Make it smaller" disabled={size <= MIN_SCALE} onClick={() => onBy(0.8)}>
        <Icon name="minus" size={20} />
      </button>
      <button type="button" aria-label="Back to the placed size" disabled={size === 1} onClick={onReset}>
        <Icon name="fit" size={18} />
      </button>
    </div>
  );
}
