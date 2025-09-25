// js/explanation.js（explanation.htmlのIDに合わせて修正済み）
// 役割：
//  - ?spotId=spot1（優先）または <body data-spot="spot1"> から spotId を取得
//  - タイトル/サブタイトル/画像/本文を spotId ごとに出し分け
//  - 表示時に users/{uid}/stamps/{spotId} = true を保存（uidは firebase.js の ensureAnon で匿名発行）
//  - uid名前空間付き localStorage をフォールバックとして更新

(function () {
  function $(s) { return document.querySelector(s); }

  // --- spotId 判定 ---
  function getQuery(key) {
    try { return new URLSearchParams(location.search).get(key); } catch { return null; }
  }
  function normalizeSpotId(v) {
    const id = String(v || '').trim().toLowerCase();
    return /^spot[1-3]$/.test(id) ? id : 'spot1';
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

  // --- 表示コンテンツ（必要に応じて編集） ---
  const CONTENT = {
    spot1: {
      title: 'スポット1の解説',
      subtitle: 'ここでは〇〇の歴史について学べます',
      image: 'assets/images/explain-spot1.jpg',
      bodyHtml: 'ARで見つけた印に注目してみましょう。'
    },
    spot2: {
      title: 'スポット2の解説',
      subtitle: 'この場所は△△で有名です',
      image: 'assets/images/explain-spot2.jpg',
      bodyHtml: '展示のポイントを見逃さないように！'
    },
    spot3: {
      title: 'スポット3の解説',
      subtitle: 'ゴール目前！□□の豆知識もチェック',
      image: 'assets/images/explain-spot3.jpg',
      bodyHtml: '最後まで楽しんでください。'
    }
  };

  function renderContent(spotId) {
    const c = CONTENT[spotId] || CONTENT.spot1;

    // <title> 更新（任意）
    try { document.title = `${c.title} | ARスタンプラリー`; } catch {}

    // explanation.html の要素IDに合わせる
    const ttl  = $('#spotTitle');
    const sub  = $('#spotSubtitle');
    const img  = $('#spotImage');
    const body = $('#spotBody');

    if (ttl) ttl.textContent = c.title;
    if (sub) sub.textContent = c.subtitle || '';
    if (img) { img.src = c.image; img.alt = c.title; }
    if (body) body.innerHTML = c.bodyHtml;
  }

  // --- スタンプ保存（オンライン優先、失敗してもローカル反映） ---
  async function saveStamp(spotId) {
    let uid = null;
    // 匿名サインインを保証（firebase.js で window.ensureAnon を定義済み）
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

  // 戻るリンクは <a href="map.html" id="backToMap"> なので追加処理不要
  function bindBack() {
    const btn = $('#backToMap');
    if (!btn) return;
    // aタグのデフォルト遷移でOK。buttonに変える場合のみ location.href を設定。
  }

  async function boot() {
    const spotId = getSpotId();
    renderContent(spotId);
    await saveStamp(spotId);
    bindBack();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
