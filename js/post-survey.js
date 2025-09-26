// post-survey.js
// 指定の設問をスマホ向けUIでバリデーション → Firebase Realtime DB に保存。
// 保存先: users/{uid}/survey （単一オブジェクト）
// オフライン/失敗時は localStorage にペンディング保存し、オンライン復帰時に再送。
// 送信後は complete.html に戻ります（必要なら遷移先を変更可）。

(function () {
  const BTN_ID = 'submitSurveyBtn';
  const FORM_ID = 'surveyForm';
  const PENDING_KEY = 'postSurvey_pending_payload_v2';

  // ---- Likert のタップ操作：選択状態の見た目を更新 ----
  function initLikertPills() {
    document.querySelectorAll('.likert').forEach(group => {
      group.addEventListener('click', (ev) => {
        const label = ev.target.closest('.radio-pill');
        if (!label) return;
        // ラジオをONにして .is-active を更新
        const input = label.querySelector('input[type="radio"]');
        if (input) {
          input.checked = true;
          // 同グループの見た目更新
          group.querySelectorAll('.radio-pill').forEach(l => l.classList.remove('is-active'));
          label.classList.add('is-active');
        }
      });
      // 初期状態の反映
      group.querySelectorAll('input[type="radio"]').forEach(input => {
        if (input.checked) input.closest('.radio-pill')?.classList.add('is-active');
      });
    });
  }

  // ---- 便利関数 ----
  const nowTs = () => Date.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function qSel(sel, root=document){ return root.querySelector(sel); }
  function qSelAll(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function savePendingLocally(payload) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); } catch {}
  }
  function readPendingLocally() {
    try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  }
  function clearPendingLocally() {
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  }

  async function ensureAnonSafe() {
    if (typeof window.ensureAnon === 'function') {
      try { const uid = await window.ensureAnon(); if (uid) return uid; } catch (e) {}
    }
    try {
      if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await auth.signInAnonymously();
      return cred.user && cred.user.uid;
    } catch (e) {
      console.warn('[post-survey] anonymous sign-in failed:', e?.message || e);
      try { return localStorage.getItem('uid') || null; } catch { return null; }
    }
  }

  // ---- 収集 & バリデーション ----
  function getRadioValue(name) {
    const el = qSel(`input[name="${name}"]:checked`);
    return el ? Number(el.value) : null;
  }
  function setError(id, show) {
    const el = qSel(`#${id}`);
    if (el) el.style.display = show ? 'block' : 'none';
  }
  function scrollToField(fieldId) {
    const box = qSel(`#${fieldId}`);
    if (!box) return;
    box.scrollIntoView({behavior:'smooth', block:'center'});
  }

  function collectAndValidate() {
    // 年代（必須：半角数字）
    const ageInput = qSel('#age');
    const ageRaw = (ageInput?.value || '').trim();
    const ageOk = /^[0-9]+$/.test(ageRaw) && ageRaw.length > 0;
    setError('ageErr', !ageOk);

    // 必須ラジオ
    const q2 = getRadioValue('q2'); setError('q2Err', !q2);
    const q3 = getRadioValue('q3'); setError('q3Err', !q3);
    const q5 = getRadioValue('q5'); setError('q5Err', !q5);
    const q7 = getRadioValue('q7'); setError('q7Err', !q7);
    const q9 = getRadioValue('q9'); setError('q9Err', !q9);
    const q11 = getRadioValue('q11'); setError('q11Err', !q11);

    const firstErrorId =
      (!ageOk && 'f-age') ||
      (!q2 && 'f-q2') || (!q3 && 'f-q3') ||
      (!q5 && 'f-q5') || (!q7 && 'f-q7') ||
      (!q9 && 'f-q9') || (!q11 && 'f-q11') || null;

    const ok = ageOk && q2 && q3 && q5 && q7 && q9 && q11;

    const payload = {
      version: 2,
      submittedAt: nowTs(),
      answers: {
        age: ageRaw,                        // 1
        interest_history: q2,               // 2
        self_research: q3,                  // 3
        why_self_research: qSel('#q4')?.value || '',     // 4
        interest_icu_history: q5,           // 5
        why_interest_icu_history: qSel('#q6')?.value || '', // 6
        interest_preservation: q7,          // 7
        why_interest_preservation: qSel('#q8')?.value || '', // 8

        fun: q9,                            // 9
        why_fun: qSel('#q10')?.value || '', // 10
        usability: q11,                     // 11
        why_usability: qSel('#q12')?.value || '', // 12

        free_text: qSel('#q13')?.value || '' // 13
      },
      client: {
        ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        lang: (typeof navigator !== 'undefined' ? navigator.language : ''),
        path: (typeof location !== 'undefined' ? location.pathname + location.search : ''),
      },
    };

    return { ok, firstErrorId, payload };
  }

  // ---- 送信処理 ----
  async function writeSurvey(uid, payload) {
    const db = firebase.database();
    const updates = {};
    updates[`users/${uid}/survey`] = payload;
    updates[`users/${uid}/meta/updatedAt`] = nowTs();
    await db.ref().update(updates);
  }

  async function trySyncPending() {
    const pending = readPendingLocally();
    if (!pending) return;
    const uid = await ensureAnonSafe();
    if (!uid) return;
    try {
      await writeSurvey(uid, pending);
      clearPendingLocally();
      console.log('[post-survey] pending synced');
    } catch (e) {
      console.warn('[post-survey] pending sync failed:', e?.message || e);
    }
  }

  function setBusy(busy) {
    const btn = qSel('#' + BTN_ID);
    if (!btn) return;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    btn.textContent = busy ? '送信中…' : 'アンケート送信';
    btn.disabled = !!busy;
  }

  function toast(msg) { try { alert(msg); } catch {} }

  async function onSubmit(ev) {
    ev?.preventDefault?.();

    // 収集＆検証
    const { ok, firstErrorId, payload } = collectAndValidate();
    if (!ok) {
      if (firstErrorId) scrollToField(firstErrorId);
      toast('必須項目を入力・選択してください。');
      return;
    }

    // オフラインはローカル退避
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      savePendingLocally(payload);
      toast('オフラインのため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
      return;
    }

    setBusy(true);
    const uid = await ensureAnonSafe();
    if (!uid) {
      savePendingLocally(payload);
      setBusy(false);
      toast('ユーザー識別に失敗したため、回答を一時保存しました。後でもう一度お試しください。');
      location.href = 'complete.html';
      return;
    }

    try {
      await writeSurvey(uid, payload);
      setBusy(false);
      toast('ご協力ありがとうございます。回答を送信しました！');
      location.href = 'complete.html';
    } catch (e) {
      console.warn('[post-survey] write failed:', e?.message || e);
      savePendingLocally(payload);
      setBusy(false);
      toast('通信に失敗したため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
    }
  }

  // ---- 起動 ----
  async function boot() {
    initLikertPills();

    // ペンディング再送（軽くリトライ）
    for (let i = 0; i < 2; i++) {
      try { await trySyncPending(); break; } catch { await sleep(200); }
    }

    const btn = qSel('#' + BTN_ID);
    if (btn) btn.addEventListener('click', onSubmit, { passive:false });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
