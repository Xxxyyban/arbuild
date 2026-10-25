// Writes an element's height to a CSS variable on the lab root (.assemble), kept current as it
// changes, so the overlays that sit above or below it (the guide card, messages, the part info
// sheet) clear it however many rows it wraps to. The variable goes away with the element.
//
//   --lab-ctrl-h   the control panel (bottom)
//   --lab-pick-h   the parts strip (top, on a phone)
//   --lab-task-h   the guide card
//
// Returns a callback ref, so it follows an element that comes and goes: <div ref={useSizeVar(name)}>.
import { useCallback, useRef } from "react";

export function useSizeVar(name) {
  const stop = useRef(null);
  return useCallback(
    (el) => {
      stop.current?.();
      stop.current = null;
      const root = el?.closest(".assemble");
      if (!root) return;
      const set = () => root.style.setProperty(name, `${Math.ceil(el.getBoundingClientRect().height)}px`);
      set();
      const watch = new ResizeObserver(set);
      watch.observe(el);
      stop.current = () => {
        watch.disconnect();
        root.style.removeProperty(name);
      };
    },
    [name]
  );
}
