import { renderTable, setFeedback, toast } from './render.js';
import { runCypher } from './api.js';

const STORAGE_KEYS = {
  seeded: 'game_seeded',
  score: 'game_score',
  current: 'game_currentQuestId',
  badges: 'game_badges',
  cleared: 'game_clearedIds',
};

export const quests = [
  {
    id: 'C0-Q1',
    chapter: 0,
    group: 'pre',
    title: '연결 확인',
    story: 'Neo4j Worker와의 연결을 점검합니다.',
    objective: 'RETURN 1 AS ok 를 실행해 연결이 되는지 확인하세요.',
    starterCypher: 'RETURN 1 AS ok',
    hints: ['Cypher는 대소문자를 구분합니다.', 'SELECT 대신 RETURN 키워드를 사용합니다.'],
    allowedOps: ['RETURN'],
    constraints: { denyWrite: true },
    checker: { type: 'rows_exact', expected: { columns: ['ok'], rows: [[1]] } },
  },
  {
    id: 'C0-Q2',
    chapter: 0,
    group: 'pre',
    title: '데이터 존재 여부 확인',
    story: 'DB가 비어있는지 먼저 확인합니다.',
    objective: 'MATCH (n) RETURN count(n) AS cnt 를 실행합니다.',
    starterCypher: 'MATCH (n) RETURN count(n) AS cnt',
    hints: ['count(n)은 모든 노드 수를 셉니다.', '결과가 0이면 Seed를 먼저 실행하세요.'],
    allowedOps: ['MATCH', 'RETURN'],
    constraints: { denyWrite: true },
    checker: {
      type: 'rows_range',
      expected: { columns: ['cnt'], min: 1 },
      feedback: {
        empty: '결과가 없습니다. MATCH 패턴을 다시 확인하세요.',
        low: '데이터가 없습니다. Seed를 먼저 실행하세요.',
      },
    },
  },
  {
    id: 'CH1-Q1',
    chapter: 1,
    group: 'post',
    title: '사용자 수 세기',
    story: '시드된 User 노드가 몇 개인지 확인합니다.',
    objective: 'User 레이블 노드 수를 반환하세요.',
    starterCypher: 'MATCH (u:User) RETURN count(u) AS users',
    hints: ['MATCH (u:User)로 User 레이블을 조회합니다.', 'count(u) AS users 로 별칭을 지정하세요.'],
    allowedOps: ['MATCH', 'RETURN'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: { type: 'rows_range', expected: { columns: ['users'], min: 4 }, success: 'OK! 최소 4명의 사용자가 보입니다.' },
  },
  {
    id: 'CH1-Q2',
    chapter: 1,
    group: 'post',
    title: '라벨 분포 요약',
    story: 'User와 Product 라벨이 모두 존재하는지 확인합니다.',
    objective: '라벨별 노드 수를 label, count 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS count ORDER BY label',
    hints: ['labels(n)을 UNWIND 합니다.', 'RETURN label, count(*) AS count 형태로 집계하세요.', 'ORDER BY label 로 정렬하면 비교가 쉽습니다.'],
    allowedOps: ['MATCH', 'UNWIND', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: {
        columns: ['label', 'count'],
        rows: [
          ['Product', 8],
          ['User', 4],
        ],
        key: 'label',
        minimumRows: 2,
      },
      feedback: {
        missingKey: 'label 컬럼이 필요합니다.',
        missingRows: 'Product와 User 라벨을 모두 포함해야 합니다.',
      },
    },
  },
  {
    id: 'CH1-Q3',
    chapter: 1,
    group: 'post',
    title: '상품 목록 확인',
    story: '시드된 상품을 전체 조회해 봅니다.',
    objective: '상품 id와 이름을 모두 반환하고 id로 정렬하세요.',
    starterCypher: 'MATCH (p:Product) RETURN p.id AS id, p.name AS name ORDER BY id',
    hints: ['Product 레이블을 사용하세요.', 'ORDER BY id 로 정렬하면 편합니다.', '컬럼 이름을 id, name 으로 맞추세요.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'rows_min',
      expected: { columns: ['id', 'name'], minRows: 8, key: 'id' },
      feedback: { tooFew: '상품이 8개 미만입니다. MATCH 조건을 확인하세요.' },
    },
  },
  {
    id: 'CH2-Q1',
    chapter: 2,
    group: 'post',
    title: '조회 이벤트 수',
    story: 'VIEWED 관계가 몇 건인지 셉니다.',
    objective: 'VIEWED 관계 수를 views 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (:User)-[r:VIEWED]->(:Product) RETURN count(r) AS views',
    hints: ['관계 타입은 대문자 VIEWED입니다.', 'count(r)으로 관계 수를 셉니다.', '컬럼 이름을 views로 지정합니다.'],
    allowedOps: ['MATCH', 'RETURN'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: { type: 'rows_range', expected: { columns: ['views'], min: 9 } },
  },
  {
    id: 'CH2-Q2',
    chapter: 2,
    group: 'post',
    title: 'U1이 구매한 상품',
    story: 'Alice(U1)가 구매 완료한 상품을 찾습니다.',
    objective: 'U1이 PURCHASED한 상품 id와 이름을 반환하세요.',
    starterCypher: 'MATCH (u:User {id:"U1"})-[:PURCHASED]->(p:Product) RETURN p.id AS product, p.name AS name ORDER BY product',
    hints: ['User {id:"U1"}로 특정 사용자를 찾습니다.', 'PURCHASED 관계를 따라가세요.', '반환 컬럼 이름을 product, name으로 맞춥니다.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: { columns: ['product', 'name'], rows: [['P1', 'Espresso Beans']], key: 'product', minimumRows: 1 },
      feedback: { missingRows: 'P1 구매 내역을 포함해야 합니다.' },
    },
  },
  {
    id: 'CH2-Q3',
    chapter: 2,
    group: 'post',
    title: '커피 카테고리 구매',
    story: 'Coffee 카테고리 상품을 구매한 기록을 조회합니다.',
    objective: '카테고리 Coffee 중 구매된 상품 id와 구매자 id를 반환하세요.',
    starterCypher: 'MATCH (u:User)-[:PURCHASED]->(p:Product {category:"Coffee"}) RETURN u.id AS user, p.id AS product ORDER BY user',
    hints: ['Product.category 필드를 사용하세요.', 'PURCHASED 관계로 구매를 연결합니다.', 'DISTINCT가 필요 없는지 확인해 보세요.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: {
        columns: ['user', 'product'],
        rows: [
          ['U3', 'P4'],
          ['U4', 'P6'],
        ],
        key: 'user',
        minimumRows: 2,
      },
      feedback: { missingRows: 'U3-P4와 U4-P6 모두 포함되어야 합니다.' },
    },
  },
  {
    id: 'CH3-Q1',
    chapter: 3,
    group: 'post',
    title: '가장 많이 조회된 상품 TOP2',
    story: 'VIEWED 횟수 기준 상위 2개 상품을 찾습니다.',
    objective: '상품 id와 조회 수를 조회하여 상위 2개만 반환하세요.',
    starterCypher: 'MATCH (:User)-[r:VIEWED]->(p:Product) RETURN p.id AS product, count(r) AS views ORDER BY views DESC, product ASC LIMIT 2',
    hints: ['ORDER BY views DESC로 정렬합니다.', '동일 뷰 수일 때 product ASC로 정렬하면 안정적입니다.', 'LIMIT 2로 상위 2개만 반환합니다.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY', 'LIMIT'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'rows_exact',
      expected: { columns: ['product', 'views'], rows: [['P1', 3], ['P3', 3]] },
      feedback: {
        mismatch: '상위 2개가 아니거나 정렬이 다릅니다. ORDER BY / LIMIT을 확인하세요.',
      },
    },
  },
  {
    id: 'CH3-Q2',
    chapter: 3,
    group: 'post',
    title: '조회 후 구매한 사용자',
    story: '상품을 조회하고 구매까지 한 사용자를 찾습니다.',
    objective: 'VIEWED와 PURCHASED를 모두 가진 사용자 id를 반환하세요.',
    starterCypher: 'MATCH (u:User)-[:VIEWED]->(:Product)\nMATCH (u)-[:PURCHASED]->(:Product)\nRETURN DISTINCT u.id AS user ORDER BY user',
    hints: ['두 개의 MATCH를 사용하여 동일 사용자 u를 재사용합니다.', 'DISTINCT u.id 로 중복을 제거합니다.', 'ORDER BY user 로 정렬합니다.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY', 'DISTINCT'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: { columns: ['user'], rows: [['U1'], ['U2'], ['U3'], ['U4']], key: 'user', minimumRows: 4 },
      feedback: { missingRows: 'U1~U4까지 모두 포함되어야 합니다.' },
    },
  },
  {
    id: 'CH3-Q3',
    chapter: 3,
    group: 'post',
    title: '구매되지 않은 상품',
    story: '아직 판매되지 않은 상품을 찾습니다.',
    objective: 'PURCHASED 관계가 없는 상품 id를 반환하세요.',
    starterCypher: 'MATCH (p:Product) WHERE NOT ( ()-[:PURCHASED]->(p) ) RETURN p.id AS product ORDER BY product',
    hints: ['NOT ()-[:PURCHASED]->(p) 패턴으로 구매 여부를 확인합니다.', 'ORDER BY로 정렬하면 결과 비교가 쉽습니다.'],
    allowedOps: ['MATCH', 'WHERE', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: { columns: ['product'], rows: [['P2'], ['P5'], ['P7']], key: 'product', minimumRows: 3 },
      feedback: { missingRows: 'P2, P5, P7이 모두 필요합니다.' },
    },
  },
  {
    id: 'CH4-Q1',
    chapter: 4,
    group: 'post',
    title: '사용자별 구매 수 요약',
    story: '누가 가장 많이 구매했는지 확인합니다.',
    objective: '사용자별 PURCHASED 건수를 user, purchases 컬럼으로 반환하고 건수 내림차순으로 정렬하세요.',
    starterCypher: 'MATCH (u:User)-[r:PURCHASED]->(:Product) RETURN u.id AS user, count(r) AS purchases ORDER BY purchases DESC, user',
    hints: ['관계 변수 r을 count에 사용하세요.', 'ORDER BY purchases DESC, user ASC 조합을 추천합니다.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'rows_min',
      expected: { columns: ['user', 'purchases'], minRows: 3, key: 'user', minValueColumn: 'purchases', minValue: 1 },
      feedback: { tooFew: '최소 3명의 사용자 집계가 필요합니다.' },
    },
  },
  {
    id: 'CH4-Q2',
    chapter: 4,
    group: 'post',
    title: '구매 상위 상품',
    story: '가장 많이 구매된 상품을 찾아 추천 후보를 만듭니다.',
    objective: '상품별 PURCHASED 수를 집계해 purchases 기준 내림차순 상위 1개를 반환하세요.',
    starterCypher: 'MATCH (:User)-[r:PURCHASED]->(p:Product) RETURN p.id AS product, count(r) AS purchases ORDER BY purchases DESC LIMIT 1',
    hints: ['MATCH (:User)-[r:PURCHASED]->(p:Product)', 'ORDER BY purchases DESC 후 LIMIT 1을 적용합니다.', '컬럼 이름 product, purchases를 사용하세요.'],
    allowedOps: ['MATCH', 'RETURN', 'ORDER BY', 'LIMIT'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'rows_min',
      expected: { columns: ['product', 'purchases'], minRows: 1, key: 'product', minValueColumn: 'purchases', minValue: 1 },
      feedback: { tooFew: '최소 1개의 결과가 필요합니다. LIMIT 설정을 확인하세요.' },
    },
  },
  {
    id: 'CH4-Q3',
    chapter: 4,
    group: 'post',
    title: '추천 후보 찾기',
    story: '조회만 하고 구매하지 않은 상품을 찾아 추천 리스트를 만듭니다.',
    objective: 'PURCHASED 없이 VIEWED만 있는 상품 id를 반환하세요.',
    starterCypher: 'MATCH (p:Product)<-[:VIEWED]-(:User) WHERE NOT ( ()-[:PURCHASED]->(p) ) RETURN DISTINCT p.id AS product ORDER BY product',
    hints: ['VIEWED 관계를 기준으로 p를 찾은 뒤 구매 여부를 부정합니다.', 'DISTINCT를 사용해 중복을 제거하세요.', 'ORDER BY product 로 정렬합니다.'],
    allowedOps: ['MATCH', 'WHERE', 'RETURN', 'DISTINCT', 'ORDER BY'],
    constraints: { denyWrite: true, requireSeed: true },
    checker: {
      type: 'set_contains',
      expected: { columns: ['product'], rows: [['P2'], ['P5']], key: 'product', minimumRows: 2 },
      feedback: { missingRows: 'P2와 P5는 추천 후보에 포함되어야 합니다.' },
    },
  },
];

function normalizeColumns(arr = []) {
  return arr.map((c) => String(c).toLowerCase());
}

function findColumnIndex(columns, target) {
  return normalizeColumns(columns).findIndex((c) => c === String(target).toLowerCase());
}

function rowsToMap(rows, columns, key) {
  const idx = findColumnIndex(columns, key);
  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row[idx]), row);
  });
  return map;
}

