// js/survey.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('surveyForm');
  const btn = document.getElementById('submitBtn');

  // 年齢プルダウンの生成（必要なければ削ってOK）
  const ageSelect = document.getElementById('age');
  if (ageSelect && !ageSelect.dataset.ready) {
    const opt15 = document.createElement('option');
    opt15.value = '15以下'; opt15.textContent = '15歳以下';
    ageSelect.appendChild(opt15);
    for (let y = 16; y <= 59; y++) {
      const opt = document.createElement('option');
      opt.value = String(y); opt.textContent = `${y}歳`;
      ageSelect.appendChild(opt);
    }
    const opt60 = document.createElement('option');
    opt60.value = '60以上'; opt60.textContent = '60歳以上';
    ageSelect.appendChild(opt60);
    ageSelect.dataset.ready = '1';
  }

  const setError = (id, msg) => {
    const el = document.getElementById(`err-${id}`);
    if (el) el.textContent = msg || '';
  };

  const validate = () => {
    let ok = true;
    const age = (document.getElementById('age')?.value || '').trim();
    const affiliation = (document.getElementById('affiliation')?.value || '').trim();
    const interest = (document.getElementById('interest')?.value || '').trim();
    const consent = document.getElementById('consent')?.checked;

    if (!age) { setError('age', '選択してください'); ok = false; } else setError('age', '');
    if (!affiliation) { setError('affiliation', '選択してください'); ok = false; } else setError('affiliation', '');
    if (!interest) { setError('interest', '選択してください'); ok = false; } else setError('interest', '');
    if (!consent) { setError('consent', '同意にチェックしてください'); ok = false; } else setError('consent', '');
    return ok;
  };

  if (!form || !btn) return;

  // フォームが勝手に遷移しないよう action は未指定 or 空に
  form.setAttribute('action', '');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) {
      const firstErr = document.querySelector('.error:not(:empty)');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const name = localStorage.getItem('loginName');
    if (!name) { alert('ログイン情報がありません。最初からやり直してください。'); return; }

    const payload = {
      age: document.getElementById('age').value.trim(),
      affiliation: document.getElementById('affiliation').value.trim(),
      schoolDivision: (document.getElementById('schoolDivision')?.value || '').trim() || null,
      major: (document.getElementById('major')?.value || '').trim() || null,
      interest: document.getElementById('interest').value.trim(),
      consent: true,
      submittedAt: Date.now()
    };

    btn.disabled = true;
    try {
    await firebase.database().ref(`users/${name}/info`).set(payload);
    window.location.href = 'tutorial.html'; // ★ここで明示的に遷移
  } catch (err) {
      console.error(err);
      alert('保存に失敗しました。通信状況とFirebase設定をご確認ください。');
      btn.disabled = false;
    }
  });
});
