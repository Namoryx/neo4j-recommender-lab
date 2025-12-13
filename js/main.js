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
  questMeta: document.getElementById('quest-meta'),
  hintBtn: document.getElementById('hint-btn'),
  hintSteps: document.getElementById('hint-steps'),
  questList: document.getElementById('quest-list'),
  progress: document.getElementById('progress-counter'),
  progressDetail: document.getElementById('progress-detail'),
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
  const chapterMap = quests.reduce((acc, quest) => {
    const key = quest.chapter ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(quest);
    return acc;
  }, {});

  els.questList.innerHTML = '';
  const chapterKeys = Object.keys(chapterMap)
    .map(Number)
    .sort((a, b) => a - b);

  chapterKeys.forEach((chapter) => {
    const header = document.createElement('li');
    header.className = 'quest-group';
    const chapterName = chapter === 0 ? '프롤로그' : `CH${chapter}`;
    const chapterTotal = chapterMap[chapter].length;
    const chapterCleared = chapterMap[chapter].filter((q) => state.clearedIds.includes(q.id)).length;
    header.textContent = `${chapterName} · ${chapterCleared}/${chapterTotal}`;
    els.questList.appendChild(header);

    chapterMap[chapter].forEach((q) => {
      const li = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = `${q.id} · ${q.title}`;
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = q.group === 'pre' ? '사전 체크' : `챕터 ${q.chapter}`;
      const locked = q.group === 'post' && !state.seeded;
      const cleared = state.clearedIds.includes(q.id);
      if (locked) {
        li.classList.add('locked');
      }
      if (cleared) {
        li.classList.add('cleared');
      }
      if (q.id === state.currentQuestId) li.classList.add('active');
      li.appendChild(title);
      li.appendChild(badge);
      li.addEventListener('click', () => {
        if (locked) {
          toast('Seed 완료 후에 진행할 수 있습니다.', 'warning');
          return;
        }
        state.currentQuestId = q.id;
        saveState(state);
        loadQuest(q.id);
      });
      els.questList.appendChild(li);
    });
  });
  renderProgressSummary();
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
  renderQuestMeta(quest);
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
    if (!state.clearedIds.includes(quest.id)) {
      state.score += 100;
      state.clearedIds.push(quest.id);
    }
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

function renderQuestMeta(quest) {
  if (!els.questMeta) return;
  els.questMeta.innerHTML = '';

  const chapter = document.createElement('li');
  chapter.textContent = `챕터: ${quest.chapter === 0 ? '프롤로그' : `CH${quest.chapter}`}`;
  els.questMeta.appendChild(chapter);

  if (quest.constraints?.requireSeed) {
    const li = document.createElement('li');
    li.textContent = 'Seed 완료 후 진행 가능합니다.';
    els.questMeta.appendChild(li);
  }
  if (quest.constraints?.denyWrite) {
    const li = document.createElement('li');
    li.textContent = '쓰기 연산 금지 (CREATE/MERGE/DELETE/SET)';
    els.questMeta.appendChild(li);
  }
  if (quest.allowedOps?.length) {
    const li = document.createElement('li');
    li.textContent = `허용 키워드: ${quest.allowedOps.join(', ')}`;
    els.questMeta.appendChild(li);
  }
}

function renderProgressSummary() {
  const total = quests.length;
  const cleared = state.clearedIds.length;
  els.progress.textContent = `${cleared} / ${total}`;

  if (!els.progressDetail) return;
  const chapterStats = quests.reduce((acc, quest) => {
    const key = quest.chapter ?? 0;
    if (!acc[key]) acc[key] = { total: 0, cleared: 0 };
    acc[key].total += 1;
    if (state.clearedIds.includes(quest.id)) acc[key].cleared += 1;
    return acc;
  }, {});
  const summary = Object.keys(chapterStats)
    .map(Number)
    .sort((a, b) => a - b)
    .map((chapter) => {
      const name = chapter === 0 ? '프롤로그' : `CH${chapter}`;
      const { total: t, cleared: c } = chapterStats[chapter];
      return `${name} ${c}/${t}`;
    })
    .join(' · ');
  els.progressDetail.textContent = summary;
}

updateScore();
init();
