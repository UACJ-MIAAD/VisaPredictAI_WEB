// Both immutable-cache assets must identify the SAME installed web runtime.
export const ORT_RUNTIME_VERSION = "1.31.0-dev.20260914-8d85527a0";
export const ORT_RUNTIME_PREFIX = `/ort/${ORT_RUNTIME_VERSION}/`;

export function assertOrtRuntimeVersion(installed) {
  if (installed !== ORT_RUNTIME_VERSION) throw new Error(`ORT runtime revision differs: ${installed}`);
}
