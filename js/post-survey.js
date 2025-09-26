// post-survey.js (mobile-first survey)
// 必須: 1) 年代, 2) 歴史に興味, 3) 自分で調べたこと
// 保存先: users/{uid}/survey （単一オブジェクト）
// 失敗・オフライン時はローカル退避 → 復帰時に自動同期

(function () {
  const BTN_ID = 'submitSurveyBtn';
  const FORM_ID = 'surveyForm';
  const PENDING_KEY = 'postSurvey_pending_payload_v2';

  // --------- utils ----------
  const nowTs = () => Date.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.from(document.querySelectorAll(s)); }

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
      console.warn('[survey] anon sign-in fallback failed:', e?.message || e);
      try { return localStorage.getItem('uid') || null; } catch { return null; }
    }
  }

  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? Number(el.value) : null;
  }

  function sanitizeAge(raw) {
    if (!raw) return null;
    const v = String(raw).replace(/[^\d]/g, '').slice(0, 3);
    if (v === '') return null;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n <= 0 || n > 120) return null;
    return n;
  }

  function setBusy(busy) {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    btn.textContent = busy ? '送信中…' : 'アンケート送信';
  }

  function showError(id, on) {
    const box = document.getElementById(id);
    if (!box) return;
    if (on) box.classList.add('has-error');
    else box.classList.remove('has-error');
  }

  function firstErrorScroll() {
    const first = document.querySelector('.has-error');
    if (!first) return;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function buildPayload() {
    const ageRaw = $('#age')?.value ?? '';
    const age = sanitizeAge(ageRaw);

    const payload = {
      version: 2,
      submittedAt: nowTs(),

      // 必須
      age, // number | null
      hist_interest: getRadioValue('hist_interest'),     // 1-5 | null
      self_research: getRadioValue('self_research'),     // 1-5 | null

      // 任意
      why_self_research: $('#why_self_research')?.value?.trim() || null,

      icu_interest: getRadioValue('icu_interest'),       // 1-5 | null
      why_icu_interest: $('#why_icu_interest')?.value?.trim() || null,

      preserve_interest: getRadioValue('preserve_interest'), // 1-5 | null
      why_preserve_interest: $('#why_preserve_interest')?.value?.trim() || null,

      ar_fun: getRadioValue('ar_fun'),                   // 1-5 | null
      why_ar_fun: $('#why_ar_fun')?.value?.trim() || null,

      ar_usability: getRadioValue('ar_usability'),       // 1-5 | null
      why_ar_usability: $('#why_ar_usability')?.value?.trim() || null,

      free_text: $('#free_text')?.value?.trim() || null,

      client: {
        ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        lang: (typeof navigator !== 'undefined' ? navigator.language : ''),
        path: (typeof location !== 'undefined' ? location.pathname + location.search : ''),
        online: (typeof navigator !== 'undefined' ? navigator.onLine : undefined),
      },
    };
    return payload;
  }

  function validate(payload) {
    // 必須: age, hist_interest, self_research
    let ok = true;

    const ageOk = typeof payload.age === 'number';
    showError('q-age', !ageOk);
    ok = ok && ageOk;

    const hOk = typeof payload.hist_interest === 'number';
    showError('q-histInterest', !hOk);
    ok = ok && hOk;

    const sOk = typeof payload.self_research === 'number';
    showError('q-selfResearch', !sOk);
    ok = ok && sOk;

    if (!ok) firstErrorScroll();
    return ok;
  }

  async function writeSurvey(uid, payload) {
    const db = firebase.database();
    const updates = {};
    updates[`users/${uid}/survey`] = payload; // 単一回答として保存
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
      console.log('[survey] pending synced');
    } catch (e) {
      console.warn('[survey] pending sync failed:', e?.message || e);
    }
  }

  function notify(msg) {
    try { alert(msg); } catch {}
  }

  async function onSubmit(ev) {
    ev?.preventDefault?.();
    setBusy(true);

    const payload = buildPayload();
    if (!validate(payload)) {
      setBusy(false);
      return;
    }

    // オフライン時はローカル退避
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      savePendingLocally(payload);
      setBusy(false);
      notify('オフラインのため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
      return;
    }

    // UID確保 → 書き込み
    const uid = await ensureAnonSafe();
    if (!uid) {
      savePendingLocally(payload);
      setBusy(false);
      notify('ユーザー識別に失敗したため、回答を一時保存しました。後ほど自動送信を試みます。');
      location.href = 'complete.html';
      return;
    }

    try {
      await writeSurvey(uid, payload);
      setBusy(false);
      notify('ご協力ありがとうございます。回答を送信しました！');
      // スペシャルコンテンツ導線を設ける場合はここで遷移先を変更可
      location.href = 'complete.html';
    } catch (e) {
      console.warn('[survey] write failed:', e?.message || e);
      savePendingLocally(payload);
      setBusy(false);
      notify('通信に失敗したため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
    }
  }

  async function boot() {
    // 年代入力を数字のみに補正
    const ageEl = $('#age');
    if (ageEl) {
      ageEl.addEventListener('input', () => {
        const cleaned = ageEl.value.replace(/[^\d]/g, '').slice(0,3);
        if (ageEl.value !== cleaned) ageEl.value = cleaned;
      }, { passive: true });
    }

    // ペンディングの自動再送（軽くリトライ）
    for (let i = 0; i < 2; i++) {
      await trySyncPending();
      await sleep(200);
    }

    const btn = document.getElementById(BTN_ID);
    if (btn) btn.addEventListener('click', onSubmit, { passive: false });

    // オンライン復帰時に同期
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { trySyncPending(); });
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
