// TEMP-DEVTEST: the class API (lab/Classes.js) on the shared in-memory store.
export { when, toMs, fileSize, fixUrl, personName, shownName, MAX_FILE_MB, inviteLink } from "/src/lab/Classes.js?real";
import { store, sub, save, now } from "./store.js";

const list = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
let n = 0;
const newId = () => `x${Date.now().toString(36)}${n++}`;
export const classRef = (id) => ({ __class: id });

export const subscribeMyClasses = (uid, cb) => sub(() => cb(list(store.classes).filter((c) => c.instructorUid === uid)));
export const subscribeClass = (id, cb) => sub(() => cb(store.classes[id] ? { id, ...store.classes[id] } : null));
export const subscribeMembers = (id, cb) => sub(() => cb(list(store.members[id])));
export const subscribeMember = (id, uid, cb) => sub(() => cb(store.members[id]?.[uid] || null));
export const subscribePosts = (id, cb) => sub(() => cb(list(store.posts[id])));
export const subscribeComments = (id, postId, cb) => sub(() => cb(list(store.comments[`${id}/${postId}`])));
export const subscribeThreads = (id, cb) => sub(() => cb(list(store.threads[id])));
export const subscribeThread = (id, uid, cb) => sub(() => cb(store.threads[id]?.[uid] || null));
export const subscribeMessages = (id, uid, cb) => sub(() => cb(list(store.messages[`${id}/${uid}`])));
export const subscribeMyMemberships = (uid, cb) => sub(() => cb(list(store.memberships[uid])));
export const subscribeClassLabs = (id, instructorUid, cb) => sub(() => cb(list(store.labs).filter((l) => l.classId === id)));

export async function resolveCode(code) {
  if (store.codes[code]) return { kind: "class", classId: store.codes[code] };
  if (store.labs[code]) return { kind: "lab", code, session: store.labs[code] };
  return null;
}
export const classIdForCode = async (code) => store.codes[code] || null;

export async function joinClass(code, user, profile) {
  const id = store.codes[code];
  if (!id) return { error: "No class has that code. Check it with your instructor." };
  const cls = store.classes[id];
  if (!store.members[id][user.uid] && store.removed?.[id]?.[user.uid]) return { error: "Your instructor removed you from this class. Ask them if you need to be let back in." };
  if (!store.members[id][user.uid]) {
    store.members[id][user.uid] = { uid: user.uid, name: `${profile.firstName} ${profile.lastName}`, email: user.email, studentId: profile.studentId, section: profile.section, joinedAt: now(), seenStreamAt: now() };
    cls.studentCount++;
  }
  (store.memberships[user.uid] ||= {})[id] = { classId: id, name: cls.name, section: cls.section, code, instructorName: cls.instructorName, joinedAt: now() };
  save();
  return { classId: id, cls };
}
export async function attachLab(session, cls, author) {
  store.labs[session.code].classId = cls.id;
  (store.posts[cls.id] ||= {})[newId()] = { kind: "lab", title: session.title, body: "", links: [], files: [], sessionCode: session.code, pinned: false, authorUid: author.uid, authorName: author.name, commentCount: 0, createdAt: now() };
  save();
}
export async function createClass({ instructor, name, section, schedule, color }) {
  const id = newId();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  store.classes[id] = { name, section, schedule, color, code, instructorUid: instructor.uid, instructorName: instructor.name, joinOpen: true, archived: false, studentCount: 0, createdAt: now(), lastPostAt: null };
  store.codes[code] = id;
  store.members[id] = {};
  save();
  return id;
}
export async function updateClass(id, patch) {
  Object.assign(store.classes[id], patch);
  save();
}
export async function syncInstructorName(uid, name) {
  for (const c of list(store.classes)) if (c.instructorUid === uid && c.instructorName !== name) await updateClass(c.id, { instructorName: name });
}
export async function newClassCode(id) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  store.classes[id].code = code;
  store.codes[code] = id;
  save();
  return code;
}
export async function removeMember(id, uid) {
  delete store.members[id][uid];
  store.classes[id].studentCount--;
  save();
}
export async function leaveClass(id, uid) {
  delete store.members[id][uid];
  delete store.memberships[uid][id];
  save();
}
export async function createPost(id, { kind, title, body, links = [], sessionCode = null, author }) {
  (store.posts[id] ||= {})[newId()] = { kind, title, body, links, files: [], sessionCode, pinned: false, authorUid: author.uid, authorName: author.name, commentCount: 0, createdAt: now() };
  store.classes[id].lastPostAt = now();
  save();
}
export async function updatePost(id, postId, patch) {
  Object.assign(store.posts[id][postId], patch);
  save();
}
export async function deletePost(id, post) {
  delete store.posts[id][post.id];
  save();
}
export async function addComment(id, postId, { text, author }) {
  (store.comments[`${id}/${postId}`] ||= {})[newId()] = { text, authorUid: author.uid, authorName: author.name, fromInstructor: !!author.instructor, createdAt: now() };
  const post = store.posts[id][postId];
  post.commentCount++;
  Object.assign(post, { lastCommentAt: now(), lastCommentByUid: author.uid, lastCommentByName: author.name });
  save();
}
export async function deleteComment() {}
export const markStreamSeen = async (id, uid) => {
  if (store.members[id]?.[uid]) {
    store.members[id][uid].seenStreamAt = now();
    save();
  }
};
export async function sendMessage(id, studentUid, { text, from }) {
  (store.messages[`${id}/${studentUid}`] ||= {})[newId()] = { text, from: from.uid, fromName: from.name, createdAt: now() };
  const th = ((store.threads[id] ||= {})[studentUid] ||= { studentUid, readAt: {} });
  Object.assign(th, { lastAt: now(), lastText: text, lastFrom: from.uid });
  th.readAt = { ...th.readAt, [from.uid]: now() };
  save();
}
export const markThreadRead = async () => {};
export async function joinByCode(code, user, profile) {
  const res = await joinClass(code, user, profile);
  return res.error ? { error: res.error } : { to: `/classes/${res.classId}` };
}

