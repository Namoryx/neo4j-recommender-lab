# Web Game Design: Neo4j Recommender Codex

This document outlines the learning-as-a-game experience for mastering AI recommendations and GraphRAG with Neo4j. The loop for every level is **concept → mission (query/code) → auto-grading → instant feedback → next stage**.

## Game Modes
- **Learn**: hints, partial answers, and full answers available for concept absorption.
- **Challenge**: time limits with limited hints to lock in skills.
- **Boss**: one-shot "build the recommender pipeline" graduation.

## Submission Types
- **Cypher submission**: player writes Cypher; the server executes against Neo4j and grades on results (never string comparison).
- **Design selection**: schema/constraint/index choices with result-based validation via `SHOW` outputs.
- **Pipeline assembly**: block-based assembly (Seed/Index/Query/RAG) that must pass scenario tests.

**Grading rules (always result-based)**
- Never compare raw query strings.
- Compare results as sets (ordering ignored unless ranking is part of the goal).
- Enforce column names and data types as specified per mission.
- Support tolerances for numeric comparisons (integers require exact matches).

## Track Map (Difficulty Curve)
The tracks compress the curriculum into a recommender + GraphRAG-first path. DLC topics (news/legal/10K/ETF) are deferred to later seasons.

### Track A. Environment Onboarding — "Connection Quests"
Goal: pass environment setup as missions.
- **A1. AuraDB connection**: set URI/USER/PW in `.env` and pass a `RETURN 1` ping. Badge: "DB Connected".
- **A2. Project scaffolding**: `uv init` → `uv venv` → `uv pip install ...`; graded by calling a dependency-check API.
- **A3. LangChain `Neo4jGraph` connection**: run `MATCH (n) RETURN count(n)`; pass if count ≥ 0.

UX note: offer two paths—(1) AuraDB, (2) in-browser Neo4j sandbox—so players are not blocked by local installs.

### Track B. Cypher Basics — "Syntax Dungeon"
Goal: internalize MATCH patterns.
- **B1. Node syntax**: find `(:User {id:"U1"})`; grade by returned id.
- **B2. Relationship syntax**: match `(:User)-[:VIEW]->(:Item)`; grade by path count.
- **B3. Variables/Aliases**: `MATCH (u:User)-[r:VIEW]->(i:Item) RETURN u.id, count(r)`; check columns and aggregates.
- **B4. Core clauses**: mini-puzzles for `MATCH`/`WHERE`/`SET`/`DELETE`/`REMOVE` (e.g., remove a bad label from a miscategorized item).

### Track C. Cypher Advanced — "Graph Traversal Arena"
Directly tie skills to recommendation mechanics.
- **C1. Variable-length paths**: find 2-hop neighbor users via shared interactions; grade user set.
- **C2. Shortest path**: find minimal connection steps between entities.
- **C3. Aggregation + `WITH`**: compute similar-user scores in stages; grade `(otherId, score)`.
- **C4. Composite patterns**: similar users → their BUY items → exclude items the player already touched; grade recommendations.

### Track D. Recommendation Algorithms — "Recommender Raid"
Core recommender flow.
- **D1. Interaction schema lock-in**: nodes `User`, `Item`, `Category`, `Brand`; relationships `VIEW/CART/BUY (ts)`; add uniqueness constraints and indexes. Grade via `SHOW CONSTRAINTS/INDEXES` outputs.
- **D2. Similarity weights**: `VIEW=1`, `CART=3`, `BUY=5`; compute shared-item similarity between `me` and `other`. Grade exact scores.
- **D3. Candidate generation**: take top-K similar users' BUY items as candidates. Grade candidate set.
- **D4. Exclusion rules**: `NOT (me)-[:VIEW|:CART|:BUY]->(recItem)`; grade that seen items are removed.
- **D5. Ranking**: item score = sum of similar-user scores; grade Top-N order.
- **D6. Boss fight**: inputs `(userId, K, N, timeWindowDays)`; apply recency, dedupe, and provide `EXPLAIN`; grade results and runtime (e.g., <1s).

### Track E. GraphRAG — "GraphRAG Lab"
Blend recommendations with retrieval augmentation.
- **E1. Ontology transform**: CSV → nodes/relationships ETL puzzle; grade node/edge counts and sample checks.
- **E2. Full-text search**: create a fulltext index and query; grade inclusion of expected entities.
- **E3. Vector search**: create vector index + kNN query; grade that similar results appear at the top.
- **E4. Text2Cypher**: evaluate LLM-produced Cypher by running it and grading results (never string equality).
- **E5. GraphRAG finale**: vector-retrieve candidates → expand via KG traversal for grounded answers; grade for required evidence nodes/edges ("evidence tokens").

## UI/UX Blueprint
- **Three panels**: left = mission/inputs, center = Cypher editor + results table, right = graph visualization of the result subgraph.
- **Feedback**: no bare "show answer." Instead, surface precise diagnostics, e.g.,
  - Missing exclusion of already-interacted items.
  - `WITH` aggregation is per item instead of per user.
  - Missing BUY=5 weight.
  - Missing `ORDER BY score DESC`.

## Implementation Stack
- **Front**: Next.js/React + Monaco Editor for Cypher input.
- **Backend**: FastAPI (or Node) running all grading; browser never connects to Neo4j directly.
- **DB**: Neo4j AuraDB or Docker Neo4j.
- **Level definitions**: JSON/YAML with seed data, allowed query types (read-only), input params (e.g., `userId`), and grading scripts.

## Season Mapping
- Core curriculum: Tracks A–E (recommender + GraphRAG).
- DLC/Season 2: news, legal, 10K, ETF scenarios layered later without cluttering the core path.
