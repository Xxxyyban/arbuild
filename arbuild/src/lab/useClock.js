// The time, moving on: for what changes as time passes without anything else changing (a lab turning
// overdue when its due date passes, which day is today).
import { useEffect, useState } from "react";

/** The time in ms, updated every `ms` (a minute by default). */
export default function useClock(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
