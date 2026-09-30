/**
 * A page with unsaved edits (currently only the Theme editor) registers a guard
 * here; shell actions that leave the page without a link, such as switching
 * store or logging out, ask `confirmLeave()` first. With no guard registered,
 * leaving is always allowed.
 */
type LeaveGuard = () => Promise<boolean>;

let activeGuard: LeaveGuard | null = null;

export function registerLeaveGuard(guard: LeaveGuard): () => void {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) {
      activeGuard = null;
    }
  };
}

/** Resolves to true when it is safe to leave the current page. */
export function confirmLeave(): Promise<boolean> {
  return activeGuard ? activeGuard() : Promise.resolve(true);
}
