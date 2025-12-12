import { quests } from './quests.js';
import { checkQuery } from './checker.js';
import { loadProgress, saveProgress } from './storage.js';

const questListEl = document.getElementById('quest-list');
const titleEl = document.getElementById('quest-title');
const descEl = document.getElementById('quest-desc');
const objectiveEl = document.getElementById('quest-objective');
const counterEl = document.getElementById('progress-counter');
const questIdEl = document.getElementById('quest-id');
const scoreEl = document.getElementById('score');
const textarea = document.getElementById('cypher-input');
const feedbackEl = document.getElementById('feedback');
const runBtn = document.getElementById('run-btn');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const hintBtn = document.getElementById('hint-btn');
const hintSteps = document.getElementById('hint-steps');

let currentQuest = null;
let progress = loadProgress();
let revealedHintCount = 0;

function computeScore() {
  const completed = Object.values(progress).filter((p) => p.completedAt).length;
  scoreEl.textContent = (completed * 100).toString();
  counterEl.textContent = `${completed} / ${quests.length}`;
}

function renderQuestList() {
  questListEl.innerHTML = '';
  quests.forEach((quest) => {
    const item = document.createElement('li');
    item.className = 'quest-item';
    item.dataset.id = quest.id;

    const label = document.createElement('span');
    label.textContent = `[Ch${quest.chapter}] ${quest.title}`;

    const status = document.createElement('span');
    status.className = 'quest-status';
    status.textContent = progress[quest.id]?.completedAt ? '완료' : '미완료';

    if (currentQuest?.id === quest.id) {
      item.classList.add('active');
    }

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

  titleEl.textContent = quest.title;
  descEl.textContent = quest.story;
  objectiveEl.textContent = quest.objective;
  questIdEl.textContent = quest.id;
  textarea.value = progress[quest.id]?.answer || quest.starterCypher || '';
  feedbackEl.textContent = '결과가 여기 표시됩니다.';
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

function handleHint() {
  if (!currentQuest?.hints?.length) return;
  if (revealedHintCount < currentQuest.hints.length) {
    revealedHintCount += 1;
    renderHints();
  }
}

function handleSubmit() {
  if (!currentQuest) return;

  const userQuery = textarea.value.trim();
  const rule = {
    ...(currentQuest.checker || currentQuest.check),
    denyWrite: currentQuest.denyWrite
  };
  const result = checkQuery(userQuery, rule);

  feedbackEl.textContent = result.message;
  feedbackEl.className = `feedback ${result.passed ? 'success' : 'error'}`;

  if (result.passed) {
    progress[currentQuest.id] = { answer: userQuery, completedAt: Date.now() };
    saveProgress(progress);
    renderQuestList();
  } else {
    progress[currentQuest.id] = { answer: userQuery, completedAt: null };
    saveProgress(progress);
  }
}

function handleReset() {
  textarea.value = '';
  feedbackEl.textContent = '초기화되었습니다. 다시 작성해 주세요.';
  feedbackEl.className = 'feedback muted';
}

function init() {
  selectQuest(quests[0].id);
  runBtn.addEventListener('click', handleSubmit);
  submitBtn?.addEventListener('click', handleSubmit);
  resetBtn.addEventListener('click', handleReset);
  hintBtn.addEventListener('click', handleHint);
}

init();
