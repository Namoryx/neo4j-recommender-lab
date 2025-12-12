export const quests = [
  {
    id: 'match-all',
    title: '모든 노드 조회',
    description: '그래프의 모든 노드를 조회하세요. 반환 컬럼 이름은 n 으로 유지합니다.',
    check: { pattern: /^\s*MATCH\s*\(n\)\s*RETURN\s+n\s*;?\s*$/i }
  },
  {
    id: 'filter-label',
    title: '라벨 조건 조회',
    description: 'Person 라벨을 가진 노드를 조회하세요. 반환은 p 별칭이어야 합니다.',
    check: { pattern: /^\s*MATCH\s*\((p:Person)\)\s*RETURN\s+p\s*;?\s*$/i }
  },
  {
    id: 'count-person',
    title: '사람 수 세기',
    description: 'Person 라벨 노드의 개수를 count 로 반환하세요.',
    check: { pattern: /^\s*MATCH\s*\(:Person\)\s*RETURN\s+count\s*\(\s*\*\s*\)\s+AS\s+count\s*;?\s*$/i }
  }
];
