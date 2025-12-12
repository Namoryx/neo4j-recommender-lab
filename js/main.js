import { API_BASE, checkSeeded, seedData } from './api.js';
import { showOverlaySeedRequired, toast, setFeedback } from './render.js';
import {
  availableQuests,
  evaluate,
  getQuestById,
  loadState,
  nextQuestId,
  quests,
  runCurrentQuest,
  saveState,
} from './game.js';

let state = loadState();
let lastResult = null;
let hintIndex = 0;

const els = {
  questId: document.getElementById('quest-id'),
  score: document.getElementById('score'),
  title: document.getElementById('quest-title'),
  desc: document.getElementById('quest-desc'),
  objective: document.getElementById('quest-objective'),
  hintBtn: document.getElementById('hint-btn'),
  hintSteps: document.getElementById('hint-steps'),
  questList: document.getElementById('quest-list'),
  progress: document.getElementById('progress-counter'),
  textarea: document.getElementById('cypher-input'),
  resetBtn: document.getElementById('reset-btn'),
  runBtn: document.getElementById('run-btn'),
  submitBtn: document.getElementById('submit-btn'),
  seedBtn: document.getElementById('seed-btn'),
  overlaySeedBtn: document.getElementById('overlay-seed-btn'),
  feedback: document.getElementById('feedback'),
  resultShell: document.getElementById('result-shell'),
  health: document.getElementById('health-indicator'),
};

async function init() {
  bindEvents();
  renderQuestList();
  await refreshHealth();
  await enforceSeeding();
  loadQuest(state.currentQuestId);
}

async function refreshHealth() {
  if (!els.health) return;
  try {
    const res = await fetch(`${API_BASE}/health`);
    const text = await res.text();
    els.health.textContent = res.ok ? `Worker OK (${text})` : 'Worker 불안정';
  } catch (err) {
    els.health.textContent = 'Worker 연결 실패';
  }
}

function bindEvents() {
  els.hintBtn?.addEventListener('click', () => showNextHint());
  els.resetBtn?.addEventListener('click', () => resetEditor());
  els.runBtn?.addEventListener('click', () => handleRun());
  els.submitBtn?.addEventListener('click', () => handleSubmit());
  els.seedBtn?.addEventListener('click', () => handleSeed());
  els.overlaySeedBtn?.addEventListener('click', () => handleSeed());
}

async function enforceSeeding() {
  const seededActual = await checkSeeded();
  state.seeded = seededActual;
  saveState(state);
  toggleOverlay(!state.seeded);
  updateButtons();
  renderQuestList();
}

function toggleOverlay(show) {
  const current = getQuestById(state.currentQuestId);
  const shouldShow = show && !state.seeded && current.group === 'post';
  showOverlaySeedRequired(shouldShow);
}

function updateButtons() {
  const current = getQuestById(state.currentQuestId);
  const locked = current.group === 'post' && !state.seeded;
  els.runBtn.disabled = locked;
  els.submitBtn.disabled = locked;
  els.seedBtn.textContent = state.seeded ? 'Seed 완료' : '데이터 초기화(Seed)';
  els.seedBtn.disabled = state.seeded;
  if (locked) {
    setFeedback('데이터를 Seed한 후에 진행하세요.', false);
  }
}

function renderQuestList() {
  const list = availableQuests(state.seeded);
  els.questList.innerHTML = '';
  list.forEach((q) => {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = `${q.id} · ${q.title}`;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = q.group === 'pre' ? '사전 체크' : '시드 필요';
    if (q.group === 'post' && !state.seeded) {
      li.classList.add('locked');
    }
    if (q.id === state.currentQuestId) li.classList.add('active');
    li.appendChild(title);
    li.appendChild(badge);
    li.addEventListener('click', () => {
      if (q.group === 'post' && !state.seeded) {
        toast('Seed 완료 후에 진행할 수 있습니다.', 'warning');
        return;
      }
      state.currentQuestId = q.id;
      saveState(state);
      loadQuest(q.id);
    });
    els.questList.appendChild(li);
  });
  els.progress.textContent = `${list.length} / ${quests.length}`;
}

