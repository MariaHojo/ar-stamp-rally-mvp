/* survey.js（整理版）
   - 匿名認証の準備を待機
   - 年齢層を /users/<uid>/info に保存（上書きOK）
   - 互換：/users/<loginName>/info にもミラー保存（任意・失敗しても続行）
   - 保存成功後に tutorial.html へ遷移（スキップも可）
*/

(function () {
  const $ = (s) => document.querySelector(s);
  const form = $('#surveyForm');
  const submitBtn = $('#submitBtn');
  const skipBtn = $('#skipBtn');
  const msg = $('#msg');

  function setOK(text){ msg.innerHTML = `<span class="ok">✔ ${text}</span>`; }
  function setNG(text){ msg.innerHTML = `<span class="ng">✖ ${text}</span>`; }
  function clearMsg(){ msg.textContent = ''; }

  async function ensureFirebaseReady() {
    if (window.firebaseReadyPromise) {
      try { await window.firebaseReadyPromise; } catch (e) { /* no-op */ }
    }
    if (!(window.firebase && firebase.apps && firebase.apps.length)) {
      throw new Error('Firebaseが初期化されていません');
    }
  }

  function getSelectedAge() {
    const el = form.querySelector('input[name="age"]:checked');
    return el ? el.value : null;
  }

  async function logEvent(type, meta = {}) {
    try {
      await ensureFirebaseReady();
      const uid = (firebase.auth().currentUser && firebase.auth().currentUser.uid) || localStorage.getItem('uid') || 'guest';
      const ref = firebase.database().ref('events').push();
      await ref.set({
        uid, type, ...meta,
        ts: (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now(),
        ua: navigator.userAgent
      });
    } catch (_) {}
  }

  async function saveSurvey() {
    await ensureFirebaseReady();

    const uid =
      (firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
      localStorage.getItem('uid') || null;
    if (!uid) throw new Error('匿名認証のUIDが取得できませんでした');

    const age = getSelectedAge();
    if (!age) throw new Error('年齢層を選択してください');

    // 端末保存（互換）
    try { localStorage.setItem('ageGroup', age); } catch {}

    // DB 保存（uid 側が本線）
    const now = (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now();
    const infoRef = firebase.database().ref(`users/${uid}/info`);
    await infoRef.update({ ageGroup: age, updatedAt: now });

    // 互換：loginName 側にミラー（任意）
    try {
      const ln = localStorage.getItem('loginName');
      if (ln && ln !== uid) {
        await firebase.database().ref(`users/${ln}/info`).update({ ageGroup: age, updatedAt: now });
      }
    } catch (e) {
      console.warn('[survey] mirror failed:', e && e.message ? e.message : e);
    }

    // ログ
    logEvent('initial_survey_saved', { ageGroup: age }).catch(()=>{});
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    clearMsg();
    submitBtn.disabled = true;

    try {
      await saveSurvey();
      setOK('保存しました。次の画面へ進みます…');
      // 少し待ってから遷移（画面読みやすく）
      setTimeout(() => { location.href = 'tutorial.html'; }, 300);
    } catch (e) {
      console.warn('[survey] submit failed:', e);
      const t = (e && e.message) ? e.message : '保存に失敗しました。通信環境をご確認ください。';
      setNG(t);
      submitBtn.disabled = false;
    }
  }

  function onSkip() {
    clearMsg();
    logEvent('initial_survey_skipped').catch(()=>{});
    location.href = 'tutorial.html';
  }

  function init() {
    form.addEventListener('submit', onSubmit);
    if (skipBtn) skipBtn.addEventListener('click', onSkip);
    // 既に選択済みの年齢があればプリセット（任意）
    try {
      const prev = localStorage.getItem('ageGroup');
      if (prev) {
        const el = form.querySelector(`input[name="age"][value="${prev}"]`);
        if (el) el.checked = true;
      }
    } catch {}
    // ページ表示ログ（任意）
    logEvent('initial_survey_open').catch(()=>{});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
