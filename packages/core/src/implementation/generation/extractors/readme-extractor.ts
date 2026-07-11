import path from "node:path";
import { fileExists, readText } from "../../io/fs";
import type { ReadmeFacts } from "../types";

function parseSections(readme: string): Array<{ heading: string; body: string }> {
  const lines = readme.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];

  let currentHeading = "";
  let buffer: string[] = [];

  for (const line of lines) {
    const headingMatch = /^##\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
      }
      currentHeading = headingMatch[1].trim();
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
  }

  return sections;
}

function firstParagraph(text: string): string {
  const normalized = text
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.length > 0);

  return normalized ?? "";
}

export async function extractReadmeFacts(cwd: string): Promise<ReadmeFacts> {
  const readmePath = path.join(cwd, "README.md");
  if (!(await fileExists(readmePath))) {
    return { descriptionsByComponent: {} };
  }

  const content = await readText(readmePath);
  const sections = parseSections(content);
  const descriptionsByComponent: Record<string, string> = {};

  for (const section of sections) {
    const heading = section.heading.trim();
    if (!/^[A-Z][A-Za-z0-9]*$/.test(heading)) {
      continue;
    }

    const description = firstParagraph(section.body);
    if (description !== "") {
      descriptionsByComponent[heading] = description;
    }
  }

  return { descriptionsByComponent };
}
