const DEFAULT_API_BASE = 'https://neo4j-runner.neo4j-namoryx.workers.dev';

function readRuntimeEnv(key) {
  if (typeof window !== 'undefined' && window?.[key]) return window[key];
  if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) return import.meta.env[key];
  if (typeof process !== 'undefined' && process?.env?.[key]) return process.env[key];
  return undefined;
}

export function getApiBase() {
  const runtime = readRuntimeEnv('WORKER_ENDPOINT') || readRuntimeEnv('VITE_WORKER_ENDPOINT');
  if (runtime) return runtime.replace(/\/run$/i, '').replace(/\/$/, '');
  return DEFAULT_API_BASE;
}

export function getEndpoints(base = getApiBase()) {
  const trimmed = base.replace(/\/$/, '');
  return {
    base: trimmed,
    run: `${trimmed}/run`,
    submit: `${trimmed}/submit`,
    seed: `${trimmed}/seed`,
    reset: `${trimmed}/reset`,
    health: `${trimmed}/health`,
  };
}

export const API_BASE = getApiBase();
export const ENDPOINTS = getEndpoints(API_BASE);
