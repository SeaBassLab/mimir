import type { DiscoveredProvider } from "../configuration/manifest-loader";
import type { AgentKnowledgeResource, AgentKnowledgeView } from "./agent-knowledge";

const MAX_RESOURCES_PER_FILE = 200;
const MAX_API_ENTRIES_PER_RESOURCE = 200;

export type RenderedContextFile = {
  name: string;
  content: string;
};

type ResourceSection = {
  name: string;
  title: string;
  description: string;
  kinds: ReadonlySet<string>;
};

const SECTIONS: ResourceSection[] = [
  { name: "components.md", title: "APS Components", description: "Public UI building blocks.", kinds: new Set(["component"]) },
  { name: "tokens.md", title: "APS Tokens and Themes", description: "Stable design values and theme surfaces. Prefer these paths over invented literals.", kinds: new Set(["token", "theme"]) },
  { name: "hooks.md", title: "APS Hooks", description: "Public hooks and their callable API.", kinds: new Set(["hook"]) },
  { name: "contexts.md", title: "APS Contexts and Providers", description: "React context and provider resources.", kinds: new Set(["context", "provider"]) },
  { name: "templates.md", title: "APS Templates and Pages", description: "Higher-level layouts and page resources.", kinds: new Set(["template", "page"]) }
];

const SPECIALIZED_KINDS = new Set(SECTIONS.flatMap((section) => [...section.kinds]));

function providerCounts(provider: DiscoveredProvider): string {
  return provider.resourceCounts.length === 0
    ? "none"
    : provider.resourceCounts.map((item) => `${item.key}: ${item.count}`).join(", ");
}

function fencedCode(language: string, lines: string[]): string[] {
  return [`\`\`\`${language}`, ...lines, "\`\`\`"];
}

function importDetails(resource: AgentKnowledgeResource): { statement?: string; localName: string } {
  const localName = resource.name;
  if (!resource.packageName || !resource.importName) return { localName };
  const reservedBindings = new Set(["default", "class", "function", "import", "export", "return", "const", "let", "var"]);
  const isIdentifier = (value: string): boolean =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !reservedBindings.has(value);
  if (!isIdentifier(localName) || (resource.importName !== "default" && !isIdentifier(resource.importName))) {
    return { localName };
  }
  if (resource.importName === "default") {
    return { localName, statement: `import ${localName} from ${JSON.stringify(resource.packageName)};` };
  }
  const imported = resource.importName === localName
    ? resource.importName
    : `${resource.importName} as ${localName}`;
  return {
    localName,
    statement: `import { ${imported} } from ${JSON.stringify(resource.packageName)};`
  };
}

function renderDeterministicUsage(resource: AgentKnowledgeResource): string[] {
  const { statement, localName } = importDetails(resource);
  if (!statement) return [];
  const lines = [statement];
  if ((resource.kind === "token" || resource.kind === "theme") && resource.members[0]) {
    const memberPath = resource.members[0].path;
    const access = memberPath.startsWith("[") ? `${localName}${memberPath}` : `${localName}.${memberPath}`;
    lines.push("", `const value = ${access};`);
  } else if (resource.kind === "hook" && resource.callSignatures.some((signature) => signature.requiredParameters === 0)) {
    lines.push("", `const value = ${localName}();`);
  } else if (resource.kind === "component" && resource.props.length > 0 && resource.props.every((prop) => prop.required === false)) {
    lines.push("", `<${localName} />`);
  }
  return fencedCode(resource.kind === "component" ? "tsx" : "ts", lines);
}

