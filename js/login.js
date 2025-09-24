/* login.js（整理版）
   - 匿名認証の準備完了を待って uid を取得
   - 表示名(loginName)を localStorage に保存
   - ユーザープロファイルを /users/<uid>/profile に保存（上書きOK）
   - 互換のため /users/<loginName>/aliasUid に uid をミラー（任意）
   - initial-survey.html へ遷移
*/

(function () {
  const $ = (s) => document.querySelector(s);
  const form = $('#loginForm');
  const input = $('#loginName');
  const startBtn = $('#startBtn');
  const msg = $('#msg');

  // 既存の表示名があればプレフィル
  try {
    const saved = localStorage.getItem('loginName');
    if (saved) input.value = saved;
  } catch {}

  async function ensureFirebaseReady() {
    if (window.firebaseReadyPromise) {
      try { await window.firebaseReadyPromise; } catch (e) {
        console.warn('[login] firebaseReadyPromise error:', e);
      }
    }
    if (!(window.firebase && firebase.apps && firebase.apps.length)) {
      throw new Error('Firebaseが初期化されていません');
    }
    if (!(firebase.auth && firebase.auth().currentUser)) {
      // 念のため再試行（匿名認証）
      try { await firebase.auth().signInAnonymously(); } catch {}
    }
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    msg.textContent = '';
    startBtn.disabled = true;

    const name = (input.value || '').trim();
    if (!name) {
      msg.textContent = '表示名を入力してください';
      startBtn.disabled = false;
      return;
    }

    try {
      await ensureFirebaseReady();
      const uid =
        (firebase.auth().currentUser && firebase.auth().currentUser.uid) ||
        localStorage.getItem('uid') ||
        null;

      if (!uid) throw new Error('匿名認証のUIDが取得できませんでした');

      // 端末へ保存（既存コード互換）
      try {
        localStorage.setItem('loginName', name);
        localStorage.setItem('userId', uid); // 互換キー
      } catch {}

      // DBにプロフィール保存（安全：auth != null ルール前提）
      const profRef = firebase.database().ref(`users/${uid}/profile`);
      const now = (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now();
      // 既存データを壊さず更新
      await profRef.update({
        loginName: name,
        lastLoginAt: now
      }).catch(console.warn);

      // 任意：表示名→uid のミラー（互換運用用）
      try {
        await firebase.database().ref(`users/${name}/aliasUid`).set(uid);
      } catch (e) {
        console.warn('[login] aliasUid set failed:', e && e.message ? e.message : e);
      }

      // 画面遷移（初回アンケートへ）
      location.href = 'initial-survey.html';
    } catch (e) {
      console.warn('[login] start failed:', e);
      msg.textContent = 'ログインに失敗しました。通信環境を確認して再度お試しください。';
      startBtn.disabled = false;
    }
  }

  // Enter でも送信できるよう form submit を使う
  form.addEventListener('submit', onSubmit);
})();
