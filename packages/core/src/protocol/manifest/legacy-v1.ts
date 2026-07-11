export interface ApsV1Component {
  name: string;
  import?: string;
  description?: string;
  tags?: string[];
  aliases?: string[];
  examples?: string[];
  rules?: string[];
  [key: string]: unknown;
}

export interface ApsV1Rule {
  name: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ApsV1Example {
  name: string;
  description?: string;
  tags?: string[];
  path?: string;
  [key: string]: unknown;
}

export interface ApsV1Pattern {
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  rules?: string[];
  [key: string]: unknown;
}

export interface ApsV1Migration {
  name: string;
  fromVersion?: number;
  toVersion?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ApsV1Manifest {
  version: number;
  components?: ApsV1Component[];
  rules?: ApsV1Rule[];
  examples?: ApsV1Example[];
  patterns?: ApsV1Pattern[];
  migrations?: ApsV1Migration[];
  [key: string]: unknown;
}
