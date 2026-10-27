// A person's round picture: their photo (a profile card's thumbnail, lab/People.js), or their
// initials. badge: an icon in a small circle on its corner (what a post or notification is).
// Styles: styles/Classes.css (.avatar).
import Icon from "../Icon";

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export default function Avatar({ name, photo, size = 36, badge = null }) {
  return (
    <span className="avatar" style={{ "--avatar-size": `${size}px` }} aria-hidden="true">
      {photo ? <img className="avatar__photo" src={photo} alt="" /> : <span className="avatar__initials">{initials(name)}</span>}
      {badge && (
        <span className="avatar__badge">
          <Icon name={badge} size={Math.round(size * 0.3)} strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}
