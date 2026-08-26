"use client";

/**
 * Tiny cross-component store for the Profile unsaved-changes leave-guard.
 * EditableDetails owns the dirty state + the popup UI; TabBar and the sign-out
 * button consult `isDirty()` on click and, when dirty, call `requestLeave(...)`
 * instead of navigating — EditableDetails catches that and shows the popup.
 */
export type LeaveTarget = { type: "nav"; href: string } | { type: "signout" };
type LeaveHandler = (target: LeaveTarget) => void;

let dirty = false;
let leaveHandler: LeaveHandler | null = null;

export const editStore = {
  setDirty(v: boolean) {
    dirty = v;
  },
  isDirty() {
    return dirty;
  },
  /** EditableDetails registers the popup opener here. */
  onLeaveRequest(fn: LeaveHandler | null) {
    leaveHandler = fn;
  },
  /** Called by nav controls when dirty: opens the popup with the intended target. */
  requestLeave(target: LeaveTarget) {
    if (leaveHandler) leaveHandler(target);
  },
};
