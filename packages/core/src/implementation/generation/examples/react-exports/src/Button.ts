export interface ButtonProps {
  label: string;
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  return `<button>${props.label}</button>`;
}
