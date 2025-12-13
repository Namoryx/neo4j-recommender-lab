import { API_BASE } from './config.js';
import { apiFetch } from './diagnostics.js';

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

export async function runCypher(cypher, params = {}) {
  const { controller, clear } = withTimeout(10000);
  try {
    const { response, bodyText } = await apiFetch(
      `${API_BASE}/run`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cypher, params }),
        signal: controller.signal,
      },
      'Cypher 실행'
    );
    let json = {};
    try {
      json = JSON.parse(bodyText || '{}');
    } catch (err) {
      json = {};
    }
    if (!response.ok || json.error) {
      throw new Error(json.error || `쿼리 실행 실패 (HTTP ${response.status})`);
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
    const { response, bodyText } = await apiFetch(
      `${API_BASE}/seed`,
      { method: 'POST', signal: controller.signal },
      'Seed 실행'
    );
    let json = {};
    try {
      json = JSON.parse(bodyText || '{}');
    } catch (err) {
      json = {};
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