function loadQuest(questId) {
  let quest = getQuestById(questId);
  if (quest.group === 'post' && !state.seeded) {
    quest = availableQuests(false)[0];
    state.currentQuestId = quest.id;
    saveState(state);
  }
  hintIndex = 0;
  els.questId.textContent = quest.id;
  els.title.textContent = quest.title;
  els.desc.textContent = quest.story;
  els.objective.textContent = quest.objective;
  els.hintSteps.innerHTML = '';
  els.feedback.textContent = '정답 여부가 여기 표시됩니다.';
  els.feedback.className = 'feedback muted';
  if (els.textarea) {
    els.textarea.value = quest.starterCypher;
  }
  lastResult = null;
  updateButtons();
  toggleOverlay(!state.seeded);
}

function showNextHint() {
  const quest = getQuestById(state.currentQuestId);
  if (hintIndex >= quest.hints.length) return;
  const item = document.createElement('li');
  item.textContent = quest.hints[hintIndex];
  els.hintSteps.appendChild(item);
  hintIndex += 1;
}

function resetEditor() {
  const quest = getQuestById(state.currentQuestId);
  if (els.textarea) {
    els.textarea.value = quest.starterCypher;
  }
  setFeedback('초기화했습니다.', null);
}

async function handleRun() {
  const quest = getQuestById(state.currentQuestId);
  if (quest.group === 'post' && !state.seeded) {
    toast('Seed 먼저 실행하세요.', 'warning');
    toggleOverlay(true);
    return;
  }
  toggleLoading(true);
  try {
    lastResult = await runCurrentQuest(state, quest);
  } catch (err) {
    toast(err.message || '실행 실패', 'error');
  } finally {
    toggleLoading(false);
  }
}

async function handleSubmit() {
  const quest = getQuestById(state.currentQuestId);
  if (quest.group === 'post' && !state.seeded) {
    toast('Seed 완료 후 제출 가능합니다.', 'warning');
    toggleOverlay(true);
    return;
  }
  if (!lastResult) {
    toast('먼저 Run을 실행하세요.', 'info');
    return;
  }
  const result = evaluate(quest, lastResult);
  setFeedback(result.feedback, result.correct);
  if (result.correct) {
    state.score += 100;
    const nextId = nextQuestId(quest.id, state.seeded);
    state.currentQuestId = nextId;
    saveState(state);
    renderQuestList();
    loadQuest(nextId);
  } else {
    saveState(state);
  }
  updateScore();
}

async function handleSeed() {
  toggleSeedButtons(true);
  try {
    toast('Seed 실행 중...', 'info');
    const res = await seedData();
    if (res?.ok === false) {
      toast(res.error || 'Seed 실패', 'error');
    } else if (res?.error === 'already seeded') {
      toast('이미 데이터가 있습니다(스킵)', 'success');
    } else if (res?.error) {
      toast(res.error, 'error');
    } else {
      toast(res.seeded ? '샘플 데이터 생성 완료' : '이미 데이터가 있습니다(스킵)', 'success');
    }

    const seeded = await checkSeeded();
    state.seeded = seeded;
    saveState(state);
    toggleOverlay(!seeded);
    renderQuestList();
    updateButtons();
    if (seeded) {
      const next = availableQuests(true).find((q) => q.group === 'post');
      if (next) {
        state.currentQuestId = next.id;
        saveState(state);
        loadQuest(next.id);
      }
    }
  } catch (err) {
    toast(err.message || 'Seed 중 오류 발생', 'error');
  } finally {
    toggleSeedButtons(false);
  }
}

function toggleSeedButtons(disabled) {
  els.seedBtn.disabled = disabled || state.seeded;
  els.overlaySeedBtn.disabled = disabled;
  if (disabled) {
    els.seedBtn.textContent = 'Seeding...';
    els.overlaySeedBtn.textContent = 'Seeding...';
  } else {
    els.seedBtn.textContent = state.seeded ? 'Seed 완료' : '데이터 초기화(Seed)';
    els.overlaySeedBtn.textContent = '데이터 초기화(Seed)';
  }
}

function toggleLoading(on) {
  els.runBtn.disabled = on || (getQuestById(state.currentQuestId).group === 'post' && !state.seeded);
  els.submitBtn.disabled = on || (getQuestById(state.currentQuestId).group === 'post' && !state.seeded);
  els.runBtn.textContent = on ? 'Running...' : 'Run';
  els.submitBtn.textContent = on ? 'Submitting...' : 'Submit';
}

function updateScore() {
  els.score.textContent = state.score;
}

updateScore();
init();
