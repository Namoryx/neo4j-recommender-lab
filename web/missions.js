const mockGraph = {
  nodes: [
    { id: 'U1', label: 'User', props: { id: 'U1', name: 'Alice' } },
    { id: 'U2', label: 'User', props: { id: 'U2', name: 'Bob' } },
    { id: 'U3', label: 'User', props: { id: 'U3', name: 'Chloe' } },
    { id: 'I1', label: 'Item', props: { id: 'I1', title: 'Noise Cancelling Headphone', category: 'Audio' } },
    { id: 'I2', label: 'Item', props: { id: 'I2', title: 'Gaming Mouse', category: 'Peripherals' } },
    { id: 'I3', label: 'Item', props: { id: 'I3', title: 'Studio Mic', category: 'Audio' } },
  ],
  rels: [
    { from: 'U1', to: 'I1', type: 'VIEW', ts: 1710000000 },
    { from: 'U1', to: 'I2', type: 'CART', ts: 1710500000 },
    { from: 'U2', to: 'I1', type: 'VIEW', ts: 1710300000 },
    { from: 'U2', to: 'I2', type: 'BUY', ts: 1710400000 },
    { from: 'U3', to: 'I3', type: 'VIEW', ts: 1710600000 },
    { from: 'U3', to: 'I2', type: 'BUY', ts: 1710800000 },
  ],
};

const missions = [
  {
    id: 'A1',
    track: 'Track A · Connect',
    title: 'AuraDB 연결 확인',
    goal: 'RETURN 1 from Neo4j to prove connectivity',
    description:
      'Fast check that the driver is alive. The grader expects a single row with the integer 1.',
    hint: '시작 미션은 단순 핑: RETURN 1 as result',
    template: 'RETURN 1 AS ok',
    eval: (query) => {
      const returnsOne = /return\s+1/i.test(query);
      const rows = [{ ok: returnsOne ? 1 : 0 }];
      return { columns: ['ok'], rows, expected: [{ ok: 1 }] };
    },
  },
  {
    id: 'B1',
    track: 'Track B · Cypher Basics',
    title: '노드 표현',
    goal: 'Find (:User {id:"U1"}) and return its id',
    description:
      'Demonstrate node pattern syntax with a label + property lookup.',
    hint: 'MATCH (u:User {id:"U1"}) RETURN u.id',
    template: 'MATCH (u:User {id:"U1"}) RETURN u.id AS id',
    eval: (query) => {
      const idMatch = query.match(/id\s*:\s*["'](.*?)["']/i);
      const userId = idMatch ? idMatch[1] : null;
      const node = mockGraph.nodes.find((n) => n.label === 'User' && n.props.id === userId);
      const rows = node ? [{ id: node.props.id }] : [];
      return { columns: ['id'], rows, expected: [{ id: 'U1' }] };
    },
  },
  {
    id: 'B2',
    track: 'Track B · Cypher Basics',
    title: '관계 표현',
    goal: 'Find (:User)-[:VIEW]->(:Item) paths and return how many',
    description: 'Count all VIEW interactions between users and items.',
    hint: 'MATCH (:User)-[v:VIEW]->(:Item) RETURN count(v) AS views',
    template: 'MATCH (:User)-[v:VIEW]->(:Item) RETURN count(v) AS views',
    eval: () => {
      const rows = [{ views: mockGraph.rels.filter((r) => r.type === 'VIEW').length }];
      return { columns: ['views'], rows, expected: [{ views: 2 }] };
    },
  },
  {
    id: 'C1',
    track: 'Track C · Pathfinding',
    title: '2-hop 이웃',
    goal: 'Find other users who touched the same items as U1 (any interaction)',
    description:
      'Two-step traversal: U1 -> item <- other. Return distinct other user ids and hop count.',
    hint:
      'MATCH (me:User {id:"U1"})-[:VIEW|:CART|:BUY]->(i)<-[:VIEW|:CART|:BUY]-(other:User)\nRETURN DISTINCT other.id AS userId, 2 AS hops',
    template:
      'MATCH (me:User {id:"U1"})-[:VIEW|:CART|:BUY]->(i)<-[:VIEW|:CART|:BUY]-(other:User)\nRETURN DISTINCT other.id AS userId, 2 AS hops',
    eval: () => {
      const myItems = mockGraph.rels.filter((r) => r.from === 'U1').map((r) => r.to);
      const others = new Set();
      mockGraph.rels.forEach((r) => {
        if (myItems.includes(r.to) && r.from !== 'U1' && mockGraph.nodes.find((n) => n.id === r.from && n.label === 'User')) {
          others.add(r.from);
        }
      });
      const rows = Array.from(others).map((id) => ({ userId: id, hops: 2 })).sort((a, b) => a.userId.localeCompare(b.userId));
      return { columns: ['userId', 'hops'], rows, expected: rows };
    },
  },
  {
    id: 'D5',
    track: 'Track D · Recommender',
    title: 'TopN 추천 랭킹',
    goal: 'Score items by sum(similarity) of similar users and return top 3',
    description:
      'VIEW=1, CART=3, BUY=5. Sim users share items with U1. Items U1 already touched are excluded.',
    hint:
      'MATCH (me:User {id:"U1"})-[:VIEW|:CART|:BUY]->(seen)\nMATCH (me)-[:VIEW|:CART|:BUY]->(seen)<-[:VIEW|:CART|:BUY]-(other:User)\nWITH other, count(*) AS overlap\nMATCH (other)-[r:VIEW|:CART|:BUY]->(item) WHERE NOT (me)-[:VIEW|:CART|:BUY]->(item)\nWITH item, sum(CASE type(r) WHEN "VIEW" THEN 1 WHEN "CART" THEN 3 ELSE 5 END * overlap) AS score\nRETURN item.id AS itemId, score ORDER BY score DESC LIMIT 3',
    template:
      'MATCH (me:User {id:"U1"})-[:VIEW|:CART|:BUY]->(seen)\nMATCH (me)-[:VIEW|:CART|:BUY]->(seen)<-[:VIEW|:CART|:BUY]-(other:User)\nWITH other, count(*) AS overlap\nMATCH (other)-[r:VIEW|:CART|:BUY]->(item) WHERE NOT (me)-[:VIEW|:CART|:BUY]->(item)\nWITH item, sum(CASE type(r) WHEN "VIEW" THEN 1 WHEN "CART" THEN 3 ELSE 5 END * overlap) AS score\nRETURN item.id AS itemId, score ORDER BY score DESC LIMIT 3',
    eval: () => {
      const weights = { VIEW: 1, CART: 3, BUY: 5 };
      const seen = new Set(mockGraph.rels.filter((r) => r.from === 'U1').map((r) => r.to));

      const overlapCounts = new Map();
      mockGraph.rels.forEach((r) => {
        if (seen.has(r.to) && r.from !== 'U1') {
          overlapCounts.set(r.from, (overlapCounts.get(r.from) || 0) + 1);
        }
      });

      const scores = new Map();
      mockGraph.rels.forEach((r) => {
        if (r.from !== 'U1' && !seen.has(r.to) && overlapCounts.get(r.from)) {
          const increment = weights[r.type] * overlapCounts.get(r.from);
          scores.set(r.to, (scores.get(r.to) || 0) + increment);
        }
      });

      const rows = Array.from(scores.entries())
        .map(([itemId, score]) => ({ itemId, score }))
        .sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId))
        .slice(0, 3);

      return { columns: ['itemId', 'score'], rows, expected: rows };
    },
  },
];
