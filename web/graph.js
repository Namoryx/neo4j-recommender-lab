function renderGraph(mission) {
  const graphView = document.getElementById('graph-view');
  graphView.innerHTML = '';

  const seenIds = new Set();
  const highlighted = mission.highlight || {};

  mockGraph.nodes.forEach((node) => {
    const div = document.createElement('div');
    div.className = 'node';
    if (highlighted.nodes?.includes(node.id)) div.classList.add('highlight');
    div.innerHTML = `<strong>${node.label}</strong> ${node.id}<div class="muted">${Object.entries(node.props)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}</div>`;
    graphView.appendChild(div);
    seenIds.add(node.id);
  });

  mockGraph.rels.forEach((rel) => {
    const div = document.createElement('div');
    div.className = 'edge';
    if (highlighted.rels?.includes(rel)) div.classList.add('highlight');
    div.textContent = `${rel.from} -[:${rel.type}]-> ${rel.to}`;
    graphView.appendChild(div);
  });
}
