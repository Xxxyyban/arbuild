// The admin's sign-in log (pages/Admin.jsx, "Sign-ins"): when, from where and on what each account
// signed in (lab/SignIns.js). Everyone's newest first, a page at a time, or one account's whole
// history; and what stands out flagged: a new place or device, another country, a VPN.
import { useEffect, useMemo, useState } from "react";
import { FLAG_HELP, FLAG_TEXT, loadSignIns, loadSignInsOf, placeName, signInFlags } from "../../lab/SignIns";

const DAY = 864e5;
const RANGES = [
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["all", "All"],
];

const nameOf = (u, email) =>
  (u ? [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") : "") || u?.email || email || "Unknown account";

export function signInTime(at) {
  return at.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(at, now = Date.now()) {
  const s = Math.max(0, (now - at.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function since(range) {
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "week") return new Date(Date.now() - 7 * DAY);
  if (range === "month") return new Date(Date.now() - 30 * DAY);
  return null;
}

/**
 * users: the accounts (for their names and roles). who: one account's uid, or null for everyone;
 * onWho(uid | null) picks. onError(text) for a load that failed.
 */
export default function SignInLog({ users, who, onWho, onError }) {
  const [list, setList] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const byUid = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  async function load() {
    setLoading(true);
    try {
      if (who) {
        setList(await loadSignInsOf(who));
        setMore(false);
      } else {
        const page = await loadSignIns();
        setList(page.list);
        setMore(page.more);
      }
    } catch (err) {
      console.error("Failed to load sign-ins:", err);
      onError("Unable to load the sign-ins. Check your Firestore security rules.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOlder() {
    if (!list.length) return;
    setLoadingOlder(true);
    try {
      const page = await loadSignIns({ before: list[list.length - 1].at });
      setList((l) => [...l, ...page.list]);
      setMore(page.more);
    } catch (err) {
      console.error("Failed to load older sign-ins:", err);
      onError("Unable to load older sign-ins.");
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who]);

  const flags = useMemo(() => signInFlags(list), [list]);

  const shown = useMemo(() => {
    const from = since(range);
    const q = search.trim().toLowerCase();
    return list.filter((s) => {
      if (from && s.at < from) return false;
      if (flaggedOnly && !flags[s.id]) return false;
      if (!q) return true;
      const u = byUid[s.uid];
      return [nameOf(u, s.email), s.email, placeName(s), s.ip, s.isp, s.device, u?.studentId, u?.facultyId]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [list, range, search, flaggedOnly, flags, byUid]);

  const whoUser = who ? byUid[who] : null;
  const flaggedCount = Object.keys(flags).length;

  return (
    <section className="admin-panel">
      {who && (
        <div className="signin-who">
          <div>
            <strong>{nameOf(whoUser, list[0]?.email)}</strong>
            <span>{loading ? "Loading sign-ins..." : `${list.length} sign-in${list.length === 1 ? "" : "s"} recorded`}</span>
          </div>
          <button type="button" className="admin-ghost-btn" onClick={() => onWho(null)}>
            Everyone's sign-ins
          </button>
        </div>
      )}

      <div className="list-toolbar">
        <div className="admin-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, place, IP address or device"
          />
        </div>

        <div className="filter-chips" role="group" aria-label="When">
          {RANGES.map(([value, label]) => (
            <button key={value} type="button" className={range === value ? "active" : ""} onClick={() => setRange(value)}>
              {label}
            </button>
          ))}
        </div>

        <div className="filter-chips" role="group" aria-label="Which">
          <button type="button" className={!flaggedOnly ? "active" : ""} onClick={() => setFlaggedOnly(false)}>
            All
          </button>
          <button type="button" className={flaggedOnly ? "active" : ""} onClick={() => setFlaggedOnly(true)}>
            Flagged{flaggedCount ? ` (${flaggedCount})` : ""}
          </button>
        </div>

        <button type="button" className="admin-ghost-btn" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <p className="signin-note">
        Times are in your time zone. Places are approximate (city level), from the internet connection each
        sign-in came from; a VPN shows the VPN's place.
      </p>

      {loading ? (
        <div className="admin-empty">Loading sign-ins...</div>
      ) : list.length === 0 ? (
        <div className="admin-empty">
          {who
            ? "No sign-ins recorded for this account yet."
            : "No sign-ins recorded yet. Each sign-in is recorded from now on, as it happens."}
        </div>
      ) : shown.length === 0 ? (
        <div className="admin-empty">No sign-ins match. Try a different search or range.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table signin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Account</th>
                <th>Place</th>
                <th>Device</th>
                <th>Internet address</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const u = byUid[s.uid];
                const name = nameOf(u, s.email);
                const place = placeName(s);
                return (
                  <tr key={s.id} className={flags[s.id] ? "is-flagged" : ""}>
                    <td data-label="When" className="date-cell">
                      <div className="signin-lines">
                        <span>{signInTime(s.at)}</span>
                        <small>{timeAgo(s.at)}</small>
                      </div>
                    </td>

                    <td className="cell-account">
                      <div className="user-cell">
                        <div className="user-avatar">{(u?.firstName || s.email || "U").charAt(0).toUpperCase()}</div>
                        <div>
                          <button
                            type="button"
                            className="signin-name"
                            onClick={() => onWho(who === s.uid ? null : s.uid)}
                            title={who === s.uid ? "Back to everyone's sign-ins" : `Only ${name}'s sign-ins`}
                          >
                            {name}
                          </button>
                          <span>{s.email}</span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Place">
                      <div className="signin-lines">
                        <span>{place || "Unknown"}</span>
                        {flags[s.id] && (
                          <span className="signin-flags">
                            {flags[s.id].map((f) => (
                              <em key={f} className={`signin-flag ${f}`} title={FLAG_HELP[f]}>
                                {FLAG_TEXT[f]}
                              </em>
                            ))}
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Device">
                      <div className="signin-lines">
                        <span>{s.device || "Unknown"}</span>
                        {s.timezone && <small>Time zone: {s.timezone.replace(/_/g, " ")}</small>}
                      </div>
                    </td>

                    <td data-label="Internet address">
                      <div className="signin-lines">
                        <span>{s.ip || "Unknown"}</span>
                        {s.isp && <small>{s.isp}</small>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!who && more && !loading && (
        <div className="signin-more">
          <button type="button" className="admin-ghost-btn" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading..." : "Load older sign-ins"}
          </button>
        </div>
      )}
    </section>
  );
}
