// js/login.js — ルールでread不可でも先へ進む／ローカルに保存
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('loginName');
  const btn   = document.getElementById('startBtn');
  if (!input || !btn) return;

  btn.addEventListener('click', async () => {
    const name = String(input.value || '').trim();
    if (!name) {
      alert('ログイン名を入力してください');
      return;
    }

    // まずローカル保存（map.js では userId or loginName を参照）
    try {
      localStorage.setItem('loginName', name);
      // 可能なら userId も同じ値で保持（8th Wall 側に uid として渡す用途）
      localStorage.setItem('userId', name);
    } catch (_) {}

    // 既存実装はここで users/<name> を .get() して重複チェックしていたが、
    // ルールで read 禁止だと Permission denied になる可能性がある。
    // 読めない場合は警告ログだけ出して続行する。
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) {
        const snap = await firebase.database().ref('users/' + name).get();
        if (snap.exists()) {
          alert('その名前は既に使用されています');
          return;
        }
      }
    } catch (e) {
      console.warn('[login] duplicate check skipped due to rules:', e && e.message ? e.message : e);
      // 読み取り不可でも体験は続行
    }

    // 初回アンケートへ
    window.location.href = 'initial-survey.html';
  });
});