// TEMP-DEVTEST: the class record and removals
const logIt = (id, entry) => {
  const logId = entry.id || newId();
  delete entry.id;
  ((store.log ||= {})[id] ||= {})[logId] = { ...entry, at: now() };
  return logId;
};
export const removedRef = (id, uid) => ({ __removed: id, uid });
export async function removeStudent(id, member, { by, reason = "" }) {
  const uid = member.id || member.uid;
  const logId = logIt(id, { type: "removed", byUid: by.uid, byName: by.name, studentUid: uid, studentName: member.name, studentId: member.studentId || "", reason });
  ((store.removed ||= {})[id] ||= {})[uid] = { uid, name: member.name, studentId: member.studentId || "", reason, byUid: by.uid, logId, removedAt: now() };
  delete store.members[id][uid];
  store.classes[id].studentCount--;
  save();
}
export async function readmitStudent(id, removed, { by }) {
  const uid = removed.id || removed.uid;
  logIt(id, { id: "readmit-" + removed.logId, type: "readmitted", byUid: by.uid, byName: by.name, studentUid: uid, studentName: removed.name, studentId: removed.studentId || "", reason: "" });
  delete store.removed[id][uid];
  save();
}
export async function endClass(cls, { by }) {
  const logId = logIt(cls.id, { type: "ended", byUid: by.uid, byName: by.name });
  Object.assign(store.classes[cls.id], { archived: true, endedAt: now(), logId });
  for (const l of Object.values(store.labs)) if (l.classId === cls.id && l.status !== "closed") Object.assign(l, { status: "closed", closedAt: now() });
  save();
}
export async function reopenClass(cls, { by }) {
  const logId = logIt(cls.id, { type: "reopened", byUid: by.uid, byName: by.name });
  Object.assign(store.classes[cls.id], { archived: false, endedAt: null, logId });
  save();
}
export const subscribeClassLog = (id, cb) => sub(() => cb(list(store.log?.[id]).sort((a, b) => b.at.toMillis() - a.at.toMillis())));
export const subscribeRemoved = (id, cb) => sub(() => cb(list(store.removed?.[id])));
export const subscribeMyRemoval = (id, uid, cb) => sub(() => cb(store.removed?.[id]?.[uid] || null));

// TEMP-DEVTEST: the instructor's bell
export const subscribeRecentJoins = (id, since, cb) => sub(() => cb(list(store.members[id]).filter((m) => m.joinedAt?.toMillis() > since)));
export const subscribeRecentComments = (id, since, cb) => sub(() => cb(list(store.posts[id]).filter((p) => p.lastCommentAt?.toMillis() > since)));
export async function markClassAlertsSeen(id) {
  store.classes[id].instructorSeenAt = now();
  save();
}
