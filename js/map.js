/* map.js（差し替え版）
 * - スポット選択：縦3×横2の正方形グリッドに写真表示（lazy）＋画像拡張子ゆれに自動フォールバック
 * - 既存の class を消さずに grid クラスを追加（list.classList.add）
 * - Firebase 優先でローカル同期（前回版と同等）
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall URL（要置換） ====== */
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/spot1/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  spot4: 'https://maria261081.8thwall.app/spot4/',
  spot5: 'https://maria261081.8thwall.app/spot5/',
  spot6: 'https://maria261081.8thwall.app/spot6/'
};

const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const AR_SPOTS        = ALL_SPOTS.slice();
const COMPLETE_TARGET = 6;

const SPOT_LABELS = {
  spot1: '本館173前',
  spot2: 'トロイヤー記念館（T館）前',
  spot3: '学生食堂（ガッキ）前',
  spot4: 'チャペル前',
  spot5: '体育館（Pec-A）前',
  spot6: '本館307前'
};

/* ====== LocalStorage util ====== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsRemove(k){ try{localStorage.removeItem(k);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }

/* ====== Auth（匿名） ====== */
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

/* ====== スタンプ（Firebase優先＋ローカル同期） ====== */
async function fetchStampsAndSync(uid) {
  let remote = null, gotRemote = false;
  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value');
    remote = snap && (typeof snap.val === 'function' ? snap.val() : snap.val);
    if (typeof remote === 'function') remote = remote(); // 念のため
    gotRemote = true;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e?.message||e);
  }

  const stamps = {};
  if (gotRemote) {
    ALL_SPOTS.forEach(id=>{
      const val = !!(remote && remote[id]);
      stamps[id] = val;
      if (val) lsSet(lsKeyStamp(uid,id), 'true');
      else     lsRemove(lsKeyStamp(uid,id));
    });
  } else {
    ALL_SPOTS.forEach(id=>{
      stamps[id] = (lsGet(lsKeyStamp(uid,id)) === 'true');
    });
  }
  return {stamps, gotRemote};
}

function renderStampUI(stamps){
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got  = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';
  });
  const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;
  const inline = $('#completeInline');
  if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
}

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
function countCollected(stamps){
  return ALL_SPOTS.reduce((acc,id)=> acc + (stamps[id] ? 1 : 0), 0);
}
function resetCompleteSeenIfNeeded(uid, stamps){
  if (countCollected(stamps) < COMPLETE_TARGET) lsRemove(seenKey(uid));
}
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < COMPLETE_TARGET) return;
  if (lsGet(seenKey(uid)) === 'true') return;
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

/* ====== 画像の拡張子フォールバック（.jpg/.JPG/.jpeg/.png/.PNG） ====== */
function createImgWithFallbacks(basePathNoExt, label){
  const candidates = [
    `${basePathNoExt}.jpg`,
    `${basePathNoExt}.JPG`,
    `${basePathNoExt}.jpeg`,
    `${basePathNoExt}.png`,
    `${basePathNoExt}.PNG`,
  ];
  let idx = 0;
  const img = new Image();
  img.alt = label || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = candidates[idx];
  img.onerror = () => {
    idx++;
    if (idx < candidates.length) {
      img.src = candidates[idx];
    } else {
      // 最終フォールバック：透明1px
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    }
  };
  return img;
}

/* ====== カメラ起動（写真グリッド） ====== */
function buildCameraChooserGrid(){
  const list = $('#cameraChooserList');
  if (!list) return;

  // 既存クラスを保持したまま grid クラスを追加（←重要）
  list.classList.add('grid-chooser');
  list.innerHTML = '';

  ALL_SPOTS.forEach((id, i)=>{
    const label = SPOT_LABELS[id] || id.toUpperCase();
    const num   = String(i+1).padStart(2,'0');
    const base  = `assets/images/current_photos/spot${num}`;

    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'grid-item';
    a.setAttribute('data-spot', id);

    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const img = createImgWithFallbacks(base, label);
    thumb.appendChild(img);

    const cap = document.createElement('div');
    cap.className = 'label';
    cap.textContent = label;
    thumb.appendChild(cap);

    a.appendChild(thumb);
    list.appendChild(a);
  });

  // 画像クリックで AR 起動
  list.querySelectorAll('.grid-item').forEach(el=>{
    el.addEventListener('click', async ()=>{
      const spot = el.getAttribute('data-spot');
      const base = EIGHTHWALL_URLS[spot];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const uid  = await ensureAnonSafe();
      const url  = new URL(base);
      url.searchParams.set('spotId', spot);
      if (uid) url.searchParams.set('uid', uid);
      location.href = url.toString();
    });
  });
}

function showCameraChooser(){
  buildCameraChooserGrid();
  $('#cameraChooserOverlay')?.classList.add('is-open');
  $('#cameraChooser')?.classList.add('is-open');
}
function hideCameraChooser(){
  $('#cameraChooserOverlay')?.classList.remove('is-open');
  $('#cameraChooser')?.classList.remove('is-open');
}

/* ====== 手動リセット (?reset=1) ====== */
function maybeResetLocal(uid){
  const p = new URLSearchParams(location.search);
  if (p.get('reset') === '1') {
    ALL_SPOTS.forEach(id=> lsRemove(lsKeyStamp(uid,id)));
    lsRemove(seenKey(uid));
    console.log('[map] localStorage reset for uid:', uid);
  }
}

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  const uid = await ensureAnonSafe();
  maybeResetLocal(uid);

  const {stamps} = await fetchStampsAndSync(uid);
  renderStampUI(stamps);
  resetCompleteSeenIfNeeded(uid, stamps);
  await handleCompletionFlow(uid, stamps);

  async function refresh(){
    const r = await fetchStampsAndSync(uid);
    renderStampUI(r.stamps);
    resetCompleteSeenIfNeeded(uid, r.stamps);
    await handleCompletionFlow(uid, r.stamps);
  }
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('pageshow', refresh);
}

document.addEventListener('DOMContentLoaded', boot);
