/* post-survey.js（整理版）
   - 匿名認証の準備を待機
   - 事後アンケートを /users/<uid>/postSurvey に保存（上書きOK）
   - 互換：/users/<loginName>/postSurvey にもミラー（任意・失敗しても続行）
   - 送信後：完了メッセージ→index.html or map.html へ遷移（要件に応じて調整）
   - /events に簡易ログ（任意）
*/

(function(){
  const $ = (s) => document.querySelector(s);
  const form = $('#postSurveyForm');
  const submitBtn = $('#submitBtn');
  const skipBtn = $('#skipBtn');
  const msg = $('#msg');

  function setOK(t){ msg.innerHTML = `<span class="ok">✔ ${t}</span>`; }
  function setNG(t){ msg.innerHTML = `<span class="ng">✖ ${t}</span>`; }
  function clearMsg(){ msg.textContent = ''; }

  async function ensureFirebaseReady() {
    if (window.firebaseReadyPromise) {
      try { await window.firebaseReadyPromise; } catch (e) { /* no-op */ }
    }
    if (!(window.firebase && firebase.apps && firebase.apps.length)) {
      throw new Error('Firebaseが初期化されていません');
    }
  }

  function getValue(name) {
    const els = form.querySelectorAll(`[name="${name}"]`);
    if (!els || !els.length) return null;
    if (els[0].type === 'radio') {
      const picked = form.querySelector(`input[name="${name}"]:checked`);
      return picked ? picked.value : null;
    }
    if (els[0].tagName === 'SELECT') return (els[0]).value || null;
    return (els[0]).value || null;
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

  async function savePostSurvey() {
    await ensureFirebaseReady();

    const uid =
      (firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
      localStorage.getItem('uid') || null;
    if (!uid) throw new Error('匿名認証のUIDが取得できませんでした');

    const satisfaction = getValue('satisfaction');
    const usability    = getValue('usability');
    const favoriteSpot = getValue('favoriteSpot');
    const commentEl    = $('#comment');
    const comment      = commentEl ? (commentEl.value || '') : '';

    if (!satisfaction || !usability || !favoriteSpot) {
      throw new Error('未入力の項目があります');
    }

    // 保存データ
    const now = (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now();
    const data = {
      satisfaction: Number(satisfaction),
      usability: Number(usability),
      favoriteSpot,
      comment,
      updatedAt: now
    };

    // 本線：uid 側
    const ref = firebase.database().ref(`users/${uid}/postSurvey`);
    await ref.update(data);

    // 互換：loginName 側にミラー（任意）
    try {
      const ln = localStorage.getItem('loginName');
      if (ln && ln !== uid) {
        await firebase.database().ref(`users/${ln}/postSurvey`).update(data);
      }
    } catch (e) {
      console.warn('[post-survey] mirror failed:', e && e.message ? e.message : e);
    }

    // ログ
    logEvent('post_survey_saved', { satisfaction: data.satisfaction, usability: data.usability, favoriteSpot: data.favoriteSpot }).catch(()=>{});
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    clearMsg();
    submitBtn.disabled = true;

    try {
      await savePostSurvey();
      setOK('ご回答ありがとうございました。トップへ戻ります…');
      setTimeout(() => { location.href = 'index.html'; }, 400);
    } catch (e) {
      console.warn('[post-survey] submit failed:', e);
      const t = (e && e.message) ? e.message : '送信に失敗しました。通信環境をご確認ください。';
      setNG(t);
      submitBtn.disabled = false;
    }
  }

  function onSkip() {
    clearMsg();
    logEvent('post_survey_skipped').catch(()=>{});
    location.href = 'index.html';
  }

  function init() {
    form.addEventListener('submit', onSubmit);
    if (skipBtn) skipBtn.addEventListener('click', onSkip);

    // ページ表示ログ（任意）
    logEvent('post_survey_open').catch(()=>{});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
