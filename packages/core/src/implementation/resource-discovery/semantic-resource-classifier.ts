import path from "path";
import type { ResourceClassification, SemanticResourceKind } from "../contracts/resource";

export type ResourceClassificationPolicy = {
  include: Set<SemanticResourceKind>;
  exclude: Set<SemanticResourceKind>;
};

export type SemanticResourceSignals = {
  name: string;
  filePath: string;
  isPublicExport: boolean;
  hasReactImport: boolean;
  hasJsx: boolean;
  hasCreateContextCall: boolean;
  hasStyledImport: boolean;
  hasStyledCall: boolean;
  hasStorybookImport: boolean;
  extension: string;
};

type RuleScore = {
  kind: SemanticResourceKind;
  score: number;
  reason: string;
};

type ClassificationRule = {
  id: string;
  evaluate: (signals: SemanticResourceSignals) => RuleScore[];
};

const DEFAULT_INCLUDE_KINDS: SemanticResourceKind[] = [
  "component",
  "hook",
  "context",
  "provider",
  "template",
  "icon",
  "page"
];

const DEFAULT_EXCLUDE_KINDS: SemanticResourceKind[] = [
  "story",
  "internal",
  "configuration",
  "unknown"
];

function normalizePath(value: string): string {
  return value.split(path.sep).join("/").toLowerCase();
}

function basenameNoExt(filePath: string): string {
  const ext = path.extname(filePath);
  return path.basename(filePath, ext);
}

function hasWord(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

const classificationRules: ClassificationRule[] = [
  {
    id: "story-file",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      if (
        lowerPath.includes(".stories.") ||
        lowerPath.includes(".story.") ||
        lowerPath.includes(".story.hidden.") ||
        lowerPath.includes("/__stories__/") ||
        signals.hasStorybookImport
      ) {
        return [{ kind: "story", score: 0.98, reason: "storybook-signal" }];
      }
      return [];
    }
  },
  {
    id: "config-file",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      const base = basenameNoExt(signals.filePath).toLowerCase();
      if (
        lowerPath.includes(".config.") ||
        lowerPath.endsWith("/config.ts") ||
        lowerPath.endsWith("/config.tsx") ||
        base.endsWith("config") ||
        base.endsWith("settings")
      ) {
        return [{ kind: "configuration", score: 0.95, reason: "config-signal" }];
      }
      return [];
    }
  },
  {
    id: "styled-internal",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      const lowerName = signals.name.toLowerCase();
      if (
        signals.hasStyledCall ||
        lowerPath.includes(".styled.") ||
        lowerName.includes("globalstyle") ||
        lowerName.includes("styled")
      ) {
        return [{ kind: "internal", score: 0.94, reason: "styled-or-global-style" }];
      }
      return [];
    }
  },
  {
    id: "context",
    evaluate: (signals) => {
      if (signals.hasCreateContextCall || signals.name.endsWith("Context")) {
        return [{ kind: "context", score: 0.93, reason: "react-context-signal" }];
      }
      return [];
    }
  },
  {
    id: "provider",
    evaluate: (signals) => {
      if (signals.name.endsWith("Provider")) {
        const results: RuleScore[] = [{ kind: "provider", score: 0.9, reason: "provider-name-suffix" }];
        if (signals.hasJsx || signals.hasReactImport) {
          results.push({ kind: "component", score: 0.65, reason: "provider-react-signal" });
        }
        return results;
      }
      return [];
    }
  },
  {
    id: "hook",
    evaluate: (signals) => {
      if (/^use[A-Z0-9].+/.test(signals.name)) {
        const boost = signals.hasReactImport ? 0.9 : 0.75;
        return [{ kind: "hook", score: boost, reason: "hook-name-prefix" }];
      }
      return [];
    }
  },
  {
    id: "page",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      if (signals.name.endsWith("Page") || lowerPath.includes("/pages/") || lowerPath.includes("/page/")) {
        return [{ kind: "page", score: 0.85, reason: "page-signal" }];
      }
      return [];
    }
  },
  {
    id: "template",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      if (signals.name.endsWith("Template") || lowerPath.includes("/templates/") || lowerPath.includes("/template/")) {
        return [{ kind: "template", score: 0.84, reason: "template-signal" }];
      }
      return [];
    }
  },
  {
    id: "icon",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      if (signals.name.endsWith("Icon") || lowerPath.includes("/icons/")) {
        return [{ kind: "icon", score: 0.8, reason: "icon-signal" }];
      }
      return [];
    }
  },
  {
    id: "theme-token",
    evaluate: (signals) => {
      const lowerPath = normalizePath(signals.filePath);
      const lowerName = signals.name.toLowerCase();
      const results: RuleScore[] = [];

      if (hasWord(lowerName, "theme") || lowerPath.includes("/theme/") || lowerPath.includes("/themes/")) {
        results.push({ kind: "theme", score: 0.82, reason: "theme-signal" });
      }

      if (
        hasWord(lowerName, "token") ||
        lowerPath.includes("/token/") ||
        lowerPath.includes("/tokens/") ||
        lowerPath.includes("/design-tokens/")
      ) {
        results.push({ kind: "token", score: 0.82, reason: "token-signal" });
      }

      return results;
    }
  },
  {
    id: "component",
    evaluate: (signals) => {
      const startsUppercase = /^[A-Z][A-Za-z0-9_]*$/.test(signals.name);
      if (startsUppercase && (signals.hasJsx || signals.hasReactImport || signals.extension === ".tsx")) {
        return [{ kind: "component", score: 0.78, reason: "react-component-signal" }];
      }
      return [];
    }
  },
  {
    id: "utility",
    evaluate: (signals) => {
      const startsLowercase = /^[a-z][A-Za-z0-9_]*$/.test(signals.name);
      if (!startsLowercase) {
        return [];
      }

      if (signals.hasReactImport || signals.hasJsx || signals.hasCreateContextCall) {
        return [];
      }

      return [{ kind: "utility", score: 0.7, reason: "lowercase-non-react-export" }];
    }
  }
];

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tieBreakPriority(kind: SemanticResourceKind): number {
  const priority: SemanticResourceKind[] = [
    "story",
    "configuration",
    "internal",
    "context",
    "provider",
    "hook",
    "page",
    "template",
    "component",
    "icon",
    "theme",
    "token",
    "utility",
    "unknown"
  ];

  const index = priority.indexOf(kind);
  return index === -1 ? priority.length : index;
}

