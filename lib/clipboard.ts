// Shared clipboard helper so every "copy" affordance guards the write the same
// way. Returns whether the copy actually succeeded — callers should only show a
// success state when it's true (clipboard is unavailable in insecure contexts /
// when permission is denied).
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
