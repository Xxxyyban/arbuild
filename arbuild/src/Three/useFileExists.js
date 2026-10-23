// Does a model file exist in public/? Used by the variant components (MotherboardModel1, GPUModel1...)
// so a variant whose .glb isn't added yet shows the base model instead of breaking the scene.
// The content type is checked too, because the dev server and Firebase Hosting answer a
// missing file with index.html (status 200).
import { useEffect, useState } from "react";

const checked = new Map(); // url -> Promise<boolean>

function exists(url) {
  if (!checked.has(url)) {
    checked.set(
      url,
      fetch(url, { method: "HEAD" })
        .then((res) => res.ok && !(res.headers.get("content-type") || "").includes("text/html"))
        .catch(() => false)
    );
  }
  return checked.get(url);
}

/** true / false once known, null while checking. */
export function useFileExists(url) {
  const [state, setState] = useState({ url, ok: null });

  useEffect(() => {
    let cancelled = false;
    exists(url).then((ok) => !cancelled && setState({ url, ok }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state.url === url ? state.ok : null;
}
