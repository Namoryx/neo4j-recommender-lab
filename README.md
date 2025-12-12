# neo4j-recommender-lab

An interactive web-based codex to master graph-based recommender systems with Neo4j & Cypher.

## Design overview
- **Game-first learning loop:** concept → mission (query/code) → auto-grading → instant feedback → next stage.
- **Core focus:** AI recommendations + GraphRAG fundamentals; domain DLCs (news/legal/10K/ETF) arrive later.
- **Result-based grading:** never compare query strings; validate outputs, shapes, and tolerances.

See the full game design, track map, and UX/stack blueprint in [`docs/game-design.md`](docs/game-design.md).

## Web game prototype
A static, in-browser prototype that mirrors the intended 3-panel UX and result-based grading loop ships with `index.html` at the repo root (referencing assets in `web/`).

1. Start a local server from the repo root: `python -m http.server 8000` (then open `http://localhost:8000/index.html`).
A static, in-browser prototype that mirrors the intended 3-panel UX and result-based grading loop lives in `web/`:

1. Start a local server: `python -m http.server 8000 -d web` (or open `web/index.html` directly).
2. Pick a mission (connectivity, Cypher basics, paths, recommender ranking) from the dropdown.
3. Edit the Cypher template, run & grade, and view feedback plus mock graph context.

The current missions use an in-memory mock graph and set-based result checks to demonstrate the grading cycle; hooking up AuraDB/LangChain comes next.
