// js/survey.js — 初回アンケート送信。書き込み拒否でもローカル退避して先へ進む
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('surveyForm');
  var btn  = document.getElementById('submitBtn');

  // --- 年齢プルダウン（既存のロジックそのまま） ---
  var ageSelect = document.getElementById('age');
  if (ageSelect && !ageSelect.getAttribute('data-ready')) {
    ageSelect.innerHTML = '<option value="">選択してください</option>';
    function makeOpt(value, label) {
      var opt = document.createElement('option');
      opt.value = value; opt.textContent = label; return opt;
    }
    ageSelect.appendChild(makeOpt('17以下', '17歳以下'));
    for (var y = 18; y <= 29; y++) ageSelect.appendChild(makeOpt(String(y), y + '歳'));
    ageSelect.appendChild(makeOpt('30代', '30代'));
    ageSelect.appendChild(makeOpt('40代', '40代'));
    ageSelect.appendChild(makeOpt('50代', '50代'));
    ageSelect.appendChild(makeOpt('60以上', '60歳以上'));
    ageSelect.setAttribute('data-ready', '1');
  }

  // --- エラー表示 ---
  function setError(id, msg) {
    var el = document.getElementById('err-' + id);
    if (el) el.textContent = msg || '';
  }

  // --- 値取得 & バリデーション ---
  function getVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value).trim() : '';
  }
  function isChecked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }
  function validate() {
    var ok = true;
    if (!getVal('age'))         { setError('age', '選択してください'); ok = false; } else setError('age','');
    if (!getVal('affiliation')) { setError('affiliation', '選択してください'); ok = false; } else setError('affiliation','');
    if (!getVal('interest'))    { setError('interest', '選択してください'); ok = false; } else setError('interest','');
    if (!isChecked('consent'))  { setError('consent', '同意にチェックしてください'); ok = false; } else setError('consent','');
    return ok;
  }

  if (!form || !btn) return;
  form.setAttribute('action', '');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      // 最初のエラー位置へスクロール
      var firstErr = null;
      var ids = ['age','affiliation','interest','consent','schoolDivision','major'];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById('err-' + ids[i]);
        if (el && el.textContent) { firstErr = el; break; }
      }
      if (firstErr && firstErr.scrollIntoView) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    var name = null;
    try { name = localStorage.getItem('loginName'); } catch(_) {}
    if (!name) { alert('ログイン情報がありません。最初からやり直してください。'); return; }

    var payload = {
      age: getVal('age'),
      affiliation: getVal('affiliation'),
      schoolDivision: (function(){ var v = getVal('schoolDivision'); return v || null; })(),
      major: (function(){ var v = getVal('major'); return v || null; })(),
      interest: getVal('interest'),
      consent: true,
      submittedAt: Date.now()
    };

    btn.disabled = true;

    // 書ければDBへ。拒否されてもローカル退避して続行。
    (async function submit() {
      try {
        if (window.firebase && firebase.apps && firebase.apps.length) {
          await firebase.database().ref('users/' + name + '/info').set(payload);
          window.location.href = 'tutorial.html';
          return;
        } else {
          console.warn('[survey] firebase not ready, skip write');
        }
      } catch (err) {
        console.warn('[survey] write failed, keep locally and continue:', err && err.message ? err.message : err);
        try { localStorage.setItem('survey_info_' + name, JSON.stringify(payload)); } catch(_){}
      }
      // いずれの場合も体験を止めない
      window.location.href = 'tutorial.html';
    })();
  });
});
