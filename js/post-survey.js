// post-survey.js
// 最小実装：送信ボタン押下で匿名UIDの配下に回答オブジェクトを保存します。
// - 保存先: users/{uid}/survey （単一オブジェクト想定）
// - 失敗時は localStorage に一時保存し、次回起動時/オンライン復帰時に自動同期を試みます。
// - 完了後は complete.html に戻ります（必要なら 'map.html' 等に変更してください）。

(function () {
  const BTN_ID = 'submitSurveyBtn';
  const PENDING_KEY = 'postSurvey_pending_payload';

  // --- ユーティリティ ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowTs = () => Date.now();

  function savePendingLocally(payload) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    } catch {}
  }

  function readPendingLocally() {
    try {
      const v = localStorage.getItem(PENDING_KEY);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }

  function clearPendingLocally() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  async function ensureAnonSafe() {
    // firebase.js に window.ensureAnon がある想定。なければフォールバック。
    if (typeof window.ensureAnon === 'function') {
      try {
        const uid = await window.ensureAnon();
        if (uid) return uid;
      } catch (e) {
        console.warn('[post-survey] ensureAnon failed, fallback:', e);
      }
    }

    // フォールバック（v8 API想定）
    try {
      if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await auth.signInAnonymously();
      return cred.user && cred.user.uid;
    } catch (e) {
      console.warn('[post-survey] anonymous sign-in fallback failed:', e?.message || e);
      // それでもダメなら localStorage の uid を参照（ない場合は null）
      try {
        return localStorage.getItem('uid') || null;
      } catch {
        return null;
      }
    }
  }

  function buildPayload() {
    // いまは設問が未定のため、プレースホルダーの回答のみ保存。
    // 実際の設問を追加したら、このオブジェクトに項目を追記してください。
    const payload = {
      version: 1,
      submittedAt: nowTs(),
      // ここに実際の回答項目を追加（例）
      // q1_enjoyment: null,         // Likert 1-5
      // q2_history_interest: null,  // Likert 1-5
      // q3_free_text: "",           // 自由記述
      client: {
        ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        lang: (typeof navigator !== 'undefined' ? navigator.language : ''),
        path: (typeof location !== 'undefined' ? location.pathname + location.search : ''),
      },
    };
    return payload;
  }

  async function writeSurvey(uid, payload) {
    const db = firebase.database();
    const updates = {};
    // 単一回答オブジェクトとして保存（複数回答にしたい場合は push() も可）
    updates[`users/${uid}/survey`] = payload;
    updates[`users/${uid}/meta/updatedAt`] = nowTs();
    await db.ref().update(updates);
  }

  async function trySyncPending() {
    const pending = readPendingLocally();
    if (!pending) return;

    const uid = await ensureAnonSafe();
    if (!uid) return; // 次回へ

    try {
      await writeSurvey(uid, pending);
      clearPendingLocally();
      console.log('[post-survey] pending survey synced');
    } catch (e) {
      console.warn('[post-survey] pending sync failed:', e?.message || e);
    }
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) btn.textContent = '送信中…';
    else btn.textContent = 'アンケート送信';
  }

  function notify(kind, msg) {
    // 最小実装：alert。必要に応じてトーストに差し替え可。
    try {
      alert(msg);
    } catch {}
  }

  async function onSubmit(ev) {
    ev?.preventDefault?.();

    const btn = document.getElementById(BTN_ID);
    setBusy(btn, true);

    // 送信ペイロード作成
    const payload = buildPayload();

    // オフラインは即ローカル退避
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      savePendingLocally(payload);
      setBusy(btn, false);
      notify('ok', 'オフラインのため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
      return;
    }

    // オンライン時：匿名UIDを確保してDBへ保存
    let uid = await ensureAnonSafe();
    if (!uid) {
      // UIDが確保できない場合はローカル保存に切り替え
      savePendingLocally(payload);
      setBusy(btn, false);
      notify('ok', 'ユーザー識別に失敗したため、回答を一時保存しました。後でもう一度お試しください。');
      location.href = 'complete.html';
      return;
    }

    try {
      await writeSurvey(uid, payload);
      setBusy(btn, false);
      notify('ok', 'ご協力ありがとうございます。回答を送信しました！');
      // 必要に応じて「スペシャルコンテンツ」へ遷移する導線に変更可能
      location.href = 'complete.html';
    } catch (e) {
      console.warn('[post-survey] write failed:', e?.message || e);
      // 失敗時はローカル退避
      savePendingLocally(payload);
      setBusy(btn, false);
      notify('warn', '通信に失敗したため、回答を一時保存しました。オンライン時に自動送信します。');
      location.href = 'complete.html';
    }
  }

  async function boot() {
    // ペンディング分の自動再送（数回リトライ）
    for (let i = 0; i < 2; i++) {
      try {
        await trySyncPending();
        break;
      } catch {
        await sleep(300);
      }
    }

    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.addEventListener('click', onSubmit, { passive: false });
    } else {
      console.warn(`[post-survey] #${BTN_ID} が見つかりませんでした`);
    }

    // オンライン復帰時にも同期を試みる
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        trySyncPending();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
