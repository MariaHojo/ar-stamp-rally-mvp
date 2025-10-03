// tutorial.js（差し替え）
document.addEventListener('DOMContentLoaded', async () => {
  // withV フォールバック（firebase.js で定義済みだが念のため）
  if (!window.withV) {
    window.BUILD_V = window.BUILD_V || '20251003';
    window.withV = (url) => url + (url.includes('?') ? '&' : '?') + 'v=' + window.BUILD_V;
  }

  // 匿名UIDの確保（存在する場合のみ）
  try { await window.ensureAnon?.(); } catch (e) {}

  const startBtn = document.getElementById('goMap') || document.getElementById('goMapBtn') || document.querySelector('[data-action="start"]');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      try { localStorage.setItem('tutorial_done', '1'); } catch (e) {}
      location.href = withV('map.html');
    });
  }
});
