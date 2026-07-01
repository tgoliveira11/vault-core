/** Whether Enter should expand the vault dock from a protected-page lock overlay. */
function isContentEditableTarget(element: HTMLElement): boolean {
  const value = element.getAttribute("contenteditable");
  return value === "" || value === "true";
}

export function shouldVaultLockOverlayExpandDock(event: KeyboardEvent): boolean {
  if (event.key !== "Enter" || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  if (target.isContentEditable || isContentEditableTarget(target)) return false;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;

  return true;
}
