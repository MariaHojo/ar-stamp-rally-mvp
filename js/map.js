/* map.js (整理版)
   - スタンプ帳UIの更新
   - Firebaseからの読取（uid / loginName / url uid / guest をORマージ）
   - localStorageフォールバック
   - ピン: 経路案内 + lastSpotId保存
   - カメラ起動: lastSpotIdに応じて 8th Wall を起動（uid, loginName を付与）
*/

// ======= 設定：各スポットの 8th Wall 起動URL（必ず置き換え） =======
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/', // ←置換
  spot2: 'https://YOUR-8THWALL-URL-2', // ←置換
  spot3: 'https://YOUR-8THWALL-URL-3', // ←置換
};
// ================================================================

/* ---------- ユーティリティ ---------- */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function getUid() {
  try {
    if (window.firebase?.auth && firebase.auth().currentUser) return firebase.auth().currentUser.uid;
  } catch {}
  try { return localStorage.getItem('uid'); } catch { return null; }
}
function getLoginName() {
  try { return localStorage.getItem('loginName') || null; } catch { return null; }
}
function getUrlUid() {
  try { return new URLSearchParams(location.search).get('uid'); } catch { return null; }
}
function saveLastSpotId(spotId) {
  try { localStorage.setItem('lastSpotId', spotId); } catch {}
}
function getLastSpotId() {
  try { return localStorage.getItem('lastSpotId') || 'spot1'; } catch { return 'spot1'; }
}

/* localStorage フォールバック（8th側がローカルだけ保存した場合でも拾う） */
function getLocalStampFallback() {
  const key = s => (localStorage.getItem('stamp_' + s) === 'true') || (localStorage.getItem('stamp_' + s) === true);
  try {
    return {
      spot1: key('spot1'),
      spot2: key('spot2'),
      spot3: key('spot3'),
    };
  } catch { return { spot1:false, spot2:false, spot3:false }; }
}

/* ---------- UI反映 ---------- */
function setStampUI(index, obtained) {
  const img = $('#stamp' + index + 'Img');
  const ph  = $('#stamp' + index + 'Placeholder');
  const st  = $('#stamp' + index + 'Status');
  if (!img || !ph || !st) return;
  if (obtained) {
    img.style.display = 'block';
    ph.style.display  = 'none';
    st.textContent    = '取得済み';
    st.classList.remove('not-obtained'); st.classList.add('obtained');
  } else {
    img.style.display = 'none';
    ph.style.display  = 'block';
    ph.textContent    = '未取得';
    st.textContent    = '未取得';
    st.classList.remove('obtained'); st.classList.add('not-obtained');
  }
}

/* ---------- Firebase 読み取り ---------- */
function getUserKeyCandidates() {
  const list = [];
  const uid = getUid();
  const ln  = getLoginName();
  const qp  = getUrlUid();
  if (uid) list.push(uid);
  if (ln && !list.includes(ln)) list.push(ln);
  if (qp && !list.includes(qp)) list.push(qp);
  if (!list.includes('guest')) list.push('guest');
  return list;
}

async function fetchStampsOnce(key) {
  try {
    if (!(window.firebase && firebase.apps && firebase.apps.length)) return {};
    const snap = await firebase.database().ref('users/' + key + '/stamps').once('value');
    const v = snap.val() || {};
    console.log('[map] fetched', key, v);
    return v;
  } catch (e) {
    console.warn('[map] read failed for', key, e?.message || e);
    return {};
  }
}

/* 外部からも呼べるよう window に公開 */
async function loadAndRenderStamps() {
  // 体感を速くするため、まずローカル値で描画
  const merged = getLocalStampFallback();
  setStampUI(1, !!merged.spot1);
  setStampUI(2, !!merged.spot2);
  setStampUI(3, !!merged.spot3);

  // Firebase 準備待ち（失敗しても続行）
  if (window.firebaseReadyPromise) { try { await window.firebaseReadyPromise; } catch {} }

  if (!(window.firebase && firebase.apps && firebase.apps.length)) {
    console.log('[map] firebase not ready. local fallback only');
    return;
  }

  const keys = getUserKeyCandidates();
  for (const k of keys) {
    const v = await fetchStampsOnce(k);
    merged.spot1 = merged.spot1 || !!v.spot1;
    merged.spot2 = merged.spot2 || !!v.spot2;
    merged.spot3 = merged.spot3 || !!v.spot3;
    if (merged.spot1 && merged.spot2 && merged.spot3) break;
  }

  setStampUI(1, !!merged.spot1);
  setStampUI(2, !!merged.spot2);
  setStampUI(3, !!merged.spot3);
}
window.loadAndRenderStamps = loadAndRenderStamps;

/* ---------- 地図アプリ（ピン押下） ---------- */
function openDirections(lat, lng, label) {
  const ll = `${lat},${lng}`;
  saveLastSpotId(label && /spot\d/i.test(label) ? label.toLowerCase() : getLastSpotId());
  if (/Android/i.test(navigator.userAgent)) {
    location.href = `geo:${ll}?q=${ll}(${label || ''})`;
  } else if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
    location.href = `http://maps.apple.com/?daddr=${ll}&dirflg=w`;
  } else {
    location.href = `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
  }
}

/* ---------- 8th Wall 起動（カメラ起動ボタン） ---------- */
async function openXRForSpot(spotId) {
  if (!spotId) spotId = getLastSpotId() || 'spot1';
  const base = EIGHTHWALL_URLS[spotId];
  if (!base) { alert('このスポットのAR URLが未設定です'); return; }

  if (window.firebaseReadyPromise) { try { await window.firebaseReadyPromise; } catch {} }
  const uid = getUid() || getLoginName() || 'guest';
  const loginName = getLoginName() || '';
  const url = `${base}?spotId=${encodeURIComponent(spotId)}&uid=${encodeURIComponent(uid)}&loginName=${encodeURIComponent(loginName)}`;
  location.href = url;
}

/* ---------- 初期化 ---------- */
function initMapPage() {
  // スタンプ帳の開閉
  const toggleBtn = $('#stampToggle');
  const book = $('#stampBook');
  if (toggleBtn && book) {
    const setClosed = () => { book.style.display = 'none'; toggleBtn.textContent = '▼スタンプ帳'; };
    const setOpen   = () => { book.style.display = 'block'; toggleBtn.textContent = '▲スタンプ帳'; };
    setClosed();
    toggleBtn.addEventListener('click', () => (book.style.display === 'block' ? setClosed() : setOpen()));
  }

  // ピンにイベント付与（経路案内＆lastSpotId保存）
  $all('.pin').forEach(btn => {
    btn.addEventListener('click', () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      const label = btn.dataset.label || btn.dataset.spot || 'spot1';
      saveLastSpotId(btn.dataset.spot || 'spot1');
      openDirections(lat, lng, label);
    });
  });

  // カメラ起動ボタン
  const cam = $('#cameraBtn');
  if (cam) cam.addEventListener('click', () => openXRForSpot(getLastSpotId()));

  // 初回描画
  loadAndRenderStamps();

  // 画面復帰でも再取得（iOS戻るのキャッシュ対策）
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAndRenderStamps(); });
  window.addEventListener('pageshow', () => loadAndRenderStamps());
}

document.addEventListener('DOMContentLoaded', initMapPage);