function checkColumns(fields, expected) {
  const normFields = normalizeColumns(fields);
  const normExpected = normalizeColumns(expected);
  return normExpected.length === normFields.length && normExpected.every((c, i) => c === normFields[i]);
}

export function loadState() {
  return {
    seeded: localStorage.getItem(STORAGE_KEYS.seeded) === 'true',
    score: Number(localStorage.getItem(STORAGE_KEYS.score) || 0),
    currentQuestId: localStorage.getItem(STORAGE_KEYS.current) || quests[0].id,
    badges: JSON.parse(localStorage.getItem(STORAGE_KEYS.badges) || '[]'),
    clearedIds: JSON.parse(localStorage.getItem(STORAGE_KEYS.cleared) || '[]'),
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEYS.seeded, state.seeded ? 'true' : 'false');
  localStorage.setItem(STORAGE_KEYS.score, String(state.score || 0));
  localStorage.setItem(STORAGE_KEYS.current, state.currentQuestId);
  localStorage.setItem(STORAGE_KEYS.badges, JSON.stringify(state.badges || []));
  localStorage.setItem(STORAGE_KEYS.cleared, JSON.stringify(state.clearedIds || []));
}

export function availableQuests(seeded) {
  return quests.filter((q) => q.group === 'pre' || seeded);
}

