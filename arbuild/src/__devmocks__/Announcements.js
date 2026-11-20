// TEMP-DEVTEST: lab/Announcements.js on the shared in-memory store.
export { AUDIENCES, ANNOUNCED_DAYS, ADMIN_NAME, announcedBy, noticeItems, audiencesFor } from "/src/lab/Announcements.js?real";
import { useEffect, useState } from "react";
import { audiencesFor, announcedBy } from "/src/lab/Announcements.js?real";
import { store, sub, save, now } from "./store.js";

const list = (aud) => Object.entries(store.announcements?.[aud] || {}).map(([id, a]) => ({ id, audience: aud, ...a })).sort((x, y) => y.createdAt.toMillis() - x.createdAt.toMillis());
export async function postAnnouncement({ audience, title, body, by }) {
  const id = "a" + Date.now().toString(36);
  ((store.announcements ||= {})[audience] ||= {})[id] = { title: title.trim(), body: body.trim(), byUid: by.uid, byName: announcedBy({ byName: by.name }), createdAt: now() };
  save();
  return id;
}
export async function deleteAnnouncement(audience, id) {
  delete store.announcements[audience][id];
  save();
}
export const subscribeAnnouncements = (audience, cb) => sub(() => cb(list(audience)));
export function useAnnouncements(role) {
  const [all, setAll] = useState([]);
  const key = role ? audiencesFor(role).join(",") : "";
  useEffect(() => (key ? sub(() => setAll(key.split(",").flatMap(list).sort((x, y) => y.createdAt.toMillis() - x.createdAt.toMillis()))) : undefined), [key]);
  return all;
}
