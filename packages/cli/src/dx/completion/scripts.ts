import { getCommandRegistry, listAllFlags, listVisibleCommandNames } from "../command-registry";
import { CLI_BINARY_NAME } from "../branding/constants";

function escapeForSingleQuotes(value: string): string {
  return value.replace(/'/g, "''");
}

function buildCommandFlagsMapShell(): string {
  const entries = getCommandRegistry()
    .map((command) => {
      const flags = command.flags.map((flag) => flag.name).join(" ");
      const subcommands = command.subcommands.join(" ");
      return `    ${command.name}) echo \"${[flags, subcommands].filter(Boolean).join(" ")}\" ;;`;
    })
    .join("\n");

  return entries;
}

export function buildBashCompletionScript(): string {
  const commands = listVisibleCommandNames().join(" ");
  const globalFlags = listAllFlags().join(" ");

  return `# Mimir completion for bash
_mimir_completion() {
  local cur prev first
  COMPREPLY=()
  cur="${"${COMP_WORDS[COMP_CWORD]}"}"
  prev="${"${COMP_WORDS[COMP_CWORD-1]}"}"
  first="${"${COMP_WORDS[1]}"}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands} ${globalFlags}" -- "$cur") )
    return 0
  fi

  local cmd_flags
  case "$first" in
${buildCommandFlagsMapShell()}
    *) cmd_flags="" ;;
  esac

  COMPREPLY=( $(compgen -W "$cmd_flags ${globalFlags}" -- "$cur") )
  return 0
}

complete -F _mimir_completion ${CLI_BINARY_NAME}
`;
}

export function buildZshCompletionScript(): string {
  const commands = listVisibleCommandNames()
    .map((command) => `'${command}:${command}'`)
    .join(" ");
  const commandCase = getCommandRegistry()
    .map((command) => {
      const allArgs = [...command.flags.map((flag) => flag.name), ...command.subcommands];
      if (allArgs.length === 0) {
        return `      ${command.name}) _values 'options' ;;`;
      }
      return `      ${command.name}) _values 'options' ${allArgs
        .map((item) => `'${item}[${item}]'`)
        .join(" ")} ;;`;
    })
    .join("\n");

  return `#compdef ${CLI_BINARY_NAME}

_mimir() {
  local -a commands
  commands=(${commands})

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  local cmd="$words[2]"
  case "$cmd" in
${commandCase}
    *) _values 'global options' '--help[Show help]' '--version[Show version]' ;;
  esac
}

_mimir "$@"
`;
}

export function buildFishCompletionScript(): string {
  const commandLines = listVisibleCommandNames()
    .map((command) => `complete -c ${CLI_BINARY_NAME} -f -n '__fish_use_subcommand' -a '${command}'`)
    .join("\n");

  const argumentLines = getCommandRegistry()
    .flatMap((command) => {
      const items = [...command.flags.map((flag) => flag.name), ...command.subcommands];
      return items.map(
        (item) =>
          `complete -c ${CLI_BINARY_NAME} -f -n '__fish_seen_subcommand_from ${command.name}' -a '${escapeForSingleQuotes(
            item
          )}'`
      );
    })
    .join("\n");

  return `# Mimir completion for fish
${commandLines}

${argumentLines}
`;
}

export function buildPowerShellCompletionScript(): string {
  const commands = listVisibleCommandNames();
  const commandMap = getCommandRegistry().reduce<Record<string, string[]>>((acc, command) => {
    acc[command.name] = [...command.flags.map((flag) => flag.name), ...command.subcommands];
    return acc;
  }, {});

  const commandArray = commands.map((command) => `'${command}'`).join(", ");
  const commandCases = commands
    .map((command) => {
      const items = (commandMap[command] ?? []).map((item) => `'${item}'`).join(", ");
      return `      '${command}' { $suggestions = @(${items}) }`;
    })
    .join("\n");

  return `Register-ArgumentCompleter -Native -CommandName ${CLI_BINARY_NAME} -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $tokens = $commandAst.CommandElements | ForEach-Object { $_.Extent.Text }
  $commands = @(${commandArray})

  if ($tokens.Count -le 2) {
    $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
      [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
    return
  }

  $command = $tokens[1]
  $suggestions = @()

  switch ($command) {
${commandCases}
      default { $suggestions = @('--help', '--version') }
  }

  $suggestions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}
