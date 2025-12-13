import { API_BASE, getEndpoints } from '../src/config.js';

const ENDPOINT_MAP = getEndpoints();

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
  let primaryError = null;
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

export { API_BASE, ENDPOINT_MAP as ENDPOINTS };
