# Neo4j Recommender Lab

## GitHub Pages → Worker → 렌더 → Submit 흐름 점검 체크리스트
배포 후 다음 순서대로 점검하여 GitHub Pages와 Worker 사이의 전체 흐름을 검증하세요.

1. **GitHub Pages 로딩 확인**
   - Pages URL을 브라우저에서 열어 UI가 정상적으로 렌더되는지 확인합니다.
   - 개발자 도구 Network 탭에서 정적 자산(`index.html`, `assets/`, `src/`)이 200 상태 코드로 내려오는지 확인합니다.
2. **Worker 엔드포인트 POST 200 확인**
   - `src/app.js`의 `WORKER_ENDPOINT`가 실제 배포된 Worker 주소로 설정되어 있는지 확인합니다.
   - Network 탭에서 `run`으로 향하는 POST 요청이 200으로 응답하는지, 응답 본문에 `columns`, `rows` 필드가 포함되는지 확인합니다.
3. **결과 렌더링 검증**
   - Run 버튼을 눌러 샘플 Cypher를 실행하고 결과 테이블이 브라우저에 표시되는지 확인합니다.
   - 응답이 없거나 에러일 경우 CORS/URL/배포 상태 문구가 노출되는지 확인합니다.
4. **Submit 정/오답 흐름 확인**
   - Submit 버튼을 눌러 결과가 정답이면 성공 피드백과 다음 퀘스트로 이동하는지 확인합니다.
   - 오답일 경우 피드백이 표시되고 진행 상황이 저장되는지 확인합니다.

> 위 순서를 모두 통과하면 GitHub Pages 정적 호스팅부터 Cloudflare Worker 실행, 결과 렌더, 정답 체크까지 엔드투엔드 동작이 검증됩니다.