function renderResource(resource: AgentKnowledgeResource): string[] {
  const lines: string[] = [`## ${resource.name}`, "", "### Facts", "", `- Kind: ${resource.kind}`, `- Provider: ${resource.provider}`];
  if (resource.id) lines.push(`- Resource ID: ${resource.id}`);
  const importInfo = importDetails(resource);
  if (importInfo.statement) {
    lines.push(`- Import module: ${resource.packageName}`, `- Export: ${resource.importName}`);
  } else {
    lines.push("- Public import: unavailable in the APS manifest. Verify the package exports before using this resource.");
  }
  if (resource.description?.trim()) {
    lines.push("", resource.description.trim());
  } else {
    lines.push("", "Knowledge gap: no authored description is available. Do not infer semantics from the name alone.");
  }
  if (importInfo.statement) {
    lines.push("", "### Import", "", ...fencedCode("ts", [importInfo.statement]));
  }

  const apiCount = resource.props.length + resource.members.length + resource.callSignatures.length;
  if (apiCount > 0) {
    lines.push("", "### Public API", "");
    const apiEntries: string[] = [];
    for (const signature of resource.callSignatures) {
      apiEntries.push(`- Signature: \`${signature.display}\``);
    }
    for (const prop of resource.props) {
      const required = prop.required === true
        ? "required"
        : prop.required === false
          ? "optional"
          : "requirement not published";
      const description = prop.description ? ` — ${prop.description}` : "";
      apiEntries.push(`- Prop \`${prop.name}\`: \`${prop.type ?? "unknown"}\` (${required})${description}`);
    }
    for (const member of resource.members) {
      const description = member.description ? ` — ${member.description}` : "";
      apiEntries.push(`- \`${member.path}\`: \`${member.type ?? "unknown"}\`${description}`);
    }
    lines.push(...apiEntries.slice(0, MAX_API_ENTRIES_PER_RESOURCE));
    if (apiCount > MAX_API_ENTRIES_PER_RESOURCE) {
      lines.push(`- Context limit reached: showing the first ${MAX_API_ENTRIES_PER_RESOURCE} API entries.`);
    }
  } else {
    lines.push("", "### Public API", "", "Knowledge gap: no public API details were published. Do not invent props, members, or arguments.");
  }

  if (resource.variants.length > 0 || resource.patterns.length > 0) {
    lines.push("", "### Capabilities", "");
    if (resource.variants.length > 0) lines.push(`- Variants: ${resource.variants.map((item) => `\`${item}\``).join(", ")}`);
    if (resource.patterns.length > 0) lines.push(`- React patterns: ${resource.patterns.join(", ")}`);
  }

  if (resource.whenToUse.length > 0 || resource.whenNotToUse.length > 0) {
    lines.push("", "### Guidance", "");
    if (resource.whenToUse.length > 0) {
      lines.push("Use when:", ...resource.whenToUse.map((item) => `- ${item}`));
    }
    if (resource.whenNotToUse.length > 0) {
      lines.push("", "Avoid when:", ...resource.whenNotToUse.map((item) => `- ${item}`));
    }
  } else {
    lines.push("", "### Guidance", "", "Knowledge gap: no authored usage guidance is available. Use only the documented API and inspect package documentation when intent is ambiguous.");
  }

  const usage = renderDeterministicUsage(resource);
  if (usage.length > 0 || resource.examples.length > 0) {
    lines.push("", "### Safe usage", "");
    if (usage.length > 0) lines.push(...usage);
    if (resource.examples.length > 0) {
      lines.push("", "Published examples:", ...resource.examples.map((item) => `- ${item}`));
    }
  }

  if (resource.relationships.length > 0) {
    lines.push("", "### Relationships", "", ...resource.relationships.map((item) => `- ${item}`));
  }
  lines.push("");
  return lines;
}

function renderResourceFile(section: ResourceSection, resources: AgentKnowledgeResource[]): string {
  const visible = resources.slice(0, MAX_RESOURCES_PER_FILE);
  const lines = [`# ${section.title}`, "", section.description, ""];
  for (const resource of visible) lines.push(...renderResource(resource));
  if (resources.length > visible.length) {
    lines.push(`Context limit reached: showing ${visible.length} of ${resources.length} resources.`, "");
  }
  return lines.join("\n");
}

function renderProviders(view: AgentKnowledgeView): string {
  const lines = ["# APS Providers", "", "Installed packages that publish APS knowledge:", ""];
  for (const provider of view.discovery.providers) {
    lines.push(`- ${provider.name}`, `  - resources: ${providerCounts(provider)}`);
    if (provider.warnings.length > 0) lines.push(`  - warnings: ${provider.warnings.join(" | ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderList(title: string, description: string, values: string[]): string {
  return [`# ${title}`, "", description, "", ...values.map((value) => `- ${value}`), ""].join("\n");
}

function renderIndex(files: RenderedContextFile[]): string {
  const available = new Set(files.map((file) => file.name));
  const routes = [
    ["Discover installed providers", "providers.md"],
    ["Build or choose UI components", "components.md"],
    ["Use colors, spacing, typography, or themes", "tokens.md"],
    ["Use hooks", "hooks.md"],
    ["Use contexts or providers", "contexts.md"],
    ["Use templates or pages", "templates.md"],
    ["Use other public resources", "resources.md"],
    ["Follow package rules", "rules.md"],
    ["Find published examples", "examples.md"]
  ].filter(([, file]) => available.has(file));
  return [
    "# APS Agent Context",
    "",
    "This directory is the model-neutral projection of installed APS knowledge.",
    "",
    "## Operating rules",
    "",
    "- Consult the relevant file below before using an installed library.",
    "- Treat documented imports, resource names, API paths, and signatures as authoritative.",
    "- Do not invent token paths, props, variants, hooks, arguments, or package exports.",
    "- If knowledge is marked unavailable, inspect the installed package or source declarations before writing code.",
    "- Prefer published semantic APIs and tokens over hardcoded values or local replacements.",
    "",
    "## Route by intent",
    "",
    ...routes.map(([intent, file]) => `- ${intent}: [${file}](./${file})`),
    ""
  ].join("\n");
}

export function renderAgentContext(view: AgentKnowledgeView): RenderedContextFile[] {
  const files: RenderedContextFile[] = [];
  if (view.discovery.providers.length > 0) files.push({ name: "providers.md", content: renderProviders(view) });
  for (const section of SECTIONS) {
    const resources = view.resources.filter((resource) => section.kinds.has(resource.kind));
    if (resources.length > 0) files.push({ name: section.name, content: renderResourceFile(section, resources) });
  }
  const otherResources = view.resources.filter((resource) => !SPECIALIZED_KINDS.has(resource.kind));
  if (otherResources.length > 0) {
    files.push({
      name: "resources.md",
      content: renderResourceFile({ name: "resources.md", title: "APS Resources", description: "Other public software knowledge, grouped into self-contained resource cards.", kinds: new Set<string>() }, otherResources)
    });
  }
  if (view.rules.length > 0) files.push({ name: "rules.md", content: renderList("APS Rules", "Published package rules.", view.rules) });
  if (view.examples.length > 0) files.push({ name: "examples.md", content: renderList("APS Examples", "Published package examples.", view.examples) });
  files.unshift({ name: "index.md", content: renderIndex(files) });
  return files;
}
