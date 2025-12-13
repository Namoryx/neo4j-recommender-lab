import { API_BASE, getEndpoints } from '../src/config.js';

const ENDPOINT_MAP = getEndpoints();

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

export async function runCypher(cypher, params = {}) {
  const { controller, clear } = withTimeout(10000);
  try {
    const res = await fetch(ENDPOINT_MAP.run, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher, params }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      throw new Error(json.error || '쿼리 실행 실패');
    }
    const fields = json.fields || json.columns || [];
    const values = json.values || json.rows || [];
    return { fields, values };
  } finally {
    clear();
  }
}

export async function seedData() {
  const { controller, clear } = withTimeout(10000);
  try {
    const res = await fetch(ENDPOINT_MAP.seed, { method: 'POST', signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    return json;
  } finally {
    clear();
  }
}

export async function submitCypher(questId, cypher, params = {}) {
  const { controller, clear } = withTimeout(10000);
  try {
    const res = await fetch(ENDPOINT_MAP.submit, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questId, cypher, params }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || '제출 실패');
    }
    return json;
  } finally {
    clear();
  }
}

export async function checkSeeded() {
  try {
    const result = await runCypher('MATCH (n) RETURN count(n) AS cnt');
    const count = Number(result.values?.[0]?.[0] ?? 0);
    return count > 0;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export { API_BASE, ENDPOINT_MAP as ENDPOINTS };
