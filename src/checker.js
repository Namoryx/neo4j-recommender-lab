function extractReturnColumns(query) {
  const match = query.match(/return\s+([^;]+?)(order by|limit|$)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((col) => col.replace(/AS/i, '').trim())
    .map((col) => col.split(' ').filter(Boolean).pop())
    .filter(Boolean)
    .map((col) => col.toLowerCase());
}

export function checkQuery(query, rule) {
  if (!query || !rule) {
    return { passed: false, message: '쿼리를 입력하세요.' };
  }

  if (rule.denyWrite && /\b(create|merge|delete|set)\b/i.test(query)) {
    return { passed: false, message: '쓰기 연산은 허용되지 않습니다.' };
  }

  if (rule.pattern && rule.pattern.test(query)) {
    return { passed: true, message: '정답입니다! 다음 퀘스트를 진행하세요.' };
  }

  const expectedColumns = rule.expected?.columns?.map((c) => c.toLowerCase()) || [];
  const returnedColumns = extractReturnColumns(query);

  const hasAllColumns = expectedColumns.every((col) => returnedColumns.includes(col));

  switch (rule.type) {
    case 'rows_exact':
    case 'set_exact': {
      if (!hasAllColumns) {
        return {
          passed: false,
          message: `RETURN 컬럼을 확인하세요: ${expectedColumns.join(', ')}`
        };
      }
      return { passed: true, message: '정답입니다! 다음 퀘스트를 진행하세요.' };
    }
    case 'contains_min': {
      if (!hasAllColumns) {
        return {
          passed: false,
          message: `반환해야 할 컬럼: ${expectedColumns.join(', ')}`
        };
      }
      return {
        passed: true,
        message: `결과가 ${rule.expected?.minCount || 0}건 이상 반환되는지 Neo4j에서 확인하세요.`
      };
    }
    default:
      return {
        passed: false,
        message: '채점 규칙을 찾을 수 없습니다. 쿼리를 다시 확인하세요.'
      };
  }
}
