export function checkQuery(query, rule) {
  if (!query || !rule) {
    return { passed: false, message: '쿼리를 입력하세요.' };
  }

  if (rule.pattern && rule.pattern.test(query)) {
    return { passed: true, message: '정답입니다! 다음 퀘스트를 진행하세요.' };
  }

  return {
    passed: false,
    message: '조건에 맞지 않습니다. 힌트: ' + (rule.hint || '패턴을 다시 확인하세요.')
  };
}
