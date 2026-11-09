// What the lab's PC screen says about itself (components/lab/MonitorStation.jsx): the greeting for the
// time of day, its status as a colour and a word, and all of it as a sentence for screen readers (the
// screen itself is only pixels in the 3D view). Pure functions: no React, no Three.js.

/** The greeting for this time of day, on the student's own clock. */
export function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  if (h >= 18 && h < 22) return "Good evening";
  return "Good night";
}

// green: all is well; yellow: on its way, or running with something to look at; red: it doesn't work
export const STATUS_COLOR = { good: "#34d399", warn: "#fbbf24", bad: "#f87171" };

/** The screen's status: { level, label }, or null while it's off. A word always goes with the colour. */
export function screenStatus(monitor) {
  switch (monitor?.status) {
    case "shuttingDown":
      return { level: "warn", label: "Shutting down" };
    case "booting":
      return { level: "warn", label: "Starting" };
    case "loading":
      return { level: "warn", label: "Busy" };
    case "hello":
      if (monitor.symptoms?.length) return { level: "warn", label: "Check the case" };
      if (monitor.lowRes) return { level: "warn", label: "Built-in graphics" };
      return { level: "good", label: "Running" };
    case "nosignal":
      return { level: "bad", label: "No picture" };
    case "post":
      return { level: "bad", label: "Won't start" };
    case "bsod":
      return { level: "bad", label: "Crashed" };
    default:
      return null;
  }
}

const sentence = (text) => (text ? ` ${text}` : "");
const ended = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** What the screen shows, as a sentence. */
export function screenSays(monitor, userName, date = new Date()) {
  switch (monitor?.status) {
    case "shuttingDown":
      return "The PC is shutting down.";
    case "booting":
      return "The PC is starting up.";
    case "loading":
      return "The PC is working on it.";
    case "hello": {
      const up = monitor.seconds ? `Your PC started in ${monitor.seconds} seconds.` : "Your PC is up and running.";
      const odd = (monitor.symptoms ?? []).map((s) => s.text).join(" ");
      return `${greetingFor(date)}, ${userName}. ${up}${sentence(monitor.safety)}${sentence(monitor.note)}${odd ? ` Check the case: ${odd}` : ""}`;
    }
    case "nosignal":
      return "The PC is on, but the screen says no signal.";
    case "post":
      return `The PC won't start. ${ended(monitor.title)}${sentence(monitor.detail)}${sentence(monitor.code)}`;
    case "bsod":
      return `The PC crashed. What failed: ${monitor.detail}${sentence(monitor.fix)}`;
    default:
      return "The PC is off.";
  }
}
