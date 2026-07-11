export type ExampleBuilderResult = {
  generated: 0;
  warnings: string[];
};

export function buildExamplesNotImplemented(): ExampleBuilderResult {
  return {
    generated: 0,
    warnings: ["Example generation is intentionally not implemented in v1."]
  };
}
