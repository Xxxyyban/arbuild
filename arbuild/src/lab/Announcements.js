// The admin's announcements: to everyone, to students or to instructors. The admin portal posts them
// (components/admin/Announcements.jsx); everyone's bell shows the ones meant for them, with what their
// instructors announce in their classes.
//   announcements/{audience}/items/{id}   audience "all" | "students" | "faculty"
//                                          title, body, byUid, byName, createdAt (the server's time)
// Only the admin posts or removes one, as themselves; each person reads only their audiences' (firestore.rules).
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export const AUDIENCES = [
  { id: "all", label: "Everyone" },
  { id: "students", label: "Students" },
  { id: "faculty", label: "Instructors" },
];

const items = (audience) => collection(db, "announcements", audience, "items");

/** Posts an announcement. by: { uid, name } (their name as their profile has it). */
export async function postAnnouncement({ audience, title, body, by }) {
  const ref = doc(items(audience));
  await setDoc(ref, { title: title.trim(), body: body.trim(), byUid: by.uid, byName: by.name, createdAt: serverTimestamp() });
  return ref.id;
}

export const deleteAnnouncement = (audience, id) => deleteDoc(doc(db, "announcements", audience, "items", id));

/** One audience's announcements, newest first. */
export const subscribeAnnouncements = (audience, cb, onError, max = 30) =>
  onSnapshot(
    query(items(audience), orderBy("createdAt", "desc"), limit(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, audience, ...d.data({ serverTimestamps: "estimate" }) }))),
    onError
  );

// announcements stay listed in the bell this long
export const ANNOUNCED_DAYS = 14;

/** The admin's announcements as bell items: new ones are those after `seenAt` (ms). */
export function noticeItems(list, seenAt, now) {
  return list
    .map((a) => ({ a, at: a.createdAt?.toMillis?.() ?? 0 }))
    .filter(({ at }) => now - at < ANNOUNCED_DAYS * 864e5)
    .map(({ a, at }) => ({
      key: `notice/${a.audience}/${a.id}`,
      kind: "notice",
      announcement: true,
      at,
      unread: at > seenAt,
      who: { name: a.byName || "ARBuild admin", photo: "" },
      className: "From the admin",
      title: a.title,
      body: a.body,
      headline: `Announcement: ${a.title}`,
    }));
}

/** The audiences someone hears from: their own, and everyone's (the admin: all of them). */
export const audiencesFor = (role) => (role === "admin" ? ["all", "students", "faculty"] : role === "faculty" ? ["all", "faculty"] : ["all", "students"]);

/** The announcements someone hears from, newest first, live. */
export function useAnnouncements(role, max = 30) {
  const [byAudience, setByAudience] = useState({});
  const key = role ? audiencesFor(role).join(",") : "";
  useEffect(() => {
    if (!key) return undefined;
    const offs = key.split(",").map((aud) =>
      subscribeAnnouncements(aud, (list) => setByAudience((s) => ({ ...s, [aud]: list })), () => setByAudience((s) => ({ ...s, [aud]: [] })), max)
    );
    return () => offs.forEach((off) => off());
  }, [key, max]);
  const at = (a) => a.createdAt?.toMillis?.() ?? 0;
  return Object.values(byAudience).flat().sort((a, b) => at(b) - at(a));
}
