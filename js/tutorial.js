/* tutorial.js（整理版）
   - 匿名認証の準備を待機（あれば）
   - 「カメラをテスト」：getUserMediaで許可確認→すぐ停止→/events にログ
   - 「マップへ進む」：/events にログして map.html へ遷移
*/

(function () {
  const $ = (s) => document.querySelector(s);
  const testBtn = $('#testCameraBtn');
  const goBtn   = $('#goMapBtn');
  const status  = $('#camStatus');

  function setStatusOk(msg){ status.innerHTML = `<span class="ok">✔ ${msg}</span>`; }
  function setStatusNg(msg){ status.innerHTML = `<span class="ng">✖ ${msg}</span>`; }
  function setStatus(msg){ status.textContent = msg || ''; }

  async function ensureFirebaseReady() {
    if (window.firebaseReadyPromise) {
      try { await window.firebaseReadyPromise; } catch (e) { /* no-op */ }
    }
    return (window.firebase && firebase.apps && firebase.apps.length) ? firebase : null;
  }

  // 最小イベントログ（任意）
  async function logEvent(type, meta = {}) {
    const fb = await ensureFirebaseReady();
    if (!fb) return;
    try {
      const uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || localStorage.getItem('uid') || 'guest';
      const ref = firebase.database().ref('events').push();
      await ref.set({
        uid,
        type,          // 'tutorial_open' | 'camera_test' | 'go_map'
        ...meta,       // { ok: true/false, err: '...' }
        ts: (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now(),
        ua: navigator.userAgent
      });
    } catch (e) { /* no-op */ }
  }

  async function testCamera() {
    setStatus('カメラ起動をテストしています…');
    testBtn.disabled = true;
    try {
      // できるだけ軽い取得（フロントカメラを強制しない）
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // すぐ停止
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      setStatusOk('カメラの使用許可が確認できました。AR起動も問題ない見込みです。');
      await logEvent('camera_test', { ok: true });
    } catch (e) {
      // ブラウザ権限が拒否 / 端末にカメラ無し / ページが非HTTPS など
      const msg = (e && e.name) ? `${e.name}: ${e.message || ''}` : (e && e.message) || '不明なエラー';
      setStatusNg('カメラが使用できませんでした。ブラウザのサイト設定からカメラ許可をご確認ください。');
      await logEvent('camera_test', { ok: false, err: msg });
    } finally {
      testBtn.disabled = false;
    }
  }

  async function goToMap() {
    goBtn.disabled = true;
    setStatus('');
    try {
      await logEvent('go_map');
    } finally {
      location.href = 'map.html';
    }
  }

  async function init() {
    // ページ表示をイベントログ（任意）
    logEvent('tutorial_open').catch(()=>{});

    if (testBtn) testBtn.addEventListener('click', testCamera);
    if (goBtn)   goBtn.addEventListener('click', goToMap);

    // iOS の戻るキャッシュ対策（戻ってきたら表示をクリア）
    window.addEventListener('pageshow', () => setStatus(''));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
