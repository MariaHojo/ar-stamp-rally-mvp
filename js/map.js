/* js/map.js（差し替え版）
 * - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 * - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 * - 「カメラ起動」→ スポット選択吹き出し（6箇所すべて AR 起動）
 * - Firebaseリセット後でも localStorage の古いスタンプが残って見える問題を解消
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ===== 8th Wall URL（要置換）===== */
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
  spot6: '本館307前',
};

/* ===== LocalStorage ===== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsRemove(k){ try{localStorage.removeItem(k);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }

/* ===== Auth ===== */
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

/* ===== スタンプ取得状態 ===== */
function readLocalStamps(uid){
  const out = {};
  ALL_SPOTS.forEach(id=>{
    out[id] = (lsGet(lsKeyStamp(uid,id)) === 'true');
  });
  return out;
}
function clearLocalStamps(uid){
  ALL_SPOTS.forEach(id=> lsRemove(lsKeyStamp(uid,id)) );
}

async function fetchStamps(uid) {
  let remote = null;
  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value');
    remote = snap && snap.val ? snap.val() : null;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e?.message||e);
  }

  const local = readLocalStamps(uid);

  // ---- リセット対応：オンラインかつリモートが空（= サーバ初期状態）の場合はローカルも初期化 ----
  const remoteEmpty = !remote || Object.keys(remote).length === 0;
  const localHasAny = Object.values(local).some(Boolean);
  if (navigator.onLine && remoteEmpty && localHasAny) {
    clearLocalStamps(uid);
    ALL_SPOTS.forEach(id=> local[id] = false);
  }

  const stamps = {};
  ALL_SPOTS.forEach(id=>{
    stamps[id] = (remote && !!remote[id]) || !!local[id] || false;
  });
  return stamps;
}

/* ===== UI反映 ===== */
function renderStampUI(stamps){
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got  = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';

    const name = cell.querySelector('.stamp-name');
    if (name && SPOT_LABELS[spot]) name.textContent = SPOT_LABELS[spot];
  });

  const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

  const inline = $('#completeInline');
  if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
}

/* ===== 完走モーダル ===== */
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
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < COMPLETE_TARGET) return;
  if (lsGet(seenKey(uid)) === 'true') return;
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

/* ===== カメラ起動（吹き出し内容） ===== */
function buildCameraChooserItems(){
  const listWrap = $('#cameraGrid');
  if (!listWrap) return;
  listWrap.innerHTML = '';

  ALL_SPOTS.forEach(id=>{
    const card = document.createElement('a');
    card.className = 'spot-card';
    card.href = (()=>{
      const base = EIGHTHWALL_URLS[id];
      const url  = new URL(base);
      const uid  = lsGet('uid') || ''; // ensureAnon 後に再設定される
      url.searchParams.set('spotId', id);
      if (uid) url.searchParams.set('uid', uid);
      return url.toString();
    })();
    card.innerHTML = `
      <div class="spot-thumb">
        <img loading="lazy" decoding="async"
             src="assets/images/Todays_photos/placeholder.png"
             data-src="assets/images/Todays_photos/Todays_photos_${String(id.replace('spot','')).padStart(2,'0')}.jpg"
             alt="${SPOT_LABELS[id] || id}">
        <div class="spot-name">${SPOT_LABELS[id] || id.toUpperCase()}</div>
      </div>
    `;
    listWrap.appendChild(card);
  });

  // 遅延ロード
  const imgs = listWrap.querySelectorAll('img[data-src]');
  const io = new IntersectionObserver((entries, obs)=>{
    entries.forEach(e=>{
      if (e.isIntersecting){
        const img = e.target;
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
        obs.unobserve(img);
      }
    });
  }, {root:listWrap, rootMargin:'100px'});
  imgs.forEach(img=> io.observe(img));
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

/* ===== 起動 ===== */
async function boot(){
  bindCompleteModalButtons();
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

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
