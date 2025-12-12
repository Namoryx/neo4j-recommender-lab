import { quests } from './quests.js';
import { checkResult } from './checker.js';
import { loadProgress, saveProgress, markCleared } from './storage.js';

const API_BASE = 'https://neo4j-runner.neo4j-namoryx.workers.dev';
// Cloudflare Worker endpoint that executes Cypher.
const DEFAULT_WORKER_ENDPOINT = `${API_BASE}/run`;
const SEEDED_FLAG_KEY = 'seeded';

function readRuntimeEnv(key) {
  if (typeof window !== 'undefined' && window?.[key]) {
    return window[key];
  }

  if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
    return import.meta.env[key];
  }

  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key];
  }

  return undefined;
}

function resolveWorkerEndpoint() {
  const runtimeEndpoint = readRuntimeEnv('WORKER_ENDPOINT') || readRuntimeEnv('VITE_WORKER_ENDPOINT');
  const endpoint = runtimeEndpoint || DEFAULT_WORKER_ENDPOINT;
  const isPlaceholder = !endpoint || /your-worker-subdomain|example\.com/i.test(endpoint);

  if (isPlaceholder) {
    return { endpoint: null, reason: '실제 Cloudflare Worker URL을 설정하세요.' };
  }

  return { endpoint, reason: null };
}

function renderEndpointBanner(message) {
  if (!message) return;

  let banner = document.getElementById('endpoint-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'endpoint-banner';
    banner.className = 'env-banner error';
    document.body.prepend(banner);
  }

  banner.textContent = message;
}

const { endpoint: WORKER_ENDPOINT, reason: endpointError } = resolveWorkerEndpoint();

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
const seedBtn = document.getElementById('seed-btn');

let progress = loadProgress();
let currentQuest = null;
let revealedHintCount = 0;
let lastRunResult = null;
let isRunning = false;
let toastTimer = null;

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

function isSeeded() {
  try {
    return localStorage.getItem(SEEDED_FLAG_KEY) === 'true';
  } catch (err) {
    console.warn('localStorage 접근 불가', err);
    return false;
  }
}

function setSeededFlag() {
  try {
    localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  } catch (err) {
    console.warn('localStorage 저장 실패', err);
  }
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3200);
}

function setSeedButtonState({ loading = false, seeded = false } = {}) {
  if (!seedBtn) return;

  seedBtn.disabled = loading || seeded;
  seedBtn.classList.toggle('loading', loading);
  seedBtn.classList.toggle('completed', seeded);

  if (loading) {
    seedBtn.textContent = '초기화 중...';
    return;
  }

  if (seeded) {
    seedBtn.textContent = '완료됨';
    return;
  }

  seedBtn.textContent = '데이터 초기화(Seed)';
}

async function triggerSeed() {
  if (!seedBtn) return;
  if (isSeeded()) {
    setSeedButtonState({ seeded: true });
    showToast('이미 시드가 완료되었습니다.', 'success');
    return;
  }

  setSeedButtonState({ loading: true });

  try {
    const response = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody.error || '데이터 초기화에 실패했습니다.';
      throw new Error(message);
    }

    const data = await response.json().catch(() => ({}));
    const message = data.message || '';
    const alreadySeeded = /already\s*seeded/i.test(message) || data.alreadySeeded;

    setSeededFlag();
    setSeedButtonState({ seeded: true });

    if (alreadySeeded) {
      showToast('이미 초기화된 데이터입니다.', 'info');
    } else {
      showToast('데이터 시드가 완료되었습니다!', 'success');
    }
  } catch (err) {
    console.error(err);
    setSeedButtonState({ seeded: isSeeded() });
    showToast(`초기화 실패: ${err.message || '알 수 없는 오류'}`, 'error');
  }
}

async function runQuery(query) {
  if (!query) {
    feedbackEl.textContent = 'Cypher를 입력하세요.';
    feedbackEl.className = 'feedback error';
    return null;
  }

  if (!WORKER_ENDPOINT) {
    feedbackEl.textContent = 'Worker URL이 설정되지 않았습니다. 환경 변수를 확인하세요.';
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
  if (endpointError) {
    renderEndpointBanner(endpointError);
    feedbackEl.textContent = endpointError;
    feedbackEl.className = 'feedback error';
  }

  setSeedButtonState({ seeded: isSeeded() });

  const startId = progress.currentQuestId || quests[0]?.id;
  if (startId) {
    selectQuest(startId);
  }
  runBtn.addEventListener('click', handleRun);
  submitBtn?.addEventListener('click', handleSubmit);
  resetBtn.addEventListener('click', handleReset);
  hintBtn.addEventListener('click', handleHint);
  seedBtn?.addEventListener('click', triggerSeed);
}

init();
