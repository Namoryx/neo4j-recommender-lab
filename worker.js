const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      const message = err.name === 'AbortError' ? '쿼리 실행이 시간 초과되었습니다.' : err.message;
      return errorResponse(message, status);
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
