// login.js (permission-deniedに強い版)
document.getElementById('startBtn').addEventListener('click', async () => {
  const name = document.getElementById('loginName').value.trim();
  if (!name) return alert('ログイン名を入力してください');

  // ★ まずはローカルに保存してから進める（重複チェックは行わない／行けない環境でも動く）
  try { localStorage.setItem('loginName', name); } catch {}

  // 任意：書ける環境なら作成時刻を書いておく（失敗しても無視）
  try {
    if (window.firebase && firebase.apps && firebase.apps.length) {
      await firebase.database().ref('users/' + name + '/meta/createdAt')
        .set(firebase.database.ServerValue.TIMESTAMP);
    }
  } catch (e) {
    console.warn('[login] skip write meta due to rules:', e?.message || e);
    // ここで止めない。surveyで本保存に再挑戦します。
  }

  // 次の画面へ
  window.location.href = 'initial-survey.html';
});
