/**
 * Where the app is running. The "artifact" build is hosted as a claude.ai Artifact: no service
 * worker, no print dialog, no direct downloads, and data is mirrored to the artifact's private
 * per-user store so it follows the person across devices.
 */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';

type ClaudeHost = { use: (name: string) => Promise<unknown> };

export async function claudeUse<T>(name: string): Promise<T | null> {
  const c = (typeof window !== 'undefined' ? (window as unknown as { claude?: ClaudeHost }).claude : undefined) ?? null;
  if (!c?.use) return null;
  try {
    return (await c.use(name)) as T | null;
  } catch {
    return null;
  }
}

type Downloads = { save: (req: { filename: string; data: string | Blob }) => Promise<unknown> };

/** Offer a generated file to the user. Returns false if it could not be offered. */
export async function saveFile(filename: string, data: string | Blob): Promise<boolean> {
  if (IS_ARTIFACT) {
    const dl = await claudeUse<Downloads>('downloads');
    if (!dl) return false;
    try {
      await dl.save({ filename, data });
      return true;
    } catch {
      return false;
    }
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: 'application/json' }) : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  return true;
}