export function getQuestById(id) {
  return quests.find((q) => q.id === id) || quests[0];
}

export function nextQuestId(currentId, seeded) {
  const list = availableQuests(seeded);
  const idx = list.findIndex((q) => q.id === currentId);
  return list[idx + 1]?.id || currentId;
}

export async function runCurrentQuest(state, quest) {
  const textarea = document.getElementById('cypher-input');
  const resultShell = document.getElementById('result-shell');
  if (!textarea || !resultShell) return null;
  const cypher = textarea.value.trim();
  if (!cypher) {
    toast('Cypher를 입력하세요.', 'error');
    return null;
  }
  const validation = validateCypher(cypher, quest);
  if (!validation.ok) {
    toast(validation.message, 'warning');
    return null;
  }
  const result = await runCypher(cypher);
  renderTable(result, resultShell);
  setFeedback('실행 완료. Submit으로 채점하세요.', null);
  return result;
}

export function evaluate(quest, result) {
  if (!quest?.checker) {
    return { correct: false, feedback: '채점 규칙이 정의되지 않았습니다.' };
  }

  try {
    return evaluateChecker(result, quest.checker);
  } catch (err) {
    return { correct: false, feedback: '채점 중 오류가 발생했습니다.' };
  }
}

function evaluateChecker(result, checker) {
  if (!result || !Array.isArray(result.fields) || !Array.isArray(result.values)) {
    return { correct: false, feedback: '결과를 읽을 수 없습니다.' };
  }

  const expected = checker.expected || {};
  if (expected.columns && expected.columns.length && !checkColumns(result.fields, expected.columns)) {
    return { correct: false, feedback: '컬럼명이 맞지 않습니다. RETURN 절의 별칭을 확인하세요.' };
  }

  switch (checker.type) {
    case 'rows_exact':
      return evalRowsExact(result, expected, checker.feedback);
    case 'set_contains':
      return evalSetContains(result, expected, checker.feedback);
    case 'rows_range':
      return evalRowsRange(result, expected, checker.feedback);
    case 'rows_min':
      return evalRowsMin(result, expected, checker.feedback);
    default:
      return { correct: false, feedback: '지원하지 않는 채점 유형입니다.' };
  }
}

