// js/survey.js（ES5互換版）
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('surveyForm');
  var btn  = document.getElementById('submitBtn');

  // --- 年齢プルダウンの生成 ---
  var ageSelect = document.getElementById('age');
  if (ageSelect && !ageSelect.getAttribute('data-ready')) {
    // クリアしてプレースホルダーを先頭に
    ageSelect.innerHTML = '<option value="">選択してください</option>';

    function makeOpt(value, label) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      return opt;
    }

    // 18歳以下
    ageSelect.appendChild(makeOpt('18以下', '18歳以下'));

    // 18〜29歳（各年齢）
    for (var y = 18; y <= 29; y++) {
      ageSelect.appendChild(makeOpt(String(y), y + '歳'));
    }

    // 30代 / 40代 / 50代 / 60歳以上
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

  // --- バリデーション ---
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
    var age = getVal('age');
    var affiliation = getVal('affiliation');
    var interest = getVal('interest');
    var consent = isChecked('consent');

    if (!age) { setError('age', '選択してください'); ok = false; } else setError('age', '');
    if (!affiliation) { setError('affiliation', '選択してください'); ok = false; } else setError('affiliation', '');
    if (!interest) { setError('interest', '選択してください'); ok = false; } else setError('interest', '');
    if (!consent) { setError('consent', '同意にチェックしてください'); ok = false; } else setError('consent', '');
    return ok;
  }

  if (!form || !btn) return;

  // フォーム自動遷移の抑止
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
    try {
      name = localStorage.getItem('loginName');
    } catch (e2) { /* ignore */ }
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
    // Firebase が読み込めていない端末でも画面が止まらないようにガード
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) {
        firebase.database().ref('users/' + name + '/info').set(payload)
          .then(function () { window.location.href = 'tutorial.html'; })
          .catch(function (err) {
            console.error(err);
            alert('保存に失敗しました。通信状況とFirebase設定をご確認ください。');
            btn.disabled = false;
          });
      } else {
        // 一時的に保存をスキップして先へ（現地動作優先）
        console.warn('[survey] firebase not ready, skip write and continue');
        window.location.href = 'tutorial.html';
      }
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。通信状況とFirebase設定をご確認ください。');
      btn.disabled = false;
    }
  });
});
