// tutorial.js (no-initial-survey)
// 役割：チュートリアル表示と「マップへ」遷移のみ。
// - 初回アンケートへリダイレクトするロジックは一切含めません。
// - 必要であれば匿名UIDの確保だけ行い、副作用を起こしません。

(function () {
  async function ensureAnonSafe() {
    // firebase.js 側の ensureAnon を利用（なければフォールバック）
    if (typeof window.ensureAnon === 'function') {
      try { return await window.ensureAnon(); } catch {}
    }
    try {
      if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await auth.signInAnonymously();
      return cred.user && cred.user.uid;
    } catch (e) {
      console.warn('[tutorial] anon sign-in skipped:', e?.message || e);
      return null;
    }
  }

  function goMap() {
    // 余計な中継を避けて直接 map.html へ
    location.href = 'map.html';
  }

  function boot() {
    const btn = document.getElementById('startBtn');
    if (btn) btn.addEventListener('click', goMap, { passive: true });

    // 匿名UIDだけ事前に確保（画面遷移やストレージ変更などの副作用は起こさない）
    ensureAnonSafe();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
