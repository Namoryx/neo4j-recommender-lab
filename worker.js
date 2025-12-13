// src/index.js (Cloudflare Worker)

// ✅ 허용할 Origin(필요한 것만)
// - GitHub Pages
// - 로컬 개발 서버(원하면 추가/삭제)
const ALLOWED_ORIGINS = new Set([
  "https://namoryx.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

// ✅ /run 에서 막을 키워드(읽기 전용 강제)
const BLOCKED = /(CREATE|MERGE|DELETE|DETACH|SET|DROP|CALL|APOC)/i;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    try {
      // 1) Preflight: 무조건 먼저 처리 (CORS의 핵심)
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(req) });
      }

      // 2) Health: 반드시 CORS 포함해서 반환해야 브라우저가 안 막음
      if (url.pathname === "/health" && req.method === "GET") {
        return text(req, "neo4j-runner ok", 200);
      }

      // 3) Seed: 지금은 CSV 없이 “최소 하드코딩 데이터”만 넣는 용도
      //    - 나중에 CSV seed로 갈아끼울 자리
      if (url.pathname === "/seed") {
        if (req.method !== "POST") {
          return json(req, { ok: false, error: "Method Not Allowed", method: req.method }, 405);
        }

        const seedCypher = `
          MERGE (u1:User {id:'u1'}) SET u1.name='Alice'
          MERGE (u2:User {id:'u2'}) SET u2.name='Bob'
          MERGE (u3:User {id:'u3'}) SET u3.name='Chris'

          MERGE (i1:Item {id:'i1'}) SET i1.name='Graph DB Book', i1.category='book'
          MERGE (i2:Item {id:'i2'}) SET i2.name='Neo4j Mug', i2.category='goods'
          MERGE (i3:Item {id:'i3'}) SET i3.name='Cypher Cheat Sheet', i3.category='doc'
          MERGE (i4:Item {id:'i4'}) SET i4.name='Bouldering Chalk', i4.category='sport'

          WITH 1 as _
          MATCH (u1:User {id:'u1'}), (u2:User {id:'u2'}), (u3:User {id:'u3'})
          MATCH (i1:Item {id:'i1'}), (i2:Item {id:'i2'}), (i3:Item {id:'i3'}), (i4:Item {id:'i4'})

          MERGE (u1)-[:VIEW]->(i1)
          MERGE (u1)-[:CART]->(i2)
          MERGE (u2)-[:VIEW]->(i1)
          MERGE (u2)-[:BUY]->(i1)
          MERGE (u3)-[:VIEW]->(i2)
          MERGE (u3)-[:VIEW]->(i3)
          MERGE (u3)-[:VIEW]->(i4)

          RETURN 1 AS seeded
        `;

        const result = await runNeo4j(env, seedCypher, {});
        return json(req, result, 200);
      }

      // 4) Run: 게임이 부르는 메인 엔드포인트 (읽기 전용)
      if (url.pathname === "/" || url.pathname === "/run") {
        if (req.method !== "POST") {
          return json(req, { ok: false, error: "Method Not Allowed", method: req.method }, 405);
        }

        const body = await req.json().catch(() => ({}));
        let cypher = String(body?.cypher ?? "").trim();
        const params = body?.params ?? {};

        if (!cypher) return json(req, { ok: false, error: "cypher is required" }, 400);

        // 한 줄로 정리 (게임 입력 편의)
        cypher = cypher.replace(/\s*\n\s*/g, " ");

        // ✅ 읽기 전용 강제
        if (BLOCKED.test(cypher)) {
          return json(req, { ok: false, error: "Write/Procedure queries are not allowed" }, 400);
        }

        const result = await runNeo4j(env, cypher, params);
        return json(req, result, 200);
      }

      // 5) 나머지 경로
      return json(req, { ok: false, error: "Not Found", path: url.pathname }, 404);
    } catch (e) {
      return json(req, { ok: false, error: "Worker exception", detail: String(e) }, 500);
    }
  },
};

// ---------- helpers ----------
function cors(req) {
  const origin = req.headers.get("Origin") || "";
  // Origin이 없으면(서버-서버 호출, curl 등) *로 처리
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
  }

  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://namoryx.github.io";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req, obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=UTF-8" },
  });
}

function text(req, body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...cors(req), "Content-Type": "text/plain; charset=UTF-8" },
  });
}

async function runNeo4j(env, cypher, params) {
  const missing = ["NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"].filter((k) => !env[k]);
  if (missing.length) {
    return { ok: false, error: "Missing Worker secrets", missing };
  }

  const httpBase = String(env.NEO4J_URI)
    .replace("neo4j+s://", "https://")
    .replace("neo4j://", "https://");

  const db = env.NEO4J_DATABASE || "neo4j";
  const endpoint = `${httpBase}/db/${db}/query/v2`;

  const auth = "Basic " + btoa(`${env.NEO4J_USER}:${env.NEO4J_PASSWORD}`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ statement: cypher, parameters: params }),
  });

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!ct.includes("application/json")) {
    return {
      ok: false,
      error: "Neo4j did not return JSON",
      status: res.status,
      contentType: ct,
      endpoint,
      preview: text.slice(0, 300),
    };
  }

  const data = JSON.parse(text);

  return {
    ok: res.ok,
    status: res.status,
    endpoint,
    data: data?.data ?? null,
    bookmarks: data?.bookmarks ?? [],
    notifications: data?.notifications ?? [],
  };
}
