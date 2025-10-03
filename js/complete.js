// complete.js（差し替え版）
// 目的：現在ユーザーのスタンプ取得を「6スポット」で判定し、UIを表示。
// 仕様：
//  - Firebase v8 を使用し users/<uid>/stamps を once('value') で取得
//  - ローカルフォールバックは uid 名前空間付き localStorage: stamp_<uid>_<spotId> = 'true'
//  - uid 取得は ensureAnon() 優先、失敗時は localStorage の uid
//  - 完走（6/6）で #completeCard を表示、未達なら #notComplete を表示

(function () {
  const ALL_SPOTS = ['spot1','spot2','spot3','spot4','spot5','spot6'];
  const TARGET = 6;

  function getLocalUid() {
    try { return localStorage.getItem('uid') || null; } catch { return null; }
  }
  async function getUid() {
    if (typeof window.ensureAnon === 'function') {
      try {
        const uid = await window.ensureAnon();
        if (uid) return uid;
      } catch {}
    }
    // fallback
    return getLocalUid();
  }

  function lsKey(uid, spot) { return `stamp_${uid}_${spot}`; }
  function localGot(uid, spot) {
    if (!uid) return false;
    try { return localStorage.getItem(lsKey(uid, spot)) === 'true'; } catch { return false; }
  }

  async function fetchRemoteStamps(uid) {
    if (!uid) return {};
    try {
      if (!(window.firebase && firebase.apps && firebase.apps.length)) return {};
      const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value');
      return snap && snap.val ? snap.val() : {};
    } catch (e) {
      console.warn('[complete] remote fetch failed:', e?.message || e);
      return {};
    }
  }

  async function detectComplete() {
    const uid = await getUid();
    // リモート
    const remote = await fetchRemoteStamps(uid);
    // マージ（ローカル優先で穴埋め）
    const owned = {};
    ALL_SPOTS.forEach(s => {
      const r = !!remote[s];
      const l = localGot(uid, s);
      owned[s] = r || l;
    });
    const count = ALL_SPOTS.reduce((n, s) => n + (owned[s] ? 1 : 0), 0);
    return count >= TARGET;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await detectComplete();
    const card = document.getElementById('completeCard');
    const noti = document.getElementById('notComplete');
    if (ok) { if (card) card.style.display = 'block'; if (noti) noti.style.display = 'none'; }
    else    { if (card) card.style.display = 'none';  if (noti) noti.style.display = 'block'; }
  });
})();
