# Neo4j Cypher Quest (GitHub Pages + Cloudflare Workers)

정적 GitHub Pages 프론트엔드와 Cloudflare Worker 백엔드로 동작하는 Cypher 학습 게임 MVP입니다. DB가 비어있어도 깨지지 않도록 Seed 버튼을 통해 샘플 데이터를 주입한 뒤 추천/유저/상품 퀘스트를 진행합니다.

## 빠른 시작 (GitHub Pages)
1. 이 리포지토리를 GitHub Pages에 배포합니다(메인 브랜치, 루트). 별도 빌드 과정은 없습니다.
2. 페이지에 접속하면 Worker 헬스 상태와 Seed 필요 여부를 확인합니다.
3. DB가 비어있다면 **데이터 초기화(Seed)** 버튼을 눌러 샘플 그래프를 생성합니다.
4. Seed가 끝나면 Post-Seed 퀘스트(유저/상품/추천)가 활성화됩니다.

> ⚠️ 배포한 Worker가 쓰기 연산을 막고 있다면 Seed가 실패합니다. 샘플 데이터를 로드하려면 `/seed` 엔드포인트가 있는 배포나 쓰기가 허용된 러너를 사용하세요.

## Worker 엔드포인트
- `POST https://neo4j-runner.neo4j-namoryx.workers.dev/run`
- `POST https://neo4j-runner.neo4j-namoryx.workers.dev/seed`
- `GET  https://neo4j-runner.neo4j-namoryx.workers.dev/health`

### Worker URL 교체 방법
프론트엔드 `js/api.js`의 `API_BASE` 값을 배포한 Worker 도메인으로 변경합니다.

## 퀘스트 구성/추가 방법
- `js/game.js`의 `quests` 배열을 수정합니다.
- `group: 'pre'` 퀘스트는 데이터가 없어도 실행 가능하며 Seed 이전에 제공됩니다.
- `group: 'post'` 퀘스트는 Seed 완료 후 자동 활성화됩니다.
- 각 퀘스트는 `starterCypher`, `hints`, `checker(result)`를 갖습니다. `checker`에서 결과를 해석해 `{correct, feedback}`을 반환하세요.

## 배포 체크리스트
- `wrangler deploy`로 Worker를 배포하고 `/health` 응답을 확인합니다.
- GitHub Pages 페이지를 열어 Seed 버튼을 눌러 샘플 데이터를 생성합니다.
- `MATCH (n) RETURN count(n)` 결과가 0보다 크고, 퀘스트 제출/채점이 정상 동작하는지 확인합니다.
