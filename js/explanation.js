// explanation.js（差し替え版）
// 役割：
//  - ?spotId=spot1..spot6（優先）または <body data-spot="spotN"> から spotId を取得
//  - タイトル/サブタイトル/画像/本文を spotId ごとに出し分け（6件）
//  - 表示時に users/{uid}/stamps/{spotId} = true を保存（匿名UIDは ensureAnon で保証）
//  - uid名前空間付き localStorage（stamp_<uid>_<spotId>）をフォールバック更新
(function () {
  const $ = (s) => document.querySelector(s);

  // --- spotId 判定 ---
  function getQuery(key) {
    try { return new URLSearchParams(location.search).get(key); } catch { return null; }
  }
  function normalizeSpotId(v) {
    const id = String(v || '').trim().toLowerCase();
    return /^spot[1-6]$/.test(id) ? id : 'spot1';
  }
  function getSpotId() {
    const urlId = getQuery('spotId');
    const bodyId = document.body ? document.body.dataset.spot : null;
    return normalizeSpotId(urlId || bodyId || 'spot1');
  }

  // --- uid名前空間付き localStorage key ---
  function getUidSync() {
    try {
      return (firebase && firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid)
           || localStorage.getItem('uid');
    } catch { return null; }
  }
  function lsKey(spot) {
    const uid = getUidSync() || 'nouid';
    return `stamp_${uid}_${spot}`;
  }

  // --- 表示コンテンツ（プレースホルダ：必要に応じて差し替え） ---
  const CONTENT = {
    spot1: { title: 'スポット1の解説', subtitle: 'ここでは〇〇の歴史について学べます', image: 'assets/images/explain-spot1.jpg', bodyHtml: 'ARで見つけた印に注目してみましょう。' },
    spot2: { title: 'スポット2の解説', subtitle: 'この場所は△△で有名です',           image: 'assets/images/explain-spot2.jpg', bodyHtml: '展示のポイントを見逃さないように！' },
    spot3: { title: 'スポット3の解説', subtitle: 'ゴール目前！□□の豆知識もチェック',   image: 'assets/images/explain-spot3.jpg', bodyHtml: '最後まで楽しんでください。' },
    spot4: { title: 'スポット4の解説', subtitle: '（差し替え）',                        image: 'assets/images/explain-spot4.jpg', bodyHtml: '（差し替え）' },
    spot5: { title: 'スポット5の解説', subtitle: '（差し替え）',                        image: 'assets/images/explain-spot5.jpg', bodyHtml: '（差し替え）' },
    spot6: { title: 'スポット6の解説', subtitle: '（差し替え）',                        image: 'assets/images/explain-spot6.jpg', bodyHtml: '（差し替え）' },
  };

  function renderContent(spotId) {
    const c = CONTENT[spotId] || CONTENT.spot1;
    try { document.title = `${c.title} | ARスタンプラリー`; } catch {}
    $('#spotTitle')   && ($('#spotTitle').textContent = c.title);
    $('#spotSubtitle')&& ($('#spotSubtitle').textContent = c.subtitle || '');
    const img = $('#spotImage'); if (img) { img.src = c.image; img.alt = c.title; }
    $('#spotBody')    && ($('#spotBody').innerHTML = c.bodyHtml);
  }

  // --- スタンプ保存（オンライン優先、失敗してもローカル反映） ---
  async function saveStamp(spotId) {
    let uid = null;
    try { uid = await window.ensureAnon(); } catch (e) { console.warn('[explanation] ensureAnon failed:', e); }

    // ローカル先行
    try { localStorage.setItem(lsKey(spotId), 'true'); } catch {}

    // Firebase 反映
    if (!uid) return;
    try {
      const db = firebase.database();
      const updates = {};
      updates[`users/${uid}/stamps/${spotId}`] = true;
      updates[`users/${uid}/meta/updatedAt`]  = Date.now();
      await db.ref().update(updates);
      console.log('[explanation] stamp saved:', uid, spotId);
    } catch (e) {
      console.warn('[explanation] Firebase write failed:', e?.message || e);
    }
  }

  function bindBack() {
    const btn = $('#backToMap');
    // aタグのデフォルト遷移でOK。必要に応じて withV('map.html') に書き換えも可。
    if (btn && typeof window.withV === 'function') {
      try {
        const u = new URL(btn.getAttribute('href'), location.href);
        if (u.pathname.endsWith('/map.html') || u.pathname.endsWith('map.html')) {
          btn.setAttribute('href', window.withV('map.html'));
        }
      } catch {}
    }
  }

  async function boot() {
    const spotId = getSpotId();
    renderContent(spotId);
    await saveStamp(spotId);
    bindBack();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
