const STORAGE_KEY = 'cypher-quest-progress';

const defaultProgress = {
  currentQuestId: null,
  score: 0,
  clearedQuestIds: [],
  answers: {}
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaultProgress, ...parsed };
  } catch (err) {
    console.warn('Progress load failed', err);
    return { ...defaultProgress };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Progress save failed', err);
  }
}

export function markCleared(progress, questId) {
  if (!progress.clearedQuestIds.includes(questId)) {
    progress.clearedQuestIds.push(questId);
  }
}
