import { renderTable, setFeedback, toast } from './render.js';
import { runCypher } from './api.js';

const STORAGE_KEYS = {
  seeded: 'game_seeded',
  score: 'game_score',
  current: 'game_currentQuestId',
  badges: 'game_badges',
};

export const quests = [
  {
    id: 'C0-Q1',
    group: 'pre',
    title: '연결 확인',
    story: 'Neo4j Worker와의 연결을 점검합니다.',
    objective: 'RETURN 1 AS ok 를 실행해 연결이 되는지 확인하세요.',
    starterCypher: 'RETURN 1 AS ok',
    hints: ['Cypher는 대소문자를 구분합니다.', 'SELECT 대신 RETURN 키워드를 사용합니다.'],
    checker: (result) => {
      const val = result.values?.[0]?.[0];
      const ok = Number(val) === 1;
      return { correct: ok, feedback: ok ? '연결 확인 완료!' : '결과가 1이 아닙니다.' };
    },
  },
  {
    id: 'C0-Q2',
    group: 'pre',
    title: '데이터 존재 여부 확인',
    story: 'DB가 비어있는지 먼저 확인합니다.',
    objective: 'MATCH (n) RETURN count(n) AS cnt 를 실행합니다.',
    starterCypher: 'MATCH (n) RETURN count(n) AS cnt',
    hints: ['count(n)은 모든 노드 수를 셉니다.', '결과가 0이면 Seed를 먼저 실행하세요.'],
    checker: (result) => {
      const cnt = Number(result.values?.[0]?.[0] ?? 0);
      if (cnt === 0) {
        return { correct: false, feedback: '데이터가 없습니다. Seed를 먼저 실행하세요.' };
      }
      return { correct: true, feedback: '데이터가 있습니다! 본 퀘스트를 진행하세요.' };
    },
  },
  {
    id: 'C1-Q1',
    group: 'post',
    title: '사용자 수 세기',
    story: '시드된 User 노드가 몇 개인지 확인합니다.',
    objective: 'User 레이블 노드 수를 반환하세요.',
    starterCypher: 'MATCH (u:User) RETURN count(u) AS users',
    hints: ['MATCH (u:User)로 User 레이블을 조회합니다.', 'count(u) AS users 로 별칭을 지정하세요.'],
    checker: (result) => {
      const users = Number(result.values?.[0]?.[0] ?? 0);
      return { correct: users >= 5, feedback: users >= 5 ? 'OK! 최소 5명의 사용자가 보입니다.' : 'User 수가 부족합니다.' };
    },
  },
  {
    id: 'C1-Q2',
    group: 'post',
    title: '상품 목록 확인',
    story: '시드된 상품 8개를 조회합니다.',
    objective: '상품 id와 이름을 모두 반환하세요.',
    starterCypher: 'MATCH (p:Product) RETURN p.id AS id, p.name AS name ORDER BY id',
    hints: ['Product 레이블을 사용하세요.', 'ORDER BY id 로 정렬하면 편합니다.'],
    checker: (result) => {
      const count = result.values?.length || 0;
      return { correct: count >= 8, feedback: count >= 8 ? '8개 이상의 상품이 조회되었습니다.' : '상품이 8개 미만입니다.' };
    },
  },
  {
    id: 'C1-Q3',
    group: 'post',
    title: '조회 이벤트 수',
    story: 'VIEWED 관계가 몇 건인지 셉니다.',
    objective: 'VIEWED 관계 수를 반환하세요.',
    starterCypher: 'MATCH (:User)-[r:VIEWED]->(:Product) RETURN count(r) AS views',
    hints: ['관계 타입은 대문자 VIEWED입니다.', 'count(r)으로 관계 수를 셉니다.'],
    checker: (result) => {
      const views = Number(result.values?.[0]?.[0] ?? 0);
      return { correct: views >= 9, feedback: views >= 9 ? '조회 이벤트가 충분히 조회되었습니다.' : '조회 수가 예상보다 적습니다.' };
    },
  },
  {
    id: 'C1-Q4',
    group: 'post',
    title: 'U1이 구매한 상품',
    story: 'Alice(U1)가 구매 완료한 상품을 찾습니다.',
    objective: 'U1이 PURCHASED한 상품 id와 이름을 반환하세요.',
    starterCypher: 'MATCH (u:User {id:"U1"})-[:PURCHASED]->(p:Product) RETURN p.id, p.name',
    hints: ['User {id:"U1"}로 특정 사용자를 찾습니다.', 'PURCHASED 관계를 따라가세요.'],
    checker: (result) => {
      const ids = (result.values || []).map((r) => r[0]);
      const ok = ids.includes('P1');
      return { correct: ok, feedback: ok ? 'U1이 구매한 P1을 찾았습니다.' : 'P1 결과가 필요합니다.' };
    },
  },
  {
    id: 'C1-Q5',
    group: 'post',
    title: '커피 카테고리 구매',
    story: 'Coffee 카테고리 상품을 구매한 기록을 조회합니다.',
    objective: '카테고리 Coffee 중 구매된 상품 id와 구매자 id를 반환하세요.',
    starterCypher: 'MATCH (u:User)-[:PURCHASED]->(p:Product {category:"Coffee"}) RETURN u.id AS user, p.id AS product ORDER BY user',
    hints: ['Product.category 필드를 사용하세요.', 'PURCHASED 관계로 구매를 연결합니다.'],
    checker: (result) => {
      const rows = result.values || [];
      const ok = rows.some((r) => r[0] === 'U3' && r[1] === 'P4') && rows.some((r) => r[0] === 'U4' && r[1] === 'P6');
      return { correct: ok, feedback: ok ? '커피 구매 내역을 모두 찾았습니다.' : 'U3-P4와 U4-P6 모두 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q6',
    group: 'post',
    title: '가장 많이 조회된 상품 TOP2',
    story: 'VIEWED 횟수 기준 상위 2개 상품을 찾습니다.',
    objective: '상품 id와 조회 수를 조회하여 상위 2개만 반환하세요.',
    starterCypher: 'MATCH (:User)-[r:VIEWED]->(p:Product) RETURN p.id AS product, count(r) AS views ORDER BY views DESC LIMIT 2',
    hints: ['ORDER BY views DESC로 정렬합니다.', 'LIMIT 2로 상위 2개만 반환합니다.'],
    checker: (result) => {
      const rows = result.values || [];
      const hasP1 = rows.some((r) => r[0] === 'P1');
      return { correct: hasP1 && rows.length === 2, feedback: hasP1 ? '상위 2개가 반환되었습니다.' : 'P1이 상위에 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q7',
    group: 'post',
    title: '조회 후 구매한 사용자',
    story: '상품을 조회하고 구매까지 한 사용자를 찾습니다.',
    objective: 'VIEWED와 PURCHASED를 모두 가진 사용자 id를 반환하세요.',
    starterCypher: 'MATCH (u:User)-[:VIEWED]->(:Product)\nMATCH (u)-[:PURCHASED]->(:Product)\nRETURN DISTINCT u.id ORDER BY u.id',
    hints: ['두 개의 MATCH를 사용하여 동일 사용자 u를 재사용합니다.', 'DISTINCT u.id 로 중복을 제거합니다.'],
    checker: (result) => {
      const ids = (result.values || []).flat();
      const expected = ['U1', 'U2', 'U3', 'U4'];
      const ok = expected.every((id) => ids.includes(id));
      return { correct: ok, feedback: ok ? '조회 후 구매한 모든 사용자를 찾았습니다.' : 'U1~U4까지 모두 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q8',
    group: 'post',
    title: '구매되지 않은 상품',
    story: '아직 판매되지 않은 상품을 찾습니다.',
    objective: 'PURCHASED 관계가 없는 상품 id를 반환하세요.',
    starterCypher: 'MATCH (p:Product) WHERE NOT ( ()-[:PURCHASED]->(p) ) RETURN p.id ORDER BY p.id',
    hints: ['NOT ()-[:PURCHASED]->(p) 패턴으로 구매 여부를 확인합니다.', 'ORDER BY로 정렬하면 결과 비교가 쉽습니다.'],
    checker: (result) => {
      const ids = (result.values || []).map((r) => r[0]);
      const ok = ids.includes('P2') && ids.includes('P5') && ids.includes('P7');
      return { correct: ok, feedback: ok ? '구매되지 않은 상품을 모두 찾았습니다.' : 'P2, P5, P7이 모두 필요합니다.' };
    },
  },
];

export function loadState() {
  return {
    seeded: localStorage.getItem(STORAGE_KEYS.seeded) === 'true',
    score: Number(localStorage.getItem(STORAGE_KEYS.score) || 0),
    currentQuestId: localStorage.getItem(STORAGE_KEYS.current) || quests[0].id,
    badges: JSON.parse(localStorage.getItem(STORAGE_KEYS.badges) || '[]'),
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEYS.seeded, state.seeded ? 'true' : 'false');
  localStorage.setItem(STORAGE_KEYS.score, String(state.score || 0));
  localStorage.setItem(STORAGE_KEYS.current, state.currentQuestId);
  localStorage.setItem(STORAGE_KEYS.badges, JSON.stringify(state.badges || []));
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
  const result = await runCypher(cypher);
  renderTable(result, resultShell);
  setFeedback('실행 완료. Submit으로 채점하세요.', null);
  return result;
}

export function evaluate(quest, result) {
  try {
    return quest.checker(result);
  } catch (err) {
    return { correct: false, feedback: '채점 중 오류가 발생했습니다.' };
  }
}
