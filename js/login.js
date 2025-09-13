document.getElementById('startBtn').addEventListener('click', () => {
  const name = document.getElementById('loginName').value.trim();
  if (!name) return alert('ログイン名を入力してください');

  const db = firebase.database();
  db.ref('users/' + name).get().then(snapshot => {
    if (snapshot.exists()) {
      alert('その名前は既に使用されています');
    } else {
      localStorage.setItem('loginName', name);
      window.location.href = 'initial-survey.html';
    }
  });
});
