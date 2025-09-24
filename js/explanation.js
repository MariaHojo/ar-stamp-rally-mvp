/* explanation.js（整理版）
   - URLの spotId / uid / loginName を取得
   - スポットの見出し・画像・テキストを spotId に応じて差し替え
   - Firebaseから stamps を読み、現在スポットの取得状況と全取得を判定
   - ボタン：マップへ戻る／次スポットへ／全取得時はコンプリートへ
   - /events に簡易ログ（任意）
*/

(function () {
  const $ = (s) => document.querySelector(s);

  // -------- URL / localStorage helpers --------
  function getQuery(key){ try{ return new URLSearchParams(location.search).get(key) }catch{ return null } }
  function getUid(){
    try {
      if (window.firebase?.auth?.currentUser) return firebase.auth().currentUser.uid;
    } catch {}
    try { return localStorage.getItem('uid') } catch { return null }
  }
  function getLoginName(){ try { return localStorage.getItem('loginName') || '' } catch { return '' } }

  // -------- spot 定義（タイトル/画像/本文）必要に応じて編集 --------
  const SPOT_META = {
    spot1: {
      title: 'スポット1：〇〇記念碑',
      img: 'assets/images/stamp01.png',
      html: `<p>スポット1の解説テキストをここに掲載します。写真の見どころ、歴史的背景など。</p>`
    },
    spot2: {
      title: 'スポット2：□□門',
      img: 'assets/images/stamp02.png',
      html: `<p>スポット2の解説テキストをここに掲載します。制作年や関係者、豆知識など。</p>`
    },
    spot3: {
      title: 'スポット3：△△ホール',
      img: 'assets/images/stamp03.png',
      html: `<p>スポット3の解説テキストをここに掲載します。建築様式やイベントの歴史など。</p>`
    }
  };

  // -------- UI反映 --------
  function setSpotUI(spotId) {
    const meta = SPOT_META[spotId] || SPOT_META.spot1;
    $('#spotTitle').textContent = meta.title;
    $('#spotBadge').textContent = spotId;
    const img = $('#spotImage');
    img.src = meta.img; img.alt = meta.title;
    $('#spotContent').innerHTML = meta.html;
  }
  function setStampStatus(obtained) {
    const el = $('#stampStatus');
    el.textContent = obtained ? '取得済み' : '未取得';
    el.classList.toggle('ok', obtained);
    el.classList.toggle('ng', !obtained);
  }

  // -------- Firebase helpers --------
  async function ensureFirebaseReady() {
    if (window.firebaseReadyPromise) {
      try { await window.firebaseReadyPromise; } catch {}
    }
    return (window.firebase && firebase.apps && firebase.apps.length) ? firebase : null;
  }
  async function logEvent(type, meta={}) {
    const fb = await ensureFirebaseReady(); if (!fb) return;
    try {
      const uid = getUid() || 'guest';
      const ref = firebase.database().ref('events').push();
      await ref.set({
        uid, type, ...meta,
        ts: (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now(),
        ua: navigator.userAgent
      });
    } catch {}
  }
  async function readMergedStamps() {
    const fb = await ensureFirebaseReady(); if (!fb) return {};
    const keys = [];
    const k1 = getUid();        if (k1) keys.push(k1);
    const k2 = getLoginName();  if (k2 && !keys.includes(k2)) keys.push(k2);
    const k3 = getQuery('uid'); if (k3 && !keys.includes(k3)) keys.push(k3);
    if (!keys.includes('guest')) keys.push('guest');

    const merged = {spot1:false, spot2:false, spot3:false};
    for (const k of keys) {
      try {
        const snap = await firebase.database().ref('users/'+k+'/stamps').once('value');
        const v = snap.val() || {};
        merged.spot1 = merged.spot1 || !!v.spot1;
        merged.spot2 = merged.spot2 || !!v.spot2;
        merged.spot3 = merged.spot3 || !!v.spot3;
        if (merged.spot1 && merged.spot2 && merged.spot3) break;
      } catch (e) {
        // 読めないキーはスキップ
      }
    }
    return merged;
  }

  // -------- ナビゲーション --------
  function nextSpot(spotId) {
    const order = ['spot1','spot2','spot3'];
    const idx = Math.max(0, order.indexOf(spotId));
    return order[(idx + 1) % order.length];
  }

  // -------- 初期化 --------
  async function init() {
    const spotId = getQuery('spotId') || localStorage.getItem('lastSpotId') || 'spot1';
    setSpotUI(spotId);

    // 画面オープンをログ
    logEvent('explanation_open', { spotId }).catch(()=>{});

    // 取得状況を表示
    const stamps = await readMergedStamps();
    setStampStatus(!!stamps[spotId]);

    // 全取得なら「コンプリートへ」を出す
    const allDone = stamps.spot1 && stamps.spot2 && stamps.spot3;
    const completeBtn = $('#completeBtn');
    if (allDone) {
      completeBtn.style.display = 'inline-block';
      completeBtn.onclick = () => {
        logEvent('go_complete', {spotId}).catch(()=>{});
        location.href = 'complete.html';
      };
    } else {
      completeBtn.style.display = 'none';
    }

    // 「マップへ戻る」
    $('#backMapBtn').onclick = () => {
      logEvent('back_map_from_explanation', {spotId}).catch(()=>{});
      location.href = 'map.html';
    };

    // 「次のスポットへ」＝ マップ経由で案内（lastSpotId を更新して map で起動する流れでもOK）
    $('#nextSpotBtn').onclick = () => {
      const ns = nextSpot(spotId);
      try { localStorage.setItem('lastSpotId', ns); } catch {}
      logEvent('go_next_spot', {from: spotId, to: ns}).catch(()=>{});
      location.href = 'map.html';
    };

    // iOS 戻るキャッシュ対策（戻ってきたら最新表示に）
    window.addEventListener('pageshow', async () => {
      const s2 = await readMergedStamps();
      setStampStatus(!!s2[spotId]);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
