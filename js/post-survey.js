// post-survey.js
// バリデーション → Firebase保存。送信後は map.html に戻る。
// オフライン/失敗時は localStorage に一時保存し、オンライン復帰で自動送信を試行。

(function () {
  const BTN_ID = 'submitSurveyBtn';
  const PENDING_KEY = 'postSurvey_pending_payload_v2';

  function initLikertPills() {
    document.querySelectorAll('.likert').forEach(group => {
      group.addEventListener('click', (ev) => {
        const label = ev.target.closest('.radio-pill');
        if (!label) return;
        const input = label.querySelector('input[type="radio"]');
        if (input) {
          input.checked = true;
          group.querySelectorAll('.radio-pill').forEach(l => l.classList.remove('is-active'));
          label.classList.add('is-active');
        }
      });
      group.querySelectorAll('input[type="radio"]').forEach(input => {
        if (input.checked) input.closest('.radio-pill')?.classList.add('is-active');
      });
    });
  }

  const nowTs = () => Date.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const qs = (s, r=document)=> r.querySelector(s);

  function savePendingLocally(payload){ try{ localStorage.setItem(PENDING_KEY, JSON.stringify(payload)); }catch{} }
  function readPendingLocally(){ try{ const v=localStorage.getItem(PENDING_KEY); return v?JSON.parse(v):null; }catch{ return null; } }
  function clearPendingLocally(){ try{ localStorage.removeItem(PENDING_KEY); }catch{} }

  async function ensureAnonSafe() {
    if (typeof window.ensureAnon === 'function') {
      try { const uid = await window.ensureAnon(); if (uid) return uid; } catch {}
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

  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? Number(el.value) : null;
  }
  function setError(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none';
  }
  function scrollToField(fieldId) {
    const box = document.getElementById(fieldId);
    if (box) box.scrollIntoView({behavior:'smooth', block:'center'});
  }

  function collectAndValidate() {
    const ageInput = document.getElementById('age');
    const ageRaw = (ageInput?.value || '').trim();
    const ageOk = /^[0-9]+$/.test(ageRaw) && ageRaw.length > 0;
    setError('ageErr', !ageOk);

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
        age: ageRaw,
        interest_history: q2,
        self_research: q3,
        why_self_research: qs('#q4')?.value || '',
        interest_icu_history: q5,
        why_interest_icu_history: qs('#q6')?.value || '',
        interest_preservation: q7,
        why_interest_preservation: qs('#q8')?.value || '',
        fun: q9,
        why_fun: qs('#q10')?.value || '',
        usability: q11,
        why_usability: qs('#q12')?.value || '',
        free_text: qs('#q13')?.value || '',
      },
      client: {
        ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        lang: (typeof navigator !== 'undefined' ? navigator.language : ''),
        path: (typeof location !== 'undefined' ? location.pathname + location.search : ''),
      },
    };
    return { ok, firstErrorId, payload };
  }

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
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    btn.textContent = busy ? '送信中…' : 'アンケート送信';
    btn.disabled = !!busy;
  }

  function toast(msg){ try{ alert(msg); }catch{} }
  function goMap(){ location.href = 'map.html'; }

  async function onSubmit(ev) {
    ev?.preventDefault?.();

    const { ok, firstErrorId, payload } = collectAndValidate();
    if (!ok) {
      if (firstErrorId) scrollToField(firstErrorId);
      toast('必須項目を入力・選択してください。');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      savePendingLocally(payload);
      toast('オフラインのため、回答を一時保存しました。オンライン時に自動送信します。');
      goMap(); // ★ 送信後は map.html へ
      return;
    }

    setBusy(true);
    const uid = await ensureAnonSafe();
    if (!uid) {
      savePendingLocally(payload);
      setBusy(false);
      toast('ユーザー識別に失敗したため、回答を一時保存しました。後でもう一度お試しください。');
      goMap(); // ★
      return;
    }

    try {
      await writeSurvey(uid, payload);
      setBusy(false);
      toast('ご協力ありがとうございます。回答を送信しました！');
      goMap(); // ★
    } catch (e) {
      console.warn('[post-survey] write failed:', e?.message || e);
      savePendingLocally(payload);
      setBusy(false);
      toast('通信に失敗したため、回答を一時保存しました。オンライン時に自動送信します。');
      goMap(); // ★
    }
  }

  async function boot() {
    initLikertPills();
    for (let i=0;i<2;i++){ try{ await trySyncPending(); break; } catch { await sleep(200); } }
    document.getElementById(BTN_ID)?.addEventListener('click', onSubmit, { passive:false });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