function evalRowsExact(result, expected, feedback = {}) {
  const sameLength = result.values.length === (expected.rows || []).length;
  const match = sameLength && JSON.stringify(result.values) === JSON.stringify(expected.rows || []);
  if (!match) {
    return { correct: false, feedback: feedback?.mismatch || '결과가 예상과 다릅니다. 정렬과 집계를 확인하세요.' };
  }
  return { correct: true, feedback: feedback?.success || '정답입니다! 🎉' };
}

function evalSetContains(result, expected, feedback = {}) {
  const { rows = [], key, minimumRows = rows.length } = expected;
  if (!key) {
    return { correct: false, feedback: 'key 설정이 필요합니다.' };
  }

  const keyIdx = findColumnIndex(expected.columns || result.fields, key);
  if (keyIdx === -1) {
    return { correct: false, feedback: feedback?.missingKey || `${key} 컬럼을 반환해야 합니다.` };
  }

  const actualKeys = new Set((result.values || []).map((row) => String(row[keyIdx])));
  const expectedKeys = rows.map((row) => String(row[keyIdx] ?? row[0]));
  const missing = expectedKeys.filter((k) => !actualKeys.has(k));

  if (missing.length) {
    return { correct: false, feedback: feedback?.missingRows || `${missing.join(', ')} 값이 누락되었습니다.` };
  }

  if ((result.values || []).length < minimumRows) {
    return { correct: false, feedback: feedback?.tooFew || `최소 ${minimumRows}행 이상 반환해야 합니다.` };
  }

  return { correct: true, feedback: feedback?.success || '정답입니다! 🎉' };
}

