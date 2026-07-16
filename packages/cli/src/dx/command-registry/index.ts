import { CLI_BINARY_NAME, cliCommand } from "../branding/constants";

export type DxFlag = {
  name: string;
  description: string;
};

export type DxExitCode = {
  code: number;
  meaning: string;
};

export type DxCommandMeta = {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  flags: DxFlag[];
  aliases: string[];
  hidden: boolean;
  category: "core" | "diagnostics" | "workflow" | "dx";
  notes: string[];
  exitCodes: DxExitCode[];
  subcommands: string[];
};

const COMMANDS: DxCommandMeta[] = [
  {
    name: "init",
    description: "Initialize APS support in package.json",
    usage: `${cliCommand("init")} [--json] [--dry-run]`,
    examples: [cliCommand("init"), `${cliCommand("init")} --dry-run`, `${cliCommand("init")} --json`],
    flags: [{ name: "--json", description: "Emit deterministic machine-readable result." }],
    aliases: [],
    hidden: false,
    category: "core",
    notes: ["Creates or completes the aps section in package.json."],
    exitCodes: [
      { code: 0, meaning: "APS config initialized or already present." },
      { code: 1, meaning: "Initialization failed (missing package.json or invalid JSON)." }
    ],
    subcommands: []
  },
  {
    name: "author",
    description: "Sync *.mimir.yaml descriptors (auto) while preserving human authoring",
    usage: `${cliCommand("author")} [selector] [--component <name>] [--update] [--json] [--dry-run] [--delete-orphans]`,
    examples: [
      cliCommand("author"),
      `${cliCommand("author")} --dry-run`,
      `${cliCommand("author")} --delete-orphans`,
      `${cliCommand("author")} --component ParallelChat`,
      `${cliCommand("author")} src/components/ParallelChat --update`,
      `${cliCommand("author")} --json`
    ],
    flags: [
      { name: "--json", description: "Emit deterministic machine-readable authoring result." },
      { name: "--dry-run", description: "Show descriptor sync plan without writing files." },
      { name: "--delete-orphans", description: "Delete orphaned descriptor resources during sync." },
      { name: "--update", description: "Run incremental sync using [selector] or --component." },
      { name: "--component <name>", description: "Run incremental sync for one component name." },
      { name: "--no-refresh-auto", description: "Skip automatic descriptor field refresh." },
      { name: "--interactive", description: "Reserved for future guided human authoring mode." },
      { name: "--ai", description: "Reserved for future AI-assisted human authoring mode." }
    ],
    aliases: [],
    hidden: false,
    category: "workflow",
    notes: [
      "Phase 1: discovers resources and synchronizes only the descriptor auto block.",
      "Phase 2: preserves human fields; no automatic overwrite of human authoring.",
      "Incremental mode targets one component/path and skips orphan deletion to avoid unrelated changes."
    ],
    exitCodes: [
      { code: 0, meaning: "Descriptor files created or already present." },
      { code: 1, meaning: "Resource discovery or authoring failed." }
    ],
    subcommands: []
  },
  {
    name: "generate",
    description: "Compile APS resources from descriptor contracts",
    usage: `${cliCommand("generate")} [--json] [--force]`,
    examples: [cliCommand("generate"), `${cliCommand("generate")} --force`, `${cliCommand("generate")} --json`],
    flags: [
      { name: "--json", description: "Emit machine-readable generation report." },
      { name: "--force", description: "Replace existing generated resources in dist/aps." }
    ],
    aliases: [],
    hidden: false,
    category: "workflow",
    notes: [
      "Reads provider resource contracts from *.mimir.yaml descriptors.",
      "Does not overwrite existing generated output unless --force is provided."
    ],
    exitCodes: [
      { code: 0, meaning: "Generation completed and validation passed." },
      { code: 1, meaning: "Generation failed or validation failed." }
    ],
    subcommands: []
  },
  {
    name: "discover",
    description: "Discover APS-enabled dependencies and load APS manifests",
    usage: `${cliCommand("discover")} [--json]`,
    examples: [cliCommand("discover"), `${cliCommand("discover")} --json`],
    flags: [{ name: "--json", description: "Emit deterministic machine-readable discovery result." }],
    aliases: [],
    hidden: false,
    category: "core",
    notes: ["Inspects dependencies and devDependencies from package.json."],
    exitCodes: [
      { code: 0, meaning: "Discovery completed." },
      { code: 1, meaning: "Discovery failed." }
    ],
    subcommands: []
  },
  {
    name: "validate",
    description: "Validate APS compliance for current package",
    usage: `${cliCommand("validate")} [--json]`,
    examples: [cliCommand("validate"), `${cliCommand("validate")} --json`],
    flags: [{ name: "--json", description: "Emit deterministic machine-readable validation result." }],
    aliases: [],
    hidden: false,
    category: "core",
    notes: ["Checks package APS config, manifest schema, and declared resource paths."],
    exitCodes: [
      { code: 0, meaning: "Validation passed." },
      { code: 1, meaning: "Validation failed." }
    ],
    subcommands: []
  },
  {
    name: "governance",
    description: "Validate provenance, evidence, lifecycle and trust rules for published knowledge",
    usage: `${cliCommand("governance")} [--json]`,
    examples: [cliCommand("governance"), `${cliCommand("governance")} --json`],
    flags: [{ name: "--json", description: "Emit machine-readable governance result." }],
    aliases: [],
    hidden: false,
    category: "diagnostics",
    notes: ["Runs governance validators over the configured APS manifest."],
    exitCodes: [
      { code: 0, meaning: "Governance validation passed." },
      { code: 1, meaning: "Governance validation failed." }
    ],
    subcommands: []
  },
  {
    name: "doctor",
    description: "Evaluate APS provider maturity (L0-L3)",
    usage: `${cliCommand("doctor")} [--json]`,
    examples: [cliCommand("doctor"), `${cliCommand("doctor")} --json`],
    flags: [{ name: "--json", description: "Emit machine-readable doctor report." }],
    aliases: [],
    hidden: false,
    category: "diagnostics",
    notes: ["Returns non-zero when maturity is below maximum."],
    exitCodes: [
      { code: 0, meaning: "All discovered providers reached maximum maturity." },
      { code: 1, meaning: "At least one provider is below maximum maturity or execution failed." }
    ],
    subcommands: []
  },
  {
    name: "sync",
    description: "Synchronize APS context to configured AI agent adapters",
    usage: `${cliCommand("sync")} [--json] [--dry-run]`,
    examples: [cliCommand("sync"), `${cliCommand("sync")} --dry-run`, `${cliCommand("sync")} --json`],
    flags: [{ name: "--json", description: "Emit deterministic machine-readable sync result." }],
    aliases: [],
    hidden: false,
    category: "workflow",
    notes: ["Sync reports adapter status and keeps user-authored content untouched."],
    exitCodes: [
      { code: 0, meaning: "Sync completed." },
      { code: 1, meaning: "Sync failed." }
    ],
    subcommands: []
  },
  {
    name: "context",
    description: "Generate AI agent context from discovered APS packages",
    usage: `${cliCommand("context")} [--json] [--dry-run]`,
    examples: [cliCommand("context"), `${cliCommand("context")} --dry-run`, `${cliCommand("context")} --json`],
    flags: [{ name: "--json", description: "Emit deterministic machine-readable context result." }],
    aliases: [],
    hidden: false,
    category: "workflow",
    notes: ["Generates local context files and updates AGENTS.md managed section."],
    exitCodes: [
      { code: 0, meaning: "Context generation completed." },
      { code: 1, meaning: "Context generation failed." }
    ],
    subcommands: []
  },
  {
    name: "completion",
    description: "Print shell completion scripts",
    usage: `${cliCommand("completion")} <bash|zsh|fish|powershell>`,
    examples: [
      `${cliCommand("completion")} bash`,
      `${cliCommand("completion")} zsh`,
      `${cliCommand("completion")} fish`,
      `${cliCommand("completion")} powershell`
    ],
    flags: [],
    aliases: [],
    hidden: false,
    category: "dx",
    notes: ["Prints completion scripts to stdout; does not install automatically."],
    exitCodes: [
      { code: 0, meaning: "Script printed successfully." },
      { code: 2, meaning: "Unsupported or missing shell argument." }
    ],
    subcommands: ["bash", "zsh", "fish", "powershell"]
  },
  {
    name: "about",
    description: "Show an overview of APS Protocol and Mimir CLI workflows",
    usage: `${cliCommand("about")} [--json]`,
    examples: [cliCommand("about"), `${cliCommand("about")} --json`],
    flags: [{ name: "--json", description: "Emit machine-readable about information." }],
    aliases: [],
    hidden: false,
    category: "dx",
    notes: ["Good starting point for first-time CLI users."],
    exitCodes: [
      { code: 0, meaning: "About information displayed." },
      { code: 1, meaning: "About command failed unexpectedly." }
    ],
    subcommands: []
  },
  {
    name: "help",
    description: "Show Mimir CLI help",
    usage: `${cliCommand("help")} [command]`,
    examples: [cliCommand("help"), `${cliCommand("help")} generate`, `${cliCommand("help")} completion`],
    flags: [],
    aliases: [],
    hidden: false,
    category: "dx",
    notes: [`Use ${CLI_BINARY_NAME} <command> --help for command-specific quick help.`],
    exitCodes: [
      { code: 0, meaning: "Help displayed." },
      { code: 2, meaning: "Unknown command name provided." }
    ],
    subcommands: [
      "init",
      "author",
      "generate",
      "discover",
      "validate",
      "governance",
      "doctor",
      "sync",
      "context",
      "completion",
      "about",
      "help"
    ]
  }
];

export function getCommandRegistry(): DxCommandMeta[] {
  return [...COMMANDS];
}

export function findCommandMeta(commandName: string): DxCommandMeta | undefined {
  const normalized = commandName.trim().toLowerCase();
  return COMMANDS.find(
    (command) => command.name === normalized || command.aliases.includes(normalized)
  );
}

export function listVisibleCommandNames(): string[] {
  return COMMANDS.filter((command) => !command.hidden)
    .map((command) => command.name)
    .sort((a, b) => a.localeCompare(b));
}

export function listAllFlags(): string[] {
  const flags = new Set<string>([
    "--help",
    "--version",
    "--json",
    "--dry-run",
    "--verbose",
    "--quiet"
  ]);
  for (const command of COMMANDS) {
    for (const flag of command.flags) {
      flags.add(flag.name);
    }
  }

  return [...flags].sort((a, b) => a.localeCompare(b));
}
