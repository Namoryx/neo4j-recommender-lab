import { API_BASE } from './config.js';
import { apiFetch } from './diagnostics.js';

const SEED_CYPHER = `
UNWIND [
  {id:"U1", name:"Alice"},
  {id:"U2", name:"Bob"},
  {id:"U3", name:"Chloe"},
  {id:"U4", name:"Dan"},
  {id:"U5", name:"Evan"}
] AS u
MERGE (x:User {id:u.id}) SET x.name = u.name;

UNWIND [
  {id:"P1", name:"Whisky A", category:"Whisky"},
  {id:"P2", name:"Whisky B", category:"Whisky"},
  {id:"P3", name:"Whisky C", category:"Whisky"},
  {id:"P4", name:"Coffee Beans", category:"Coffee"},
  {id:"P5", name:"Dripper", category:"Coffee"},
  {id:"P6", name:"Mug", category:"Coffee"},
  {id:"P7", name:"Protein Bar", category:"Fitness"},
  {id:"P8", name:"Yoga Mat", category:"Fitness"}
] AS p
MERGE (y:Product {id:p.id})
SET y.name = p.name, y.category = p.category;

UNWIND [
  {u:"U1", p:"P1", t:"VIEWED"},
  {u:"U1", p:"P2", t:"VIEWED"},
  {u:"U1", p:"P1", t:"ADDED_TO_CART"},
  {u:"U1", p:"P1", t:"PURCHASED"},

  {u:"U2", p:"P1", t:"VIEWED"},
  {u:"U2", p:"P3", t:"VIEWED"},
  {u:"U2", p:"P3", t:"ADDED_TO_CART"},
  {u:"U2", p:"P3", t:"PURCHASED"},

  {u:"U3", p:"P4", t:"VIEWED"},
  {u:"U3", p:"P5", t:"VIEWED"},
  {u:"U3", p:"P4", t:"PURCHASED"},
  {u:"U3", p:"P5", t:"ADDED_TO_CART"},

  {u:"U4", p:"P4", t:"VIEWED"},
  {u:"U4", p:"P6", t:"VIEWED"},
  {u:"U4", p:"P6", t:"PURCHASED"},

  {u:"U5", p:"P7", t:"VIEWED"},
  {u:"U5", p:"P8", t:"ADDED_TO_CART"},
  {u:"U5", p:"P8", t:"PURCHASED"}
] AS e
MATCH (u:User {id:e.u}), (p:Product {id:e.p})
FOREACH (_ IN CASE WHEN e.t="VIEWED" THEN [1] ELSE [] END |
  MERGE (u)-[r:VIEWED]->(p)
  ON CREATE SET r.count=1
  ON MATCH SET r.count=r.count+1
)
FOREACH (_ IN CASE WHEN e.t="ADDED_TO_CART" THEN [1] ELSE [] END |
  MERGE (u)-[r:ADDED_TO_CART]->(p)
  ON CREATE SET r.count=1
  ON MATCH SET r.count=r.count+1
)
FOREACH (_ IN CASE WHEN e.t="PURCHASED" THEN [1] ELSE [] END |
  MERGE (u)-[r:PURCHASED]->(p)
  ON CREATE SET r.count=1
  ON MATCH SET r.count=r.count+1
);
`;

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

const READ_ONLY_MESSAGE =
  '현재 실행 중인 러너는 읽기 전용입니다. /seed 엔드포인트가 있는 배포나 쓰기가 허용된 러너에서 샘플 데이터를 로드하세요.';

function isReadOnlyError(err) {
  const message = err?.message || '';
  return message.includes('쓰기 또는 위험 연산은 허용되지 않습니다.') || /HTTP\s*400/.test(message);
}

export async function seedData() {
  const { controller, clear } = withTimeout(10000);
  let primaryError = null;
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
    if (response.ok) {
      return json;
    }
    primaryError = new Error(json.error || `Seed 실패 (HTTP ${response.status})`);
  } catch (err) {
    primaryError = err;
  } finally {
    clear();
  }

  // Fallback: some runner deployments expose only /run; try seeding directly.
  try {
    await runCypher(SEED_CYPHER);
    return { ok: true, seeded: true, via: 'run' };
  } catch (err) {
    if (isReadOnlyError(err)) {
      return { ok: false, readOnly: true, error: READ_ONLY_MESSAGE };
    }
    throw primaryError || err;
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

