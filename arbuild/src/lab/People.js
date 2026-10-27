// Profile cards: what a class's instructor and students see of each other.
//   instructors/{uid}                 an instructor's card: name, department, email, photo. Their
//                                     students open it from a class (anyone signed in can read one:
//                                     an instructor's name is on every class they teach).
//   classes/{classId}/members/{uid}   a student's card is their member record in the class: name,
//                                     student ID, section, email, contact number, photo. Only the
//                                     class's instructor (and the student) can read it.
// Each person writes only their own card, copied from their profile, and firestore.rules checks
// every field against that profile, so no card shows a made-up name. A photo goes as a small
// thumbnail (photoThumb in the profile, made from the profile photo), never the full picture.
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";

const instructorRef = (uid) => doc(db, "instructors", uid);
const memberRef = (classId, uid) => doc(db, "classes", classId, "members", uid);

/** First and last name, as every card and class shows it ("" without them). */
export const fullName = (profile) => [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();

const same = (card, now) => Object.keys(card).every((k) => (now?.[k] ?? "") === card[k]);

/* ---------- instructors ---------- */

/** An instructor's card from their profile; null while they have no name to show. */
export function instructorCard(profile, user) {
  const name = fullName(profile);
  if (!name || !user?.uid) return null;
  return { uid: user.uid, name, department: profile.department || "", email: user.email || "", photo: profile.photoThumb || "" };
}

/** Writes an instructor's card if it isn't already the same as their profile. */
export async function syncInstructorCard(card) {
  const snap = await getDoc(instructorRef(card.uid));
  if (snap.exists() && same(card, snap.data())) return;
  await setDoc(instructorRef(card.uid), { ...card, updatedAt: serverTimestamp() });
}

/** An instructor's card as it changes (null if they have none yet). */
export const subscribeInstructorCard = (uid, cb) =>
  onSnapshot(
    instructorRef(uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null)
  );

/* ---------- students ---------- */

/** The card fields of a student's member record, from their profile. */
export function studentCard(profile) {
  return {
    name: fullName(profile),
    studentId: profile?.studentId || "",
    section: profile?.section || "",
    contactNumber: profile?.contactNumber || "",
    photo: profile?.photoThumb || "",
  };
}

/** Brings a student's member record in a class up to date with their profile, if it isn't. */
export async function syncStudentCard(classId, uid, card) {
  const snap = await getDoc(memberRef(classId, uid));
  if (!snap.exists() || same(card, snap.data())) return;
  await updateDoc(memberRef(classId, uid), card);
}

/* ---------- photos ---------- */

/**
 * A small square JPEG of a photo (a data: or https: address), for the cards: about 10 KB where
 * the profile photo can be 600. "" if the picture can't be read (another site that won't share it).
 */
export function makeThumb(src, size = 128) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

const thumbTried = new Set(); // photos already tried this visit, so one that can't be read isn't tried again
/**
 * A profile with a photo but no thumbnail yet (set before cards existed) gets one. Returns true when
 * it saved one: the cards then follow from the updated profile.
 */
export async function ensureThumb(profile, updateUserProfile) {
  const src = profile?.photoURL;
  if (!src || profile.photoThumb || thumbTried.has(src)) return false;
  thumbTried.add(src);
  const photoThumb = await makeThumb(src);
  if (!photoThumb) return false;
  await updateUserProfile({ photoThumb });
  return true;
}
