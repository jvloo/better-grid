export interface TransformReport {
  filesChanged: number;
  sitesConverted: number;
  flagged: { file: string; line: number; reason: string }[];
}

export async function runTransform(_args: {
  transform: string;
  paths: string[];
  dryRun?: boolean;
  extensions?: string[];
}): Promise<TransformReport> {
  throw new Error('runTransform not implemented (T27 fills this in)');
}
