// TEMP-DEVTEST: visits made up for the last 30 days (school hours busier), nothing written.
export { DAY_MS, hoursOf, byDay, byHour } from "/src/lab/Visits.js?real";
import { DAY_MS, hoursOf } from "/src/lab/Visits.js?real";
export const recordVisit = async () => {};
export async function loadVisits(days) {
  const today = Math.floor(Date.now() / DAY_MS);
  const out = [];
  for (let d = today - days; d <= today; d += 1) {
    const data = {};
    const weekday = new Date(d * DAY_MS).getUTCDay();
    for (let h = 0; h < 24; h += 1) {
      const local = (h + 8) % 24; // Manila
      const school = weekday !== 0 && weekday !== 6 && local >= 7 && local <= 18;
      const n = Math.round((school ? 6 : 0.6) * (0.5 + ((d * 31 + h * 17) % 10) / 10));
      if (n) data["h" + h] = n;
    }
    out.push(...hoursOf(d, data));
  }
  return out.filter((e) => e.at.getTime() <= Date.now());
}
