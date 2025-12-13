import { getQuestById } from './worker-quests.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function validateQuery(raw, { allowWrite = false } = {}) {
  const query = raw.trim();
  if (!query) return { ok: false, reason: 'Cypher 쿼리가 비어 있습니다.' };

  const lowered = query.toLowerCase();
  if (!allowWrite && (/\b(create|merge|delete|detach|set|drop|call)\b/.test(lowered) || /apoc\./.test(lowered))) {
    return { ok: false, reason: '쓰기 또는 위험 연산은 허용되지 않습니다.' };
  }

  const semicolonCount = (query.match(/;/g) || []).length;
  if (semicolonCount > 1) {
    return { ok: false, reason: '세미콜론이 두 개 이상 포함된 쿼리는 거부됩니다.' };
  }

  const cleaned = query.replace(/;\s*$/, '');
  const needsLimit = !/limit\s+\d+/i.test(cleaned) && !/count\s*\(/i.test(cleaned);
  const finalQuery = needsLimit ? `${cleaned} LIMIT 100` : cleaned;

  return { ok: true, query: finalQuery };
}

async function executeCypher(query, env, signal) {
  const endpoint = `${env.NEO4J_URI.replace(/\/?$/, '')}/db/neo4j/tx/commit`;
  const payload = {
    statements: [
      {
        statement: query,
        resultDataContents: ['row'],
        includeStats: false,
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${env.NEO4J_USER}:${env.NEO4J_PASSWORD}`)}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Neo4j HTTP error: ${res.status}`);
  }

  const body = await res.json();
  if (body.errors?.length) {
    const first = body.errors[0];
    throw new Error(first.message || 'Neo4j 쿼리 오류');
  }

  const result = body.results?.[0];
  return {
    fields: result?.columns || [],
    values: (result?.data || []).map((item) => item.row),
  };
}

async function handleRun(request, env) {
  let cypher;
  try {
    const body = await request.json();
    cypher = body?.cypher;
  } catch (err) {
    return errorResponse('잘못된 JSON 요청입니다.');
  }

  if (typeof cypher !== 'string') {
    return errorResponse('cypher 필드가 필요합니다.');
  }

  const validation = validateQuery(cypher);
  if (!validation.ok) {
    return errorResponse(validation.reason, 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const result = await executeCypher(validation.query, env, controller.signal);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 400;
    const message = err.name === 'AbortError' ? '쿼리 실행이 시간 초과되었습니다.' : err.message;
    return errorResponse(message, status);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleSeed(env) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const check = await executeCypher('MATCH (u:User) RETURN count(u) AS users', env, controller.signal);
    const already = Number(check.values?.[0]?.[0] ?? 0) > 0;
    if (already) {
      return new Response(JSON.stringify({ ok: true, seeded: false, error: 'already seeded' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    await executeCypher(SEED_CYPHER, env, controller.signal);
    return new Response(JSON.stringify({ ok: true, seeded: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 400;
    const message = err.name === 'AbortError' ? 'Seed가 시간 초과되었습니다.' : err.message;
    return errorResponse(message, status);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleSubmit(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return errorResponse('잘못된 JSON 요청입니다.');
  }

  const cypher = payload?.cypher;
  const questId = payload?.questId;

  if (typeof cypher !== 'string' || typeof questId !== 'string') {
    return errorResponse('questId와 cypher 필드가 필요합니다.');
  }

  const quest = getQuestById(questId);
  if (!quest) {
    return errorResponse('알 수 없는 퀘스트입니다.', 404);
  }

  const validation = validateQuery(cypher, { allowWrite: quest.allowWrite });
  if (!validation.ok) {
    return errorResponse(validation.reason, 400);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const result = await executeCypher(validation.query, env, controller.signal);
    let evaluation;
    try {
      evaluation = quest.checker(result);
    } catch (err) {
      evaluation = { correct: false, feedback: '채점 중 오류가 발생했습니다.' };
    }
    return new Response(
      JSON.stringify({
        ok: true,
        questId: quest.id,
        columns: result.fields,
        rows: result.values,
        evaluation: {
          correct: Boolean(evaluation?.correct),
          feedback: evaluation?.feedback || '채점 결과를 확인할 수 없습니다.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 400;
    const message = err.name === 'AbortError' ? '쿼리 실행이 시간 초과되었습니다.' : err.message;
    return errorResponse(message, status);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleReset(request, env) {
  if (!env.ADMIN_TOKEN) {
    return errorResponse('초기화 기능이 비활성화되었습니다.', 403);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== env.ADMIN_TOKEN) {
    return errorResponse('인증되지 않았습니다.', 401);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    await executeCypher('MATCH (n) DETACH DELETE n', env, controller.signal);
    return new Response(JSON.stringify({ ok: true, reset: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 400;
    const message = err.name === 'AbortError' ? '초기화가 시간 초과되었습니다.' : err.message;
    return errorResponse(message, status);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (pathname === '/health' && request.method === 'GET') {
      return new Response('neo4j-runner v3 (seed-enabled)', { headers: corsHeaders });
    }

    if (pathname === '/seed' && request.method === 'POST') {
      return handleSeed(env);
    }

    if (pathname === '/run' && request.method === 'POST') {
      return handleRun(request, env);
    }

    if (pathname === '/submit' && request.method === 'POST') {
      return handleSubmit(request, env);
    }

    if (pathname === '/reset' && request.method === 'POST') {
      return handleReset(request, env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
