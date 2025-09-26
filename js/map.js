/* map.js（匿名UID専用・AR3スポット達成でモーダル表示）
   - スタンプ状態の読み込み（Firebase/ローカル併用）
   - カメラ起動：スポット選択→8th Wall へ遷移（uid付与）
   - ★ 3スポット達成時：map.html を暗くし、complete相当のモーダルを自動表示
     （一度表示したら uid別フラグで再表示しない）
*/

// -------- 設定 --------
// 8th Wall のURL（必要に応じて置換）
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
};

// 対象スポット：今回は AR 3箇所
const REQUIRED_SPOTS = ['spot1','spot2','spot3'];
const REQUIRED_COUNT = REQUIRED_SPOTS.length; // ← 6スポット判定にしたい場合は配列を差し替え

// -------- ユーティリティ --------
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function lsGet(key){ try{return localStorage.getItem(key);}catch{return null;} }
function lsSet(key,val){ try{localStorage.setItem(key,val);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_ar3_seen_${uid}`; } // AR3 達成モーダルの既視フラグ

// firebase.js で window.ensureAnon を想定。無い場合はフォールバック。
async function ensureAnonSafe() {
  if (typeof window.ensureAnon === 'function') {
    try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
  }
  // v8想定フォールバック
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

// -------- スタンプ読み込み & UI反映 --------
async function fetchStamps(uid) {
  // Firebase優先、なければローカル
  let remote = null;
  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).get();
    remote = snap.exists() ? snap.val() : null;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e?.message||e);
  }

  const stamps = {};
  REQUIRED_SPOTS.forEach(id=>{
    const local = lsGet(lsKeyStamp(uid,id)) === 'true';
    stamps[id] = (remote && !!remote[id]) || local || false;
  });
  return stamps;
}

function renderStampUI(stamps){
  // 既存のスタンプ帳UIがあれば、ここで反映（例：.stamp-cell[data-spot])
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';
  });
}

function countCollected(stamps){
  return REQUIRED_SPOTS.reduce((acc, id)=> acc + (stamps[id] ? 1 : 0), 0);
}

// -------- コンプリート・モーダル制御 --------
function openCompleteModal(){
  const overlay = $('#completeOverlay');
  const modal = $('#completeModal');
  const page = $('#pageRoot');
  if (overlay && modal && page) {
    overlay.classList.add('is-open');
    modal.classList.add('is-open');
    page.classList.add('is-dim');
    overlay.setAttribute('aria-hidden','false');
  }
}
function closeCompleteModal(){
  const overlay = $('#completeOverlay');
  const modal = $('#completeModal');
  const page = $('#pageRoot');
  if (overlay && modal && page) {
    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    page.classList.remove('is-dim');
    overlay.setAttribute('aria-hidden','true');
  }
}

// 「マップに戻る」ボタン（モーダルクローズ）
function bindCompleteModalButtons(){
  $('#closeComplete')?.addEventListener('click', ()=> closeCompleteModal());
  // 背景タップで閉じる（必要に応じて無効化可）
  $('#completeOverlay')?.addEventListener('click', ()=> closeCompleteModal());
}

// 達成時のフロー：初回だけモーダル、それ以降はリンク常設で運用
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < REQUIRED_COUNT) return;

  // 既視なら何もしない（手動リンクのみ）
  if (lsGet(seenKey(uid)) === 'true') return;

  // 初回：モーダルを自動表示
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

// -------- カメラ起動（スポット選択の吹き出し） --------
function showCameraChooser(){
  const overlay = $('#cameraChooserOverlay');
  const panel = $('#cameraChooser');
  if (!overlay || !panel) return;

  const list = $('#cameraChooserList');
  if (list) {
    list.innerHTML = '';
    REQUIRED_SPOTS.forEach(id=>{
      const li = document.createElement('div');
      li.className = 'item';
      li.innerHTML = `
        <div class="thumb"><img src="assets/${id}.jpg" alt="${id}" onerror="this.style.opacity=.15"></div>
        <div class="meta">
          <div class="name">${id.toUpperCase()}</div>
          <div class="type">ARスポット</div>
        </div>
        <div class="go"><button class="btn" data-spot="${id}">起動</button></div>
      `;
      list.appendChild(li);
    });

    // 起動ボタン
    list.querySelectorAll('button[data-spot]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const spot = btn.dataset.spot;
        const uid = await ensureAnonSafe();
        const base = EIGHTHWALL_URLS[spot] || EIGHTHWALL_URLS.spot1;
        const url = new URL(base);
        url.searchParams.set('spotId', spot);
        if (uid) url.searchParams.set('uid', uid);
        location.href = url.toString();
      });
    });
  }

  overlay.hidden = false;
  panel.hidden = false;
}
function hideCameraChooser(){
  $('#cameraChooserOverlay')?.setAttribute('hidden','');
  $('#cameraChooser')?.setAttribute('hidden','');
}

// -------- 起動 --------
async function boot(){
  bindCompleteModalButtons();
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // explanation.html から戻った直後など、ページ復帰時にも再チェック
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
