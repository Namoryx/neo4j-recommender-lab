const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SEED_CYPHER = `
UNWIND [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
  { name: "Charlie", email: "charlie@example.com" }
] AS userData
MERGE (u:User {email: userData.email})
SET u.name = userData.name
WITH collect(u) AS users
UNWIND [
  { title: "Graph Algorithms", category: "Book" },
  { title: "Cypher Mastery", category: "Course" },
  { title: "Building Recommenders", category: "Workshop" }
] AS itemData
MERGE (i:Item {title: itemData.title})
SET i.category = itemData.category
WITH users, collect(i) AS items
UNWIND [
  { email: "alice@example.com", title: "Graph Algorithms", score: 0.92 },
  { email: "alice@example.com", title: "Cypher Mastery", score: 0.85 },
  { email: "bob@example.com", title: "Building Recommenders", score: 0.9 },
  { email: "charlie@example.com", title: "Graph Algorithms", score: 0.73 },
  { email: "charlie@example.com", title: "Building Recommenders", score: 0.66 }
] AS interaction
MATCH (u:User {email: interaction.email})
MATCH (i:Item {title: interaction.title})
MERGE (u)-[r:INTERACTED]->(i)
SET r.score = interaction.score;
`;

const SEED_CHECK_QUERY = 'MATCH (u:User) RETURN count(u) AS users';

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function validateQuery(raw) {
  const query = raw.trim();
  if (!query) return { ok: false, reason: 'Cypher 쿼리가 비어 있습니다.' };

  const lowered = query.toLowerCase();
  if (/\b(create|merge|delete|detach|set|drop|call)\b/.test(lowered) || /apoc\./.test(lowered)) {
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

function validateEnv(env) {
  const required = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'];
  const missing = required.filter((key) => !env?.[key]);

  if (missing.length) {
    const joined = missing.join(', ');
    return {
      ok: false,
      reason: `필수 환경변수(${joined})가 누락되었습니다. wrangler.toml과 Worker Secrets 설정을 확인하세요.`,
    };
  }

  return { ok: true };
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
    columns: result?.columns || [],
    rows: (result?.data || []).map((item) => item.row),
  };
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

    const envValidation = validateEnv(env);
    if (!envValidation.ok) {
      return errorResponse(envValidation.reason, 500);
    }

    if (pathname === '/seed' && request.method === 'POST') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const check = await executeCypher(SEED_CHECK_QUERY, env, controller.signal);
        const users = Number(check.rows?.[0]?.[0] || 0);
        if (users > 0) {
          return new Response(JSON.stringify({ ok: false, error: 'already seeded' }), {
            status: 400,
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
        const message = err.name === 'AbortError' ? '쿼리 실행이 시간 과되었습니다.' : err.message;
        return errorResponse(message, status);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (pathname !== '/run' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

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
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      const status = err.name === 'AbortError' ? 504 : 400;
      const message = err.name === 'AbortError' ? '쿼리 실행이 시간 과되었습니다.' : err.message;
      return errorResponse(message, status);
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