export function defaultResourceClassificationPolicy(): ResourceClassificationPolicy {
  return {
    include: new Set(DEFAULT_INCLUDE_KINDS),
    exclude: new Set(DEFAULT_EXCLUDE_KINDS)
  };
}

export function mergeClassificationPolicy(config?: {
  include?: SemanticResourceKind[];
  exclude?: SemanticResourceKind[];
}): ResourceClassificationPolicy {
  const defaults = defaultResourceClassificationPolicy();

  if (!config) {
    return defaults;
  }

  const include = config.include ? new Set(config.include) : defaults.include;
  const exclude = config.exclude ? new Set(config.exclude) : defaults.exclude;

  return {
    include,
    exclude
  };
}

export function classifyResource(
  signals: SemanticResourceSignals,
  policy: ResourceClassificationPolicy
): ResourceClassification {
  const scoreByKind = new Map<SemanticResourceKind, number>();
  const reasonsByKind = new Map<SemanticResourceKind, string[]>();

  for (const rule of classificationRules) {
    const scores = rule.evaluate(signals);
    for (const score of scores) {
      const currentScore = scoreByKind.get(score.kind) ?? 0;
      const merged = clampConfidence(1 - (1 - currentScore) * (1 - score.score));
      scoreByKind.set(score.kind, merged);

      const reasons = reasonsByKind.get(score.kind) ?? [];
      reasons.push(`${rule.id}:${score.reason}`);
      reasonsByKind.set(score.kind, reasons);
    }
  }

  if (scoreByKind.size === 0) {
    return {
      kind: "unknown",
      confidence: 0,
      reasons: ["no-classification-signals"],
      generateDescriptor: false
    };
  }

  const ranked = [...scoreByKind.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return tieBreakPriority(a[0]) - tieBreakPriority(b[0]);
  });

  const [kind, confidence] = ranked[0];
  const reasons = reasonsByKind.get(kind) ?? [];
  const evidenceCount = reasons.length;

  const generateDescriptor =
    signals.isPublicExport &&
    confidence >= 0.55 &&
    evidenceCount >= 1 &&
    policy.include.has(kind) &&
    !policy.exclude.has(kind);

  return {
    kind,
    confidence,
    reasons,
    generateDescriptor
  };
}
