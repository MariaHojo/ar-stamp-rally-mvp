// js/survey.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('surveyForm');
  const btn = document.getElementById('submitBtn');

  // 年齢プルダウンの生成（18歳以下 / 18〜29歳（各年齢）/ 30代 / 40代 / 50代 / 60歳以上）
  const ageSelect = document.getElementById('age');
  if (ageSelect && !ageSelect.dataset.ready) {
    // 先頭はプレースホルダ（HTML側にもあるが念のためクリーン）
    ageSelect.innerHTML = '<option value="">選択してください</option>';

    const makeOpt = (value, label) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      return opt;
    };

    // 18歳以下
    ageSelect.appendChild(makeOpt('18以下', '18歳以下'));

    // 18〜29歳（各年齢）
    for (let y = 18; y <= 29; y++) {
      ageSelect.appendChild(makeOpt(String(y), `${y}歳`));
    }

    // 30代 / 40代 / 50代 / 60歳以上
    ageSelect.appendChild(makeOpt('30代', '30代'));
    ageSelect.appendChild(makeOpt('40代', '40代'));
    ageSelect.appendChild(makeOpt('50代', '50代'));
    ageSelect.appendChild(makeOpt('60以上', '60歳以上'));

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
      window.location.href = 'tutorial.html'; // 明示的に遷移
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。通信状況とFirebase設定をご確認ください。');
      btn.disabled = false;
    }
  });
});
