export interface MimirGenerator<TOptions = unknown, TResult = unknown> {
  name: string;
  generate(cwd: string, options?: TOptions): Promise<TResult>;
}
