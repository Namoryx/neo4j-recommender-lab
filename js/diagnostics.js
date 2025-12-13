import { API_BASE } from './config.js';

let logContainer = null;
let bannerContainer = null;

export function initDiagnostics() {
  logContainer = document.getElementById('diagnostics-log');
  bannerContainer = document.getElementById('banner-container');
}

export function logDiagnostic(title, detail = '') {
  if (!logContainer) return;
  const entry = document.createElement('div');
  entry.className = 'diag-entry';
  const meta = document.createElement('div');
  meta.className = 'diag-meta';
  meta.textContent = `${new Date().toLocaleTimeString()} · ${title}`;
  entry.appendChild(meta);
  if (detail) {
    const pre = document.createElement('pre');
    pre.textContent = detail.length > 1200 ? `${detail.slice(0, 1200)}...` : detail;
    entry.appendChild(pre);
  }
  logContainer.prepend(entry);
}

export function showErrorBanner(message, stack = '') {
  if (!bannerContainer) return;
  bannerContainer.innerHTML = '';
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  const title = document.createElement('div');
  title.className = 'error-banner__title';
  title.textContent = message;
  banner.appendChild(title);
  if (stack) {
    const snippet = document.createElement('pre');
    snippet.textContent = stack.split('\n').slice(0, 3).join('\n');
    banner.appendChild(snippet);
  }
  bannerContainer.appendChild(banner);
}

export function clearErrorBanner() {
  if (bannerContainer) {
    bannerContainer.innerHTML = '';
  }
}

function detectCorsOrMixed(url) {
  const isMixed = window?.location?.protocol === 'https:' && /^http:\/\//.test(url);
  if (isMixed) {
    return 'Mixed content: HTTPS 페이지에서 HTTP 요청을 할 수 없습니다.';
  }
  return '네트워크/CORS 차단 의심: 브라우저 콘솔을 확인하세요.';
}

export async function apiFetch(url, options = {}, context = 'API 요청') {
  const started = performance.now();
  const method = options?.method || 'GET';
  try {
    if (window?.location?.protocol === 'https:' && /^http:\/\//.test(url)) {
      const message = detectCorsOrMixed(url);
      const error = new Error(message);
      logDiagnostic(`${context} 실패`, `${method} ${url}\n${message}`);
      showErrorBanner(message, error.stack || '');
      throw error;
    }

    const response = await fetch(url, options);
    let bodyText = '';
    try {
      bodyText = await response.clone().text();
    } catch (err) {
      bodyText = `[body read 실패: ${err.message}]`;
    }

    const duration = Math.round(performance.now() - started);
    const title = `${context} (${response.status})`;
    const detail = `${method} ${url}\n${bodyText || '[empty body]'}\n${duration}ms`;
    logDiagnostic(title, detail);

    if (!response.ok) {
      const stack = new Error(`HTTP ${response.status}`).stack || '';
      showErrorBanner(`요청 실패: ${response.status}`, `${bodyText}\n${stack}`);
    } else {
      clearErrorBanner();
    }

    return { response, bodyText };
  } catch (err) {
    const hint = detectCorsOrMixed(url);
    const detail = `${method} ${url}\n${err.message}\n${hint}`;
    logDiagnostic(`${context} 오류`, detail);
    showErrorBanner('네트워크 오류', `${err.message}\n${(err.stack || '').split('\n').slice(0, 2).join('\n')}`);
    throw err;
  }
}

export async function runHealthCheck() {
  try {
    const { response, bodyText } = await apiFetch(`${API_BASE}/health`, {}, 'Health check');
    const message = bodyText?.trim() || response.statusText || '응답 없음';
    if (response.ok) {
      return { ok: true, message };
    }
    // If /health is present but returns an error, still attempt the fallback.
    const fallback = await runReturnOneTest();
    return {
      ok: fallback.ok,
      message: fallback.ok ? 'RETURN 1 fallback 성공 (/health 오류)' : message,
    };
  } catch (err) {
    // Fallback: some runner instances expose only /run; attempt RETURN 1
    try {
      const fallback = await runReturnOneTest();
      return {
        ok: fallback.ok,
        message: fallback.ok ? 'RETURN 1 fallback 성공' : 'Health 및 fallback 실패',
      };
    } catch (innerErr) {
      throw err || innerErr;
    }
  }
}

export async function runReturnOneTest() {
  const { response, bodyText } = await apiFetch(
    `${API_BASE}/run`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher: 'RETURN 1 AS ok', params: {} }),
    },
    'RETURN 1 테스트'
  );
  return { ok: response.ok, body: bodyText };
}
