// When a student's lab progress is saved (lab/useLabSession.js). Every save is a database write, and
// costs two reads besides (firestore.rules looks up the lab and the account); the free plan allows the
// whole school 20,000 writes and 50,000 reads a day. So: at most one save every GAP while they work,
// straight away when they finish, and a "still here" once nothing has been saved for BEAT.
// Pure: no React, no Firebase (tests/lab/cordcheck.mjs runs it on a made-up clock).

export const BURST = 800; // ms: a burst of changes is one save
export const GAP = 30000; // ms between saves while working
export const BEAT = 60000; // ms of nothing saved before a "still here" (the monitor calls 90 s idle: LabMonitor.jsx)
export const BEAT_CHECK = 15000; // ms: how often useLabSession asks beat()

/**
 * write(data) saves the row. The clock is only passed in by tests.
 * push(data): the row as it should be now. beat(): asked every BEAT_CHECK. flush(): leaving the page.
 */
export function createRowSaver(write, { now = () => Date.now(), later = setTimeout, cancel = clearTimeout } = {}) {
  let latest = null; // what the row should say
  let dirty = false; // not saved yet
  let last = 0; // when the last save went out
  let timer = null;

  const save = (data) => {
    cancel(timer);
    timer = null;
    dirty = false;
    last = now();
    write(data);
  };

  return {
    push(data) {
      // finishing the task or a phase is a result: it doesn't wait its turn
      const urgent = !!latest && (data.taskDone !== latest.taskDone || data.phaseDone !== latest.phaseDone);
      latest = data;
      dirty = true;
      if (timer && !urgent) return; // a save is on its way, and it takes the latest
      cancel(timer);
      timer = later(() => save(latest), urgent ? BURST : Math.max(BURST, last + GAP - now()));
    },
    // not once the task is done: the monitor shows "Task done" whatever the time, and a finished
    // student's tab left open for the rest of the class would keep writing
    beat() {
      if (!timer && !latest?.taskDone && now() - last >= BEAT) save({});
    },
    flush() {
      if (dirty) save(latest);
    },
    stop() {
      cancel(timer);
      timer = null;
      dirty = false;
    },
  };
}
