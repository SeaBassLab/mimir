export type RuntimeOptions = {
  json: boolean;
  verbose: boolean;
  quiet: boolean;
  dryRun: boolean;
};

const state: RuntimeOptions = {
  json: false,
  verbose: false,
  quiet: false,
  dryRun: false
};

export function configureRuntimeOptions(argv: string[]): void {
  state.json = argv.includes("--json");
  state.verbose = argv.includes("--verbose");
  state.quiet = argv.includes("--quiet");
  state.dryRun = argv.includes("--dry-run");

  if (state.verbose && state.quiet) {
    state.quiet = false;
  }
}

export function getRuntimeOptions(): RuntimeOptions {
  return { ...state };
}

export function shouldEmitJson(localJson?: boolean): boolean {
  return Boolean(localJson) || state.json;
}

export function isDryRun(): boolean {
  return state.dryRun;
}

export function isVerbose(): boolean {
  return state.verbose;
}
