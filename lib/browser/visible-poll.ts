/** Visible-tab fallback polling; realtime and local mutation events remain immediate. */
export function startVisiblePoll(
  load: (immediate: boolean) => void | Promise<void>,
  { intervalMs, events = [], initial = true }: {
    intervalMs: number;
    events?: string[];
    initial?: boolean;
  },
  environment = { window, document, now: Date.now },
) {
  const { window: win, document: doc, now } = environment;
  let disposed = false;
  let running = false;
  let queued = false;
  let lastStarted = -Infinity;
  let suspended = doc.visibilityState !== "visible" || !win.navigator.onLine;

  const run = async (force = false) => {
    if (disposed || doc.visibilityState !== "visible" || !win.navigator.onLine) return;
    if (running) {
      if (force) queued = true;
      return;
    }
    // focus + visibilitychange commonly arrive together.
    if (!force && now() - lastStarted < 2_000) return;
    running = true;
    lastStarted = now();
    try {
      await load(force);
    } catch {
      // A transient failure must not terminate subsequent fallback checks.
    } finally {
      running = false;
      if (queued && !disposed) {
        queued = false;
        void run(true);
      }
    }
  };
  const resume = () => {
    if (doc.visibilityState !== "visible" || !win.navigator.onLine) {
      suspended = true;
      return;
    }
    const returning = suspended;
    suspended = false;
    void run(returning);
  };
  const changed = () => { void run(true); };
  const first = initial ? win.setTimeout(resume, 0) : null;
  const interval = win.setInterval(resume, intervalMs);
  win.addEventListener("focus", resume);
  win.addEventListener("online", resume);
  win.addEventListener("offline", resume);
  doc.addEventListener("visibilitychange", resume);
  events.forEach(event => win.addEventListener(event, changed));
  return () => {
    disposed = true;
    if (first !== null) win.clearTimeout(first);
    win.clearInterval(interval);
    win.removeEventListener("focus", resume);
    win.removeEventListener("online", resume);
    win.removeEventListener("offline", resume);
    doc.removeEventListener("visibilitychange", resume);
    events.forEach(event => win.removeEventListener(event, changed));
  };
}
