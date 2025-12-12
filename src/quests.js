export const quests = [
  {
    id: 'ch1-total-nodes',
    chapter: 1,
    title: '그래프 크기 파악',
    story: '데이터베이스에 얼마나 많은 노드가 있는지부터 살펴봅시다.',
    objective: '모든 노드의 개수를 count로 반환하세요.',
    starterCypher: 'MATCH (n)\nRETURN count(n) AS count',
    checker: {
      type: 'rows_exact',
      expected: {
        columns: ['count'],
        rows: [[10]]
      }
    },
    hints: [
      'MATCH (n)으로 모든 노드를 선택할 수 있습니다.',
      '집계 함수 count(n)을 사용하세요.',
      '반환 컬럼 이름은 count로 지정하세요.'
    ],
    denyWrite: true
  },
  {
    id: 'ch1-labels',
    chapter: 1,
    title: '레이블 분포 확인',
    story: '어떤 유형의 노드가 있는지 라벨을 집계해 보겠습니다.',
    objective: '라벨별 노드 수를 label, count 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (n)\nUNWIND labels(n) AS label\nRETURN label, count(*) AS count\nORDER BY label',
    checker: {
      type: 'set_exact',
      expected: {
        columns: ['label', 'count'],
        rows: [
          ['Person', 5],
          ['Product', 5]
        ]
      }
    },
    hints: [
      'labels(n)을 UNWIND 하여 각 라벨을 행으로 만들 수 있습니다.',
      'UNWIND 결과에 대해 count(*) 집계가 가능합니다.',
      'ORDER BY label로 정렬하면 보기 좋습니다.'
    ],
    denyWrite: true
  },
  {
    id: 'ch1-product-count',
    chapter: 1,
    title: '상품 개수 세기',
    story: '판매 중인 상품이 얼마나 되는지 집계합니다.',
    objective: 'Product 라벨 노드의 수를 products 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (:Product)\nRETURN count(*) AS products',
    checker: {
      type: 'rows_exact',
      expected: {
        columns: ['products'],
        rows: [[5]]
      }
    },
    hints: [
      'MATCH (:Product)로 Product 라벨만 선택합니다.',
      'count(*) AS products 로 개수를 반환하세요.',
      'RETURN 절의 별칭을 정확히 맞추세요.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-hop-purchases',
    chapter: 2,
    title: '1-hop 구매 탐색',
    story: '사용자의 구매 경로를 한 단계 따라가 봅니다.',
    objective: 'Alice가 구매한 상품 이름을 product 컬럼으로 반환하세요.',
    starterCypher: "MATCH (:Person {name: 'Alice'})-[:PURCHASED]->(p:Product)\nRETURN p.name AS product\nORDER BY product",
    checker: {
      type: 'rows_exact',
      expected: {
        columns: ['product'],
        rows: [
          ['Laptop'],
          ['Phone']
        ],
        keyColumn: 'product'
      }
    },
    hints: [
      'MATCH (person:Person {name:"Alice"})-[:PURCHASED]->(p:Product)',
      'RETURN p.name AS product 로 이름만 돌려주세요.',
      '정렬이 필요하면 ORDER BY product를 사용하세요.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-where-price',
    chapter: 2,
    title: '가격 필터링',
    story: '고가 제품만 추출해서 추천 후보를 좁힙니다.',
    objective: '가격이 1000 이상인 제품의 이름과 가격을 반환하세요.',
    starterCypher: 'MATCH (p:Product)\nWHERE p.price >= 1000\nRETURN p.name AS product, p.price AS price\nORDER BY price DESC',
    checker: {
      type: 'set_exact',
      expected: {
        columns: ['product', 'price'],
        rows: [
          ['Laptop', 1500],
          ['Camera', 1200]
        ]
      }
    },
    hints: [
      '숫자 비교는 WHERE p.price >= 1000 형태로 작성합니다.',
      '반환 시 이름과 가격 두 컬럼이 필요합니다.',
      '정렬 기준은 자유지만 가격 기준이 자연스럽습니다.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-where-not-bob',
    chapter: 2,
    title: '구매 제외 조건',
    story: '특정 사용자가 이미 구매한 상품은 제외하고 추천합니다.',
    objective: 'Bob이 구매하지 않은 Electronics 카테고리 제품의 이름을 반환하세요.',
    starterCypher: "MATCH (p:Product {category:'Electronics'})\nWHERE NOT (:Person {name:'Bob'})-[:PURCHASED]->(p)\nRETURN p.name AS product\nORDER BY product",
    checker: {
      type: 'set_exact',
      expected: {
        columns: ['product'],
        rows: [
          ['Camera'],
          ['Laptop']
        ],
        keyColumn: 'product'
      }
    },
    hints: [
      '특정 사람을 고정하려면 패턴에 속성 조건을 넣으세요.',
      'WHERE NOT (..)-[:PURCHASED]->(p) 패턴을 사용합니다.',
      '카테고리 필터도 함께 사용해야 합니다.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-top-products',
    chapter: 2,
    title: '구매 상위 N',
    story: '구매수가 가장 많은 상품을 상위 2개까지 구합니다.',
    objective: '구매수가 높은 상품 상위 2개를 product, purchases 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (:Person)-[:PURCHASED]->(p:Product)\nRETURN p.name AS product, count(*) AS purchases\nORDER BY purchases DESC, product ASC\nLIMIT 2',
    checker: {
      type: 'rows_exact',
      expected: {
        columns: ['product', 'purchases'],
        rows: [
          ['Phone', 3],
          ['Headphones', 2]
        ],
        keyColumn: 'product'
      }
    },
    hints: [
      '구매 관계를 MATCH 해서 count(*)로 집계합니다.',
      'ORDER BY purchases DESC, product ASC 로 동점 처리까지 합니다.',
      'LIMIT 2를 잊지 마세요.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-seoul-products',
    chapter: 2,
    title: '지역 기반 추천',
    story: '서울 거주자가 구매한 상품을 모아 지역 트렌드를 파악합니다.',
    objective: 'Seoul에 사는 사람이 구매한 제품 이름을 product 컬럼으로 중복 없이 반환하세요.',
    starterCypher: "MATCH (:Person {city:'Seoul'})-[:PURCHASED]->(p:Product)\nRETURN DISTINCT p.name AS product\nORDER BY product",
    checker: {
      type: 'set_exact',
      expected: {
        columns: ['product'],
        rows: [
          ['Camera'],
          ['Headphones'],
          ['Keyboard'],
          ['Laptop'],
          ['Phone']
        ]
      }
    },
    hints: [
      "Person 노드의 city 속성을 이용하세요.",
      'DISTINCT로 중복을 제거합니다.',
      '정렬 기준은 product 컬럼이 편리합니다.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-purchase-list',
    chapter: 2,
    title: '전체 구매 로그',
    story: '모든 구매 기록을 1-hop 패턴으로 조회합니다.',
    objective: '구매한 사람과 제품 이름을 buyer, product 컬럼으로 모두 반환하세요.',
    starterCypher: 'MATCH (person:Person)-[:PURCHASED]->(p:Product)\nRETURN person.name AS buyer, p.name AS product\nORDER BY buyer, product',
    checker: {
      type: 'contains_min',
      expected: {
        columns: ['buyer', 'product'],
        minCount: 10
      }
    },
    hints: [
      'MATCH (person:Person)-[:PURCHASED]->(p:Product) 패턴을 사용합니다.',
      'RETURN 절에서 별칭을 buyer, product로 지정하세요.',
      '정렬은 자유지만 구매자와 상품 기준이 보기 좋습니다.'
    ],
    denyWrite: true
  },
  {
    id: 'ch2-average-price',
    chapter: 2,
    title: '평균 가격 계산',
    story: '상품 평균 가격을 계산해 가격대 설정에 활용합니다.',
    objective: '모든 Product의 평균 가격을 avgPrice 컬럼으로 반환하세요.',
    starterCypher: 'MATCH (p:Product)\nRETURN avg(p.price) AS avgPrice',
    checker: {
      type: 'rows_exact',
      expected: {
        columns: ['avgPrice'],
        rows: [[784]]
      }
    },
    hints: [
      'avg() 집계 함수로 평균을 계산할 수 있습니다.',
      '반환 컬럼 이름을 avgPrice로 맞춰주세요.',
      '정확한 소수 자리 처리는 Neo4j 설정에 따라 다를 수 있습니다.'
    ],
    denyWrite: true
  }
];
