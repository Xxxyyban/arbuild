// TEMP-DEVTEST: a WebGL profiler for the preview. window.__glstats: draw calls and triangles per
// frame, frames per second, textures uploaded (bytes), shader programs linked, long tasks.
(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  const st = (window.__glstats = { frames: 0, fps: 0, draws: 0, tris: 0, frame: { draws: 0, tris: 0 }, texBytes: 0, textures: 0, programs: 0, linkMs: 0, longTasks: [], gpu: null });
  const TRI = (mode, count) => (mode === 4 ? count / 3 : mode === 5 || mode === 6 ? count - 2 : 0);
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = orig.call(this, type, attrs);
    if (!gl || !/webgl/.test(type) || gl.__prof) return gl;
    gl.__prof = true;
    try {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      st.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch { /* no info */ }
    const wrap = (name, fn) => {
      const f = gl[name];
      if (typeof f !== "function") return;
      gl[name] = function (...a) { fn(a); return f.apply(gl, a); };
    };
    wrap("drawElements", (a) => { st.draws++; st.tris += TRI(a[0], a[1]); });
    wrap("drawArrays", (a) => { st.draws++; st.tris += TRI(a[0], a[2]); });
    wrap("drawElementsInstanced", (a) => { st.draws++; st.tris += TRI(a[0], a[1]) * a[4]; });
    wrap("drawArraysInstanced", (a) => { st.draws++; st.tris += TRI(a[0], a[2]) * a[3]; });
    wrap("texStorage2D", (a) => { st.textures++; st.texBytes += a[3] * a[4] * 4 * (a[1] > 1 ? 1.33 : 1); });
    wrap("texImage2D", (a) => {
      if (a.length >= 9) { st.texBytes += a[3] * a[4] * 4; st.textures++; }
      else if (a[5] && a[5].width) { st.texBytes += a[5].width * a[5].height * 4; st.textures++; }
    });
    const link = gl.linkProgram;
    gl.linkProgram = function (p) { const t = performance.now(); const r = link.call(gl, p); st.linkMs += performance.now() - t; st.programs++; return r; };
    return gl;
  };
  let last = performance.now();
  let n = 0;
  const tick = (now) => {
    st.frames++;
    n++;
    st.frame = { draws: st.draws, tris: Math.round(st.tris) };
    st.draws = 0;
    st.tris = 0;
    if (now - last >= 1000) { st.fps = Math.round((n * 1000) / (now - last)); n = 0; last = now; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { st.longTasks.push(Math.round(e.duration)); (window.__longAt = window.__longAt || []).push([Math.round(e.startTime), Math.round(e.duration)]); })).observe({ type: "longtask", buffered: true });
  } catch { /* no long task timing */ }
})();
