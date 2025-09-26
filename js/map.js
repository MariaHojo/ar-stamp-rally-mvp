/* map.js
 * 修正点：
 * - Firebase v8 で .get() → once('value') に変更（スタンプが正しく反映される）
 * - ローカルキャッシュとマージして .mark / .is-got / #stampCount を更新
 * - カメラ吹き出し：サムネは空（場所画像が入るまで枠のみ）
 * - 6/6 達成でスタンプ帳見出し下に complete.html リンク、かつ初回はモーダル自動表示
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

// ===== 設定 =====
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  // spot4〜6は非AR（本吹き出しでは起動不可のまま）
};
const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const AR_SPOTS        = ['spot1','spot2','spot3']; // カメラ起動対象
const COMPLETE_TARGET = 6;

// ===== LocalStorage =====
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }

// ===== Auth =====
async function ensureAnonSafe() {
  if (typeof window.ensureAnon === 'function') {
    try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
  }
  try {
    if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await auth.signInAnonymously();
    return cred.user && cred.user.uid;
  } catch(e) {
    console.warn('[map] ensureAnon fallback failed:', e?.message||e);
    return lsGet('uid') || null;
  }
}

// ===== スタンプ取得状態 =====
async function fetchStamps(uid) {
  let remote = null;
  try {
    // Firebase v8 では once('value') を使用
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value');
    remote = snap && snap.val ? snap.val() : null;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e?.message||e);
  }

  const stamps = {};
  ALL_SPOTS.forEach(id=>{
    const local = lsGet(lsKeyStamp(uid,id)) === 'true';
    stamps[id] = (remote && !!remote[id]) || local || false;
  });
  return stamps;
}

function renderStampUI(stamps){
  // 各セル
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';
  });

  // カウント
  const cnt = ALL_SPOTS.reduce((n, id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

  // 完了リンク（スタンプ帳見出し直下）
  const inline = $('#completeInline');
  if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
}

function countCollected(stamps){
  return ALL_SPOTS.reduce((acc, id)=> acc + (stamps[id] ? 1 : 0), 0);
}

// ===== 完走モーダル =====
function openCompleteModal(){
  $('#completeOverlay')?.classList.add('is-open');
  $('#completeModal')?.classList.add('is-open');
}
function closeCompleteModal(){
  $('#completeOverlay')?.classList.remove('is-open');
  $('#completeModal')?.classList.remove('is-open');
}
function bindCompleteModalButtons(){
  $('#closeComplete')?.addEventListener('click', closeCompleteModal);
  $('#completeOverlay')?.addEventListener('click', closeCompleteModal);
}
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < COMPLETE_TARGET) return;
  if (lsGet(seenKey(uid)) === 'true') return;
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

// ===== カメラ起動（スポット選択の吹き出し） =====
function buildCameraChooserItems(){
  const list = $('#cameraChooserList');
  if (!list) return;
  list.innerHTML = '';

  ALL_SPOTS.forEach((id)=>{
    const isAR = AR_SPOTS.includes(id);

    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="thumb" aria-hidden="true" style="background:#f3f6fc;border:1px dashed #c9d6ee;border-radius:10px"></div>
      <div class="meta">
        <div class="name">${id.toUpperCase()}</div>
        <div class="type">${isAR ? 'ARスポット' : '非ARスポット'}</div>
      </div>
      <div class="go">
        <button class="btn ${isAR ? '' : 'btn-secondary'}" data-spot="${id}" ${isAR ? '' : 'disabled'}>${isAR ? '起動' : '起動不可'}</button>
      </div>
    `;
    list.appendChild(item);
  });

  // 起動ボタン（spot1〜3のみ有効）
  list.querySelectorAll('button[data-spot]').forEach(btn=>{
    const spot = btn.dataset.spot;
    if (!AR_SPOTS.includes(spot)) return;
    btn.addEventListener('click', async ()=>{
      const uid = await ensureAnonSafe();
      const base = EIGHTHWALL_URLS[spot] || EIGHTHWALL_URLS.spot1;
      const url = new URL(base);
      url.searchParams.set('spotId', spot);
      if (uid) url.searchParams.set('uid', uid);
      location.href = url.toString();
    });
  });
}

function showCameraChooser(){
  buildCameraChooserItems();
  $('#cameraChooserOverlay')?.classList.add('is-open');
  $('#cameraChooser')?.classList.add('is-open');
}
function hideCameraChooser(){
  $('#cameraChooserOverlay')?.classList.remove('is-open');
  $('#cameraChooser')?.classList.remove('is-open');
}

// ===== 起動 =====
async function boot(){
  bindCompleteModalButtons();

  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // 戻ってきた時に最新反映
  document.addEventListener('visibilitychange', async ()=>{
    if (document.visibilityState === 'visible') {
      const s = await fetchStamps(uid);
      renderStampUI(s);
      await handleCompletionFlow(uid, s);
    }
  });
  window.addEventListener('pageshow', async ()=>{
    const s = await fetchStamps(uid);
    renderStampUI(s);
    await handleCompletionFlow(uid, s);
  });
}

document.addEventListener('DOMContentLoaded', boot);
