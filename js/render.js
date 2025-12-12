export function renderTable(result, container) {
  if (!result || !Array.isArray(result.values)) {
    container.innerHTML = '<div class="muted">표시할 데이터가 없습니다.</div>';
    return;
  }

  const { fields = [], values = [] } = result;
  if (!fields.length) {
    container.innerHTML = '<div class="muted">컬럼 정보가 없습니다.</div>';
    return;
  }

  const header = fields.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const rows = values
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(JSON.stringify(cell))}</td>`).join('')}</tr>`) //
    .join('');

  container.innerHTML = `
    <table class="table">
      <thead><tr>${header}</tr></thead>
      <tbody>${rows || '<tr><td colspan="'+fields.length+'" class="muted">0 rows</td></tr>'}</tbody>
    </table>
  `;
}

export function toast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function showOverlaySeedRequired(isOn) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.classList.toggle('hidden', !isOn);
}

export function setFeedback(text, isSuccess = null) {
  const el = document.getElementById('feedback');
  if (!el) return;
  el.textContent = text;
  el.className = 'feedback ' + (isSuccess === null ? '' : isSuccess ? 'success' : 'error');
  if (isSuccess === null) el.classList.add('muted');
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
