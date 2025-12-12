export function checkResult(result, checker) {
  if (!checker) {
    return { correct: false, feedback: '채점 규칙이 정의되지 않았습니다.' };
  }

  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows)) {
    return { correct: false, feedback: '결과가 올바르게 반환되지 않았습니다.' };
  }

  const expectedCols = (checker.expected?.columns || []).map((c) => c.toLowerCase());
  const actualCols = result.columns.map((c) => String(c).toLowerCase());

  if (expectedCols.length && !arraysEqual(expectedCols, actualCols)) {
    return { correct: false, feedback: '컬럼명이 다릅니다. RETURN 절을 확인하세요.' };
  }

  switch (checker.type) {
    case 'rows_exact':
      return evaluateRowsExact(result, checker.expected);
    case 'set_exact':
      return evaluateSetExact(result, checker.expected);
    case 'contains_min':
      return evaluateContainsMin(result, checker.expected);
    default:
      return { correct: false, feedback: '지원하지 않는 채점 유형입니다.' };
  }
}

function evaluateRowsExact(result, expected) {
  const expectedRows = expected?.rows || [];
  if (!arraysEqualDeep(result.rows, expectedRows)) {
    const feedback = deriveRowFeedback(result, expectedRows);
    return { correct: false, feedback };
  }
  return { correct: true, feedback: '정답입니다! 🎉' };
}

function evaluateSetExact(result, expected) {
  const key = expected?.keyColumn;
  if (!key) {
    return { correct: false, feedback: 'set_exact 채점은 keyColumn이 필요합니다.' };
  }

  const keyIndex = result.columns.findIndex((c) => String(c).toLowerCase() === String(key).toLowerCase());
  if (keyIndex === -1) {
    return { correct: false, feedback: `${key} 컬럼을 반환하도록 RETURN 절을 확인하세요.` };
  }

  const actualMap = new Map();
  result.rows.forEach((row) => {
    actualMap.set(String(row[keyIndex]), row);
  });

  const expectedMap = new Map();
  (expected.rows || []).forEach((row) => {
    const keyPos = (expected.columns || result.columns).findIndex(
      (c) => String(c).toLowerCase() === String(key).toLowerCase()
    );
    expectedMap.set(String(row[keyPos]), row);
  });

  if (actualMap.size !== expectedMap.size) {
    return { correct: false, feedback: '결과 건수가 맞지 않습니다. DISTINCT 또는 MATCH 조건을 확인하세요.' };
  }

  for (const [k, expectedRow] of expectedMap.entries()) {
    const actualRow = actualMap.get(k);
    if (!actualRow || !arraysEqualDeep([actualRow], [expectedRow])) {
      return { correct: false, feedback: '결과 집합이 다릅니다. 정렬 또는 중복 제거를 확인하세요.' };
    }
  }

  return { correct: true, feedback: '정답입니다! 🎉' };
}

function evaluateContainsMin(result, expected) {
  const minCount = expected?.minCount ?? 0;
  const expectedRows = expected?.rows || [];

  let matchCount = 0;
  expectedRows.forEach((expectedRow) => {
    if (result.rows.some((row) => arraysEqualDeep([row], [expectedRow]))) {
      matchCount += 1;
    }
  });

  if (matchCount < minCount) {
    return { correct: false, feedback: `최소 ${minCount}건 이상의 결과가 포함되어야 합니다.` };
  }

  return { correct: true, feedback: '정답입니다! 🎉' };
}

function deriveRowFeedback(actualResult, expectedRows) {
  if (!actualResult.rows.length && expectedRows.length) {
    return '결과가 없습니다. MATCH나 WHERE 조건을 확인하세요.';
  }

  if (actualResult.rows.length !== expectedRows.length) {
    return '결과 건수가 다릅니다. DISTINCT 또는 정렬을 확인하세요.';
  }

  return '결과 행의 순서나 값이 일치하지 않습니다. ORDER BY 또는 집계 로직을 확인하세요.';
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function arraysEqualDeep(a, b) {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    if (!Array.isArray(row) || !Array.isArray(other)) return row === other;
    if (row.length !== other.length) return false;
    return row.every((cell, j) => cell === other[j]);
  });
}