function evalRowsRange(result, expected, feedback = {}) {
  const val = Number(result.values?.[0]?.[0] ?? 0);
  if (!result.values?.length) {
    return { correct: false, feedback: feedback?.empty || '결과가 없습니다. MATCH 절을 확인하세요.' };
  }
  if (val < (expected.min ?? 0)) {
    return { correct: false, feedback: feedback?.low || `${expected.min} 이상이어야 합니다.` };
  }
  return { correct: true, feedback: feedback?.success || '정답입니다! 🎉' };
}

function evalRowsMin(result, expected, feedback = {}) {
  const { minRows = 1, key, minValueColumn, minValue } = expected;
  if ((result.values || []).length < minRows) {
    return { correct: false, feedback: feedback?.tooFew || `최소 ${minRows}행이 필요합니다.` };
  }

  if (minValueColumn) {
    const idx = findColumnIndex(expected.columns || result.fields, minValueColumn);
    if (idx === -1) {
      return { correct: false, feedback: `${minValueColumn} 컬럼이 필요합니다.` };
    }
    const hasMin = (result.values || []).some((row) => Number(row[idx]) >= (minValue ?? 0));
    if (!hasMin) {
      return { correct: false, feedback: `${minValueColumn} 값이 ${minValue} 이상인 행이 필요합니다.` };
    }
  }

  if (key) {
    const uniqueCount = rowsToMap(result.values || [], expected.columns || result.fields, key).size;
    if (uniqueCount < minRows) {
      return { correct: false, feedback: feedback?.tooFew || `중복을 제거하면 ${minRows}개 미만입니다.` };
    }
  }

  return { correct: true, feedback: feedback?.success || '정답입니다! 🎉' };
}

function validateCypher(query, quest) {
  if (!quest) return { ok: true, message: '' };
  const upper = query.toUpperCase();
  if (quest.constraints?.denyWrite && /(CREATE|MERGE|DELETE|SET)\s+/i.test(query)) {
    return { ok: false, message: '쓰기 연산은 허용되지 않습니다. MATCH/RETURN만 사용하세요.' };
  }

  if (Array.isArray(quest.allowedOps) && quest.allowedOps.length) {
    const ops = upper.match(/\b([A-Z]+)\b/g) || [];
    const normalizedAllowed = quest.allowedOps.flatMap((o) => o.toUpperCase().split(/\s+/));
    const disallowed = ops.filter((op) =>
      ['MATCH', 'RETURN', 'WHERE', 'UNWIND', 'WITH', 'ORDER', 'BY', 'LIMIT', 'DISTINCT', 'CALL', 'OPTIONAL', 'UNION'].includes(
        op
      ) && !normalizedAllowed.includes(op)
    );
    if (disallowed.length) {
      return { ok: false, message: `허용되지 않은 키워드가 있습니다: ${[...new Set(disallowed)].join(', ')}` };
    }
  }

  return { ok: true, message: '' };
}
