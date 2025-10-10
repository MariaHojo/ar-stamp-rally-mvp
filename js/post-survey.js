// post-survey.js (v3)
// 新設計アンケート：必須/任意の範囲を更新。保存スキーマ version=3。
// 送信後は map.html へ遷移。オフライン時は一時保存→オンライン時に自動送信を試行。

(function () {
  const BTN_ID = 'submitSurveyBtn';
  const PENDING_KEY = 'postSurvey_pending_payload_v3';

  /* ===== UI ヘルパ ===== */
  function initLikertPills() {
    document.querySelectorAll('.likert, .yn').forEach(group => {
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

  /* ===== Firebase 匿名サインイン ===== */
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
    if (!el) return null;
    const v = el.value;
    // 1..5 は数値で返す。yes/no はそのまま文字列で返す。
    return /^[0-9]+$/.test(v) ? Number(v) : v;
  }

  function setError(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'block' : 'none';
  }
  function scrollToField(fieldId) {
    const box = document.getElementById(fieldId);
    if (box) box.scrollIntoView({behavior:'smooth', block:'center'});
  }

  /* ===== 収集 & バリデーション ===== */
  function collectAndValidate() {
    // 年代（必須）
    const ageInput = document.getElementById('age');
    const ageRaw = (ageInput?.value || '').trim();
    const ageOk = /^[0-9]+$/.test(ageRaw) && ageRaw.length > 0;
    setError('ageErr', !ageOk);

    // 必須 5段階
    const hist_interest        = getRadioValue('hist_interest');        setError('histInterestErr', !hist_interest);
    const preservation_interest= getRadioValue('preservation_interest');setError('presInterestErr', !preservation_interest);
    const self_research        = getRadioValue('self_research');        setError('selfResearchErr', !self_research);
    const hist_change          = getRadioValue('hist_change');          setError('histChangeErr', !hist_change);
    const preservation_change  = getRadioValue('preservation_change');  setError('presChangeErr', !preservation_change);

    const fun                  = getRadioValue('fun');                   setError('funErr', !fun);
    const usability            = getRadioValue('usability');             setError('usabilityErr', !usability);

    // 任意
    const panel_awareness   = getRadioValue('panel_awareness');
    const panel_interest    = getRadioValue('panel_interest');
    const archives_awareness= getRadioValue('archives_awareness');
    const archives_visited  = getRadioValue('archives_visited'); // yes/no or null
    const archives_interest = getRadioValue('archives_interest');

    // 必須のどれか未入力ならスクロール先を決定
    const firstErrorId =
      (!ageOk && 'f-age') ||
      (!hist_interest && 'f-histInterest') ||
      (!preservation_interest && 'f-presInterest') ||
      (!self_research && 'f-selfResearch') ||
      (!hist_change && 'f-histChange') ||
      (!preservation_change && 'f-presChange') ||
      (!fun && 'f-fun') ||
      (!usability && 'f-usability') || null;

    const ok = ageOk && hist_interest && preservation_interest && self_research &&
               hist_change && preservation_change && fun && usability;

    const payload = {
      version: 3,
      submittedAt: nowTs(),
      answers: {
        // 基本
        age: ageRaw,
        hist_interest,
        preservation_interest,
        self_research,
        hist_change,
        preservation_change,
        // ICU 在学生・教職員向け（任意）
        panel_awareness,
        panel_interest,
        archives_awareness,
        archives_visited,     // 'yes' | 'no' | null
        archives_interest,
        // アプリ
        fun,
        usability,
        // 自由記述
        free_text: qs('#free_text')?.value || '',
      },
      client: {
        ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        lang: (typeof navigator !== 'undefined' ? navigator.language : ''),
        path: (typeof location !== 'undefined' ? location.pathname + location.search : ''),
      },
    };
    return { ok, firstErrorId, payload };
  }

  /* ===== 保存 ===== */
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

  /* ===== 送信 ===== */
  async function onSubmit(ev) {
    ev?.preventDefault?.();

    const { ok, firstErrorId, payload } = collectAndValidate();
    if (!ok) {
      if (firstErrorId) scrollToField(firstErrorId);
      toast('必須項目を入力・選択してください。');
      return;
    }

    // オフライン時はローカル退避
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      savePendingLocally(payload);
      toast('オフラインのため、回答を一時保存しました。オンライン時に自動送信します。');
      goMap();
      return;
    }

    setBusy(true);
    const uid = await ensureAnonSafe();
    if (!uid) {
      savePendingLocally(payload);
      setBusy(false);
      toast('ユーザー識別に失敗したため、回答を一時保存しました。後でもう一度お試しください。');
      goMap();
      return;
    }

    try {
      await writeSurvey(uid, payload);
      setBusy(false);
      toast('ご協力ありがとうございます。回答を送信しました！');
      goMap();
    } catch (e) {
      console.warn('[post-survey] write failed:', e?.message || e);
      savePendingLocally(payload);
      setBusy(false);
      toast('通信に失敗したため、回答を一時保存しました。オンライン時に自動送信します。');
      goMap();
    }
  }

  async function boot() {
    initLikertPills();
    // ペンディング同期を軽く試す
    for (let i=0;i<2;i++){ try{ await trySyncPending(); break; } catch { await sleep(200); } }
    document.getElementById(BTN_ID)?.addEventListener('click', onSubmit, { passive:false });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
