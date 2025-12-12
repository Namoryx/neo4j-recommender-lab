const picker = document.getElementById('mission-picker');
const missionDetails = document.getElementById('mission-details');
const missionHint = document.getElementById('mission-hint');
const cypherInput = document.getElementById('cypher-input');
const feedback = document.getElementById('feedback');
const resultTable = document.getElementById('result-table');
const scoreCard = document.getElementById('score-card');

let currentMission = missions[0];
let streak = 0;

function renderMissionList() {
  missions.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.id} · ${m.title}`;
    picker.appendChild(opt);
    if (idx === 0) picker.value = m.id;
  });
}

function setMission(id) {
  const mission = missions.find((m) => m.id === id);
  if (!mission) return;
  currentMission = mission;
  missionDetails.innerHTML = `
    <h3>${mission.title}</h3>
    <div class="mission-meta">${mission.track}</div>
    <p><strong>Goal:</strong> ${mission.goal}</p>
    <p>${mission.description}</p>
    <p class="mission-meta">Grader expects: ${JSON.stringify(mission.eval(mission.template).expected)}</p>
  `;
  missionHint.textContent = mission.hint;
  cypherInput.value = mission.template;
  renderGraph(mission);
  renderScore();
  clearFeedback();
  renderResult([], []);
}

function renderResult(columns, rows) {
  resultTable.innerHTML = '';
  if (!columns.length) return;
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((c) => {
    const th = document.createElement('th');
    th.textContent = c;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  resultTable.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((c) => {
      const td = document.createElement('td');
      td.textContent = row[c];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  resultTable.appendChild(tbody);
}

function arraysEqualAsSets(a, b) {
  if (a.length !== b.length) return false;
  const normalized = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  const normA = normalized(a);
  const normB = normalized(b);
  for (let i = 0; i < normA.length; i += 1) {
    if (normA[i] !== normB[i]) return false;
  }
  return true;
}

function runGrading() {
  const { columns, rows, expected } = currentMission.eval(cypherInput.value);
  renderResult(columns, rows);
  const passed = arraysEqualAsSets(rows, expected);
  const mode = document.getElementById('mode').value;

  feedback.style.display = 'block';
  feedback.className = `feedback ${passed ? 'success' : 'danger'}`;

  if (passed) {
    streak += 1;
    feedback.innerHTML = `<strong>Clear!</strong> Result set matches expected output. Next stage unlocked.`;
  } else {
    streak = 0;
    const diag = mode === 'learn'
      ? 'Check property keys, relationship type, and remember to RETURN the required columns.'
      : 'Attempt failed. Hint hidden in Challenge mode.';
    feedback.innerHTML = `<strong>Try again.</strong> Result mismatch. ${diag}`;
  }
  renderScore();
}

function renderScore() {
  scoreCard.innerHTML = `
    <div><strong>Current mission:</strong> ${currentMission.id} · ${currentMission.title}</div>
    <div><strong>Streak:</strong> ${streak}</div>
    <div><strong>Dataset:</strong> Users: ${mockGraph.nodes.filter((n) => n.label === 'User').length}, Items: ${mockGraph.nodes.filter((n) => n.label === 'Item').length}, Rels: ${mockGraph.rels.length}</div>
  `;
}

function clearFeedback() {
  feedback.style.display = 'none';
  feedback.textContent = '';
  feedback.className = 'feedback';
}

picker.addEventListener('change', (e) => setMission(e.target.value));
document.getElementById('run-query').addEventListener('click', runGrading);
document.getElementById('load-solution').addEventListener('click', () => {
  cypherInput.value = currentMission.template;
});

document.getElementById('reset-view').addEventListener('click', () => renderGraph(currentMission));

renderMissionList();
setMission(missions[0].id);
