/* js/explanation.js （差し替え版）
 * 役割：
 *  - ?spotId=spot1..spot6 を取得し、スポット別に表示内容（タイトル/写真/スタンプ）を出し分け
 *  - 表示時に users/{uid}/stamps/{spotId} = true を保存（firebase.js の ensureAnon が前提）
 *  - uid 名前空間付き localStorage をフォールバックとして更新
 */

(function () {
  const $  = (s) => document.querySelector(s);

  // ===== クエリ & 正規化 =====
  function getQuery(key){
    try { return new URLSearchParams(location.search).get(key) } catch { return null }
  }
  function normalizeSpotId(v){
    const id = String(v || '').trim().toLowerCase();
    return /^spot[1-6]$/.test(id) ? id : 'spot1';   // ← 1〜6に拡張
  }
  function getSpotId(){
    const urlId = getQuery('spotId');
    const bodyId= document.body ? document.body.dataset.spot : null;
    return normalizeSpotId(urlId || bodyId || 'spot1');
  }

  // ===== uid 名前空間付き LocalStorage =====
  function getUidSync(){
    try {
      return (firebase?.auth?.().currentUser?.uid) || localStorage.getItem('uid');
    } catch {
      return null;
    }
  }
  function lsKey(spot){ const uid = getUidSync() || 'nouid'; return `stamp_${uid}_${spot}` }

  // ===== スポット定義（名称 / 写真 / スタンプ画像）=====
  // 画像パスは要件どおり：
  //   スタンプ: assets/images/stamps/stampXX.png
  //   写真   : assets/images/Photos_thesis/<各スポットごとのファイル名>
  const SPOT_LABELS = {
    spot1: '本館173前',
    spot2: 'トロイヤー記念館（T館）前',
    spot3: '学生食堂（ガッキ）前',
    spot4: 'チャペル前',
    spot5: '体育館（Pec-A）前',
    spot6: '本館307前',
  };
  const SPOT_PHOTOS = {
    // 実ファイルに合わせて後で置換してください（例はspot1のみ例示）
    spot1: 'assets/images/Photos_thesis/本館正面_1950年代.jpg',
    spot2: 'assets/images/Photos_thesis/spot2.jpg',
    spot3: 'assets/images/Photos_thesis/spot3.jpg',
    spot4: 'assets/images/Photos_thesis/spot4.jpg',
    spot5: 'assets/images/Photos_thesis/spot5.jpg',
    spot6: 'assets/images/Photos_thesis/spot6.jpg',
  };
  function toNN(spotId){ return String(spotId.replace('spot','')).padStart(2,'0') }
  function stampSrc(spotId){ return `assets/images/stamps/stamp${toNN(spotId)}.png` }

  // ===== 表示の更新 =====
  function renderContent(spotId){
    const title = SPOT_LABELS[spotId] || 'スポット';
    const ttl   = $('#spotTitle');
    const imgS  = $('#gotStampImage');
    const small = $('#stampNote');
    const photo = $('#spotPhoto');

    if (ttl)   ttl.textContent = title;
    if (imgS)  { imgS.src = stampSrc(spotId); imgS.alt = `${title} のスタンプ`; }
    if (small) small.textContent = 'スタンプをゲットしました！';
    if (photo) {
      const p = SPOT_PHOTOS[spotId] || '';
      if (p) { photo.src = p; photo.alt = `${title} の写真`; }
    }
  }

  // ===== スタンプ保存（オンライン優先 / ローカル先行）=====
  async function saveStamp(spotId){
    let uid = null;
    try { uid = await window.ensureAnon?.() } catch(e){ console.warn('[explanation] ensureAnon failed:', e) }

    // ローカル先行
    try { localStorage.setItem(lsKey(spotId), 'true') } catch {}

    // Firebaseへ
    if (!uid) return;
    try {
      const db = firebase.database();
      const updates = {};
      updates[`users/${uid}/stamps/${spotId}`]   = true;
      updates[`users/${uid}/meta/updatedAt`]     = Date.now();
      await db.ref().update(updates);
      console.log('[explanation] stamp saved:', uid, spotId);
    } catch(e){
      console.warn('[explanation] Firebase write failed:', e?.message || e);
    }
  }

  // ===== 答え表示ボタン =====
  function bindAnswer(){
    const btn = $('#showAnswerBtn');
    const ans = $('#answerBlock');
    if (!btn || !ans) return;
    btn.addEventListener('click', () => {
      ans.style.display = 'block';
      btn.disabled = true;
    });
  }

  async function boot(){
    const spotId = getSpotId();
    renderContent(spotId);
    await saveStamp(spotId);
    bindAnswer();
  }

  document.addEventListener('DOMContentLoaded', boot);
}());
