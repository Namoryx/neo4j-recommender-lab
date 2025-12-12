import { quests } from './quests.js';
import { checkResult } from './checker.js';
import { loadProgress, saveProgress, markCleared } from './storage.js';

// Cloudflare Worker endpoint that executes Cypher.
const WORKER_ENDPOINT = 'https://your-worker-subdomain.workers.dev/run';

const questListEl = document.getElementById('quest-list');
const titleEl = document.getElementById('quest-title');
const descEl = document.getElementById('quest-desc');
const objectiveEl = document.getElementById('quest-objective');
const counterEl = document.getElementById('progress-counter');
const questIdEl = document.getElementById('quest-id');
const scoreEl = document.getElementById('score');
const textarea = document.getElementById('cypher-input');
const feedbackEl = document.getElementById('feedback');
const resultBodyEl = document.getElementById('result-body');
const runBtn = document.getElementById('run-btn');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const hintBtn = document.getElementById('hint-btn');
const hintSteps = document.getElementById('hint-steps');

let progress = loadProgress();
let currentQuest = null;
let revealedHintCount = 0;
let lastRunResult = null;
let isRunning = false;

function computeScore() {
  const clearedCount = progress.clearedQuestIds.length;
  counterEl.textContent = `${clearedCount} / ${quests.length}`;
  scoreEl.textContent = progress.score.toString();
}

function renderQuestList() {
  questListEl.innerHTML = '';
  quests.forEach((quest) => {
    const item = document.createElement('li');
    item.className = 'quest-item';
    item.dataset.id = quest.id;

    if (currentQuest?.id === quest.id) {
      item.classList.add('active');
    }
    if (progress.clearedQuestIds.includes(quest.id)) {
      item.classList.add('cleared');
    }

    const label = document.createElement('span');
    label.textContent = `[Ch${quest.chapter}] ${quest.title}`;

    const status = document.createElement('span');
    status.className = 'quest-status';
    status.textContent = progress.clearedQuestIds.includes(quest.id) ? '완료' : '미완료';

    item.append(label, status);
    item.addEventListener('click', () => selectQuest(quest.id));
    questListEl.appendChild(item);
  });

  computeScore();
}

function selectQuest(id) {
  const quest = quests.find((q) => q.id === id) || quests[0];
  currentQuest = quest;
  revealedHintCount = 0;
  lastRunResult = null;
  progress.currentQuestId = quest.id;
  saveProgress(progress);

  titleEl.textContent = quest.title;
  descEl.textContent = quest.story;
  objectiveEl.textContent = quest.objective;
  questIdEl.textContent = quest.id;
  textarea.value = progress.answers[quest.id] || quest.starterCypher || '';
  feedbackEl.textContent = '정답 여부가 여기 표시됩니다.';
  feedbackEl.className = 'feedback muted';
  renderHints();
  renderQuestList();
}

function renderHints() {
  hintSteps.innerHTML = '';

  if (!currentQuest?.hints?.length) {
    const empty = document.createElement('li');
    empty.textContent = '등록된 힌트가 없습니다.';
    hintSteps.appendChild(empty);
    return;
  }

  if (revealedHintCount === 0) {
    const locked = document.createElement('li');
    locked.textContent = '힌트 버튼을 눌러 순차적으로 확인하세요.';
    hintSteps.appendChild(locked);
    return;
  }

  currentQuest.hints.slice(0, revealedHintCount).forEach((hint) => {
    const li = document.createElement('li');
    li.textContent = hint;
    hintSteps.appendChild(li);
  });
}

