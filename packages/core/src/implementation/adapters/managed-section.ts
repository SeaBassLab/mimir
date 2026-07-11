import { fileExists, readText, writeText } from "../io/fs";

const APS_START_MARKER = "<!-- APS:START -->";
const APS_END_MARKER = "<!-- APS:END -->";

export function renderManagedBlock(contentLines: string[]): string {
  return [APS_START_MARKER, "", ...contentLines, "", APS_END_MARKER].join("\n");
}

export async function upsertManagedSection(
  filePath: string,
  contentLines: string[]
): Promise<{ changed: boolean; created: boolean }> {
  const managedSection = renderManagedBlock(contentLines);

  if (!(await fileExists(filePath))) {
    await writeText(filePath, `${managedSection}\n`);
    return { changed: true, created: true };
  }

  const current = await readText(filePath);
  const startIndex = current.indexOf(APS_START_MARKER);
  const endIndex = current.indexOf(APS_END_MARKER);

  if (startIndex >= 0 && endIndex > startIndex) {
    const before = current.slice(0, startIndex).trimEnd();
    const after = current.slice(endIndex + APS_END_MARKER.length).trimStart();
    const next = `${[before, managedSection, after].filter((part) => part.length > 0).join("\n\n")}\n`;
    if (next === current) {
      return { changed: false, created: false };
    }
    await writeText(filePath, next);
    return { changed: true, created: false };
  }

  const next = `${current.trimEnd()}\n\n${managedSection}\n`;
  if (next === current) {
    return { changed: false, created: false };
  }

  await writeText(filePath, next);
  return { changed: true, created: false };
}
