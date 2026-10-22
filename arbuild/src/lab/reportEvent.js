// Collects mistake / safety / revert events in memory. In a class, BuildLab plugs
// Firestore in with reporter.setSink(labSession.sink).

// "compat" = tried to fit a part that doesn't match the board or the work order.
export const MISTAKE_TYPES = ["miss", "blocked", "safety", "revert", "penalty", "bootfail", "compat"];

export function createReporter({ sink = null, max = 1000 } = {}) {
  const queue = [];
  let sinkFn = sink;
  return {
    /** evt = { mode, type, part, detail, points } */
    report(evt) {
      const e = { ts: Date.now(), points: 0, ...evt };
      queue.push(e);
      if (queue.length > max) queue.shift();
      try {
        sinkFn?.(e);
      } catch (err) {
        console.error("reportEvent sink failed:", err);
      }
      return e;
    },
    setSink(fn) {
      sinkFn = fn;
    },
    getEvents: () => [...queue],
    clear() {
      queue.length = 0;
    },
  };
}

/** Counts for the instructor report: mistakes by part, by type, safety violations, reverts. */
export function summarizeEvents(events) {
  const out = { total: 0, byType: {}, byPart: {}, safety: 0, reverts: 0, pointsLost: 0 };
  for (const e of events) {
    if (!MISTAKE_TYPES.includes(e.type)) continue;
    out.total++;
    out.byType[e.type] = (out.byType[e.type] || 0) + 1;
    out.byPart[e.part] = (out.byPart[e.part] || 0) + 1;
    if (e.type === "safety") out.safety++;
    if (e.type === "revert") out.reverts++;
    if (e.points < 0) out.pointsLost += -e.points;
  }
  return out;
}