function renderResultTable(result) {
  resultBodyEl.innerHTML = '';
  if (!result || !result.rows?.length) {
    const row = document.createElement('tr');
    const empty = document.createElement('td');
    empty.colSpan = 2;
    empty.textContent = '결과가 없습니다.';
    row.appendChild(empty);
    resultBodyEl.appendChild(row);
    return;
  }

  result.rows.forEach((rowData) => {
    const row = document.createElement('tr');
    const colCell = document.createElement('td');
    const valueCell = document.createElement('td');

    colCell.textContent = result.columns.join(', ');
    valueCell.textContent = JSON.stringify(rowData);

    row.append(colCell, valueCell);
    resultBodyEl.appendChild(row);
  });
}

async function runQuery(query) {
  if (!query) {
    feedbackEl.textContent = 'Cypher를 입력하세요.';
    feedbackEl.className = 'feedback error';
    return null;
  }

  if (currentQuest?.denyWrite && /\b(create|merge|delete|set)\b/i.test(query)) {
    feedbackEl.textContent = '쓰기 연산은 허용되지 않습니다.';
    feedbackEl.className = 'feedback error';
    return null;
  }

  feedbackEl.textContent = '실행 중...';
  feedbackEl.className = 'feedback muted';
  isRunning = true;

  try {
    const response = await fetch(WORKER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher: query })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData.error || 'Cypher 실행 실패';
      throw new Error(message);
    }

    const data = await response.json();
    const normalized = {
      columns: data.columns || [],
      rows: data.rows || []
    };

    lastRunResult = normalized;
    renderResultTable(normalized);
    feedbackEl.textContent = '실행 완료. Submit으로 정답을 확인하세요.';
    feedbackEl.className = 'feedback info';
    return normalized;
  } catch (err) {
    console.error(err);
    const guidance = 'CORS 설정, Worker URL, 배포 상태를 다시 확인하세요.';
    const reason = err.message || '서버에 연결할 수 없습니다.';
    feedbackEl.textContent = `실행 실패: ${reason} (${guidance})`;
    feedbackEl.className = 'feedback error';
    return null;
  } finally {
    isRunning = false;
  }
}

async function handleRun() {
  if (isRunning) return;
  const query = textarea.value.trim();
  progress.answers[currentQuest.id] = query;
  saveProgress(progress);
  await runQuery(query);
}

async function handleSubmit() {
  if (!currentQuest || isRunning) return;
  const query = textarea.value.trim();
  progress.answers[currentQuest.id] = query;
  saveProgress(progress);

  if (!lastRunResult) {
    const executed = await runQuery(query);
    if (!executed) return;
  }

  if (!lastRunResult) return;
  const evaluation = checkResult(lastRunResult, currentQuest.checker);
  feedbackEl.textContent = evaluation.feedback;
  feedbackEl.className = `feedback ${evaluation.correct ? 'success' : 'error'}`;

  if (evaluation.correct) {
    if (!progress.clearedQuestIds.includes(currentQuest.id)) {
      progress.score += 100;
      markCleared(progress, currentQuest.id);
    }

    const nextQuest = getNextQuest(currentQuest.id);
    saveProgress(progress);
    renderQuestList();

    if (nextQuest) {
      selectQuest(nextQuest.id);
    }
  } else {
    saveProgress(progress);
  }
}

function getNextQuest(id) {
  const idx = quests.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  return quests[idx + 1] || null;
}

function handleReset() {
  textarea.value = currentQuest?.starterCypher || '';
  lastRunResult = null;
  feedbackEl.textContent = '초기화되었습니다. 다시 작성해 주세요.';
  feedbackEl.className = 'feedback muted';
}

function handleHint() {
  if (!currentQuest?.hints?.length) return;
  if (revealedHintCount < currentQuest.hints.length) {
    revealedHintCount += 1;
    renderHints();
  }
}

function init() {
  const startId = progress.currentQuestId || quests[0]?.id;
  if (startId) {
    selectQuest(startId);
  }
  runBtn.addEventListener('click', handleRun);
  submitBtn?.addEventListener('click', handleSubmit);
  resetBtn.addEventListener('click', handleReset);
  hintBtn.addEventListener('click', handleHint);
}

init();
