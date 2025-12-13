export const quests = [
  {
    id: 'C0-Q1',
    allowWrite: false,
    checker(result) {
      const val = result.values?.[0]?.[0];
      const ok = Number(val) === 1;
      return { correct: ok, feedback: ok ? '연결 확인 완료!' : '결과가 1이 아닙니다.' };
    },
  },
  {
    id: 'C0-Q2',
    allowWrite: false,
    checker(result) {
      const cnt = Number(result.values?.[0]?.[0] ?? 0);
      if (cnt === 0) {
        return { correct: false, feedback: '데이터가 없습니다. Seed를 먼저 실행하세요.' };
      }
      return { correct: true, feedback: '데이터가 있습니다! 본 퀘스트를 진행하세요.' };
    },
  },
  {
    id: 'C1-Q1',
    allowWrite: false,
    checker(result) {
      const users = Number(result.values?.[0]?.[0] ?? 0);
      return { correct: users >= 5, feedback: users >= 5 ? 'OK! 최소 5명의 사용자가 보입니다.' : 'User 수가 부족합니다.' };
    },
  },
  {
    id: 'C1-Q2',
    allowWrite: false,
    checker(result) {
      const count = result.values?.length || 0;
      return { correct: count >= 8, feedback: count >= 8 ? '8개 이상의 상품이 조회되었습니다.' : '상품이 8개 미만입니다.' };
    },
  },
  {
    id: 'C1-Q3',
    allowWrite: false,
    checker(result) {
      const views = Number(result.values?.[0]?.[0] ?? 0);
      return { correct: views >= 9, feedback: views >= 9 ? '조회 이벤트가 충분히 조회되었습니다.' : '조회 수가 예상보다 적습니다.' };
    },
  },
  {
    id: 'C1-Q4',
    allowWrite: false,
    checker(result) {
      const ids = (result.values || []).map((r) => r[0]);
      const ok = ids.includes('P1');
      return { correct: ok, feedback: ok ? 'U1이 구매한 P1을 찾았습니다.' : 'P1 결과가 필요합니다.' };
    },
  },
  {
    id: 'C1-Q5',
    allowWrite: false,
    checker(result) {
      const rows = result.values || [];
      const ok = rows.some((r) => r[0] === 'U3' && r[1] === 'P4') && rows.some((r) => r[0] === 'U4' && r[1] === 'P6');
      return { correct: ok, feedback: ok ? '커피 구매 내역을 모두 찾았습니다.' : 'U3-P4와 U4-P6 모두 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q6',
    allowWrite: false,
    checker(result) {
      const rows = result.values || [];
      const hasP1 = rows.some((r) => r[0] === 'P1');
      return { correct: hasP1 && rows.length === 2, feedback: hasP1 ? '상위 2개가 반환되었습니다.' : 'P1이 상위에 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q7',
    allowWrite: false,
    checker(result) {
      const ids = (result.values || []).flat();
      const expected = ['U1', 'U2', 'U3', 'U4'];
      const ok = expected.every((id) => ids.includes(id));
      return { correct: ok, feedback: ok ? '조회 후 구매한 모든 사용자를 찾았습니다.' : 'U1~U4까지 모두 포함되어야 합니다.' };
    },
  },
  {
    id: 'C1-Q8',
    allowWrite: false,
    checker(result) {
      const ids = (result.values || []).map((r) => r[0]);
      const ok = ids.includes('P2') && ids.includes('P5') && ids.includes('P7');
      return { correct: ok, feedback: ok ? '구매되지 않은 상품을 모두 찾았습니다.' : 'P2, P5, P7이 모두 필요합니다.' };
    },
  },
];

export function getQuestById(id) {
  return quests.find((q) => q.id === id);
}
