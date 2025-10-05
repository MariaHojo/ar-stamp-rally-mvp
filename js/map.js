/* map.js（差し替え版：写真リンク＋オーバーレイ名表示／遅延読込／代入の ?. 排除）
 *  - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 *  - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 *  - 「カメラ起動」→ スポット選択（写真カードの2列×3行グリッド）
 *  - 写真はリンク埋め込み（クリック＝AR起動）
 *  - 画像はモーダル表示時のみ遅延ロード／jpg失敗時にpngを1回だけ試行／以降再試行しない
 *  - 代入の左辺に ?. を使わない（旧Safari対策）
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall 側 URL（要置換） ====== */
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/spot1/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  spot4: 'https://maria261081.8thwall.app/spot4/',
  spot5: 'https://maria261081.8thwall.app/spot5/',
  spot6: 'https://maria261081.8thwall.app/spot6/'
};
/*
spot1 本館173
spot2 T館
spot3 ガッキ
spot4 チャペル
spot5 体育館
spot6 本館305
*/
const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const AR_SPOTS        = ALL_SPOTS.slice();   // 6箇所すべて AR
const COMPLETE_TARGET = 6;

/* 表示名（必要なら編集） */
const SPOT_LABEL = {
  spot1: 'スポット1',
  spot2: 'スポット2',
  spot3: 'スポット3',
  spot4: 'スポット4',
  spot5: 'スポット5',
  spot6: 'スポット6',
};

/* ====== LocalStorage util ====== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }

/* ====== Auth（匿名） ====== */
async function ensureAnonSafe() {
  if (typeof window.ensureAnon === 'function') {
    try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
  }
  try {
    if (!firebase || !firebase.apps || !firebase.apps.length) {
      if (typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
    }
    const auth = firebase.auth();
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await auth.signInAnonymously();
    return cred.user && cred.user.uid;
  } catch(e) {
    console.warn('[map] ensureAnon fallback failed:', e && e.message ? e.message : e);
    return lsGet('uid') || null;
  }
}

/* ====== スタンプ取得状態の取得 ====== */
async function fetchStamps(uid) {
  let remote = null;
  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value'); // v8: once('value')
    remote = snap && snap.val ? snap.val() : null;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e && e.message ? e.message : e);
  }

  const stamps = {};
  ALL_SPOTS.forEach(id=>{
    const local = lsGet(lsKeyStamp(uid,id)) === 'true';
    stamps[id] = (remote && !!remote[id]) || local || false;
  });
  return stamps;
}

/* ====== スタンプ帳 UI 反映 ====== */
function renderStampUI(stamps){
  // 各セル
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.getAttribute('data-spot');
    const got  = !!stamps[spot];
    if (got) cell.classList.add('is-got'); else cell.classList.remove('is-got');
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';
  });

  // 合計カウント
  const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

  // 完了インラインリンク
  const inline = $('#completeInline');
  if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
}

/* ====== 完走モーダル ====== */
function openCompleteModal(){
  const ov = $('#completeOverlay');
  const md = $('#completeModal');
  if (ov) ov.classList.add('is-open');
  if (md) md.classList.add('is-open');
}
function closeCompleteModal(){
  const ov = $('#completeOverlay');
  const md = $('#completeModal');
  if (ov) ov.classList.remove('is-open');
  if (md) md.classList.remove('is-open');
}
function bindCompleteModalButtons(){
  const btn = $('#closeComplete');
  const ov  = $('#completeOverlay');
  if (btn) btn.addEventListener('click', closeCompleteModal);
  if (ov)  ov.addEventListener('click', closeCompleteModal);
}
function countCollected(stamps){
  return ALL_SPOTS.reduce((acc,id)=> acc + (stamps[id] ? 1 : 0), 0);
}
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < COMPLETE_TARGET) return;
  if (lsGet(seenKey(uid)) === 'true') return; // 初回のみ
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

/* ====== カメラ起動（写真リンク：遅延読込を徹底） ====== */

/* 画像URL生成（まず jpg を試し、必要なら png フォールバック） */
function photoUrl(spotId, ext){
  if (!ext) ext = 'jpg';
  const n = String(spotId.replace('spot','')).padStart(2,'0');
  return `assets/images/Todays_photos/Todays_photos_${n}.${ext}`;
}

/* 軽量なプレースホルダ（グレーの1x1 PNG） */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4zwAAAgABd8YI1QAAAABJRU5ErkJggg==';

/* 画像ロード状態のキャッシュ（再試行抑止）
 * 値：'ok' | 'jpgfail' | 'fail'（jpgもpngも失敗）
 */
const PHOTO_STATE = Object.create(null);

let cameraGridBuilt = false;   // モーダルDOMは1回だけ構築
let imgObserver = null;        // IntersectionObserver（可視範囲のみロード）

/* 可視範囲に入ったときだけロード */
function ensureObserver(){
  if (imgObserver) return imgObserver;
  imgObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (!entry.isIntersecting) return;
      const target = entry.target;
      imgObserver.unobserve(target);
      const img = target.tagName === 'IMG' ? target : target.querySelector('img[data-spot]');
      if (img) lazyLoadImage(img);
    });
  }, {root: $('#cameraChooser'), rootMargin: '50px', threshold: 0.01});
  return imgObserver;
}

/* 実際のロード処理：jpg → 失敗なら png → 失敗ならプレースホルダ確定（以後再試行なし） */
function lazyLoadImage(img){
  const sid = img.getAttribute('data-spot');
  if (!sid) return;

  if (PHOTO_STATE[sid] === 'ok' || PHOTO_STATE[sid] === 'fail') {
    return; // すでに決着済み
  }

  // 1) jpg を試す
  if (!PHOTO_STATE[sid]) {
    PHOTO_STATE[sid] = 'loading-jpg';
    img.onerror = function onJpgError() {
      PHOTO_STATE[sid] = 'jpgfail';
      // 2) png を試す
      img.onerror = function onPngError() {
        PHOTO_STATE[sid] = 'fail';
        img.src = PLACEHOLDER;   // 以降はプレースホルダ固定
      };
      img.onload = function onPngLoad(){ PHOTO_STATE[sid] = 'ok'; };
      img.src = photoUrl(sid, 'png');
    };
    img.onload = function onJpgLoad(){ PHOTO_STATE[sid] = 'ok'; };
    img.src = photoUrl(sid, 'jpg');
    return;
  }

  // 直前に jpg が失敗して 'jpgfail' 済み → png だけ試す
  if (PHOTO_STATE[sid] === 'jpgfail') {
    img.onerror = function onPngError2(){ PHOTO_STATE[sid] = 'fail'; img.src = PLACEHOLDER; };
    img.onload  = function onPngLoad2(){ PHOTO_STATE[sid] = 'ok'; };
    img.src     = photoUrl(sid, 'png');
  }
}

/* グリッドDOMの構築（初回のみ）。画像はここでは読み込まない（srcは1pxプレースホルダ） */
function buildCameraChooserItemsOnce(){
  if (cameraGridBuilt) return;
  const grid = $('#cameraGrid');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_SPOTS.forEach((id)=>{
    const card = document.createElement('div');
    card.className = 'spot-card';

    // 画像リンク（写真全体がリンク）
    const link = document.createElement('a');
    link.href = 'javascript:void(0)';
    link.className = 'spot-link';
    link.setAttribute('role', 'button');
    link.setAttribute('data-spot', id);
    link.style.display = 'block';

    // サムネ（正方形・丸角） ※ src は軽量プレースホルダ
    const thumb = document.createElement('div');
    thumb.className = 'spot-thumb';

    const img = document.createElement('img');
    img.alt = (SPOT_LABEL[id] || id) + ' の写真';
    img.loading = 'lazy';
    img.src = PLACEHOLDER;
    img.setAttribute('data-spot', id);
    thumb.appendChild(img);

    // オーバーレイ名（ふち有文字）
    const nameOverlay = document.createElement('div');
    nameOverlay.className = 'spot-name';
    nameOverlay.textContent = SPOT_LABEL[id] || id.toUpperCase();
    nameOverlay.style.position = 'absolute';
    nameOverlay.style.left = '10px';
    nameOverlay.style.bottom = '10px';
    nameOverlay.style.zIndex = '2';
    thumb.appendChild(nameOverlay);

    link.appendChild(thumb);
    card.appendChild(link);
    grid.appendChild(card);

    // クリックで AR 起動
    link.addEventListener('click', async function(){
      const uid  = await ensureAnonSafe();
      const base = EIGHTHWALL_URLS[id];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const url = new URL(base);
      url.searchParams.set('spotId', id);
      if (uid) url.searchParams.set('uid', uid);
      location.href = url.toString();
    });
  });

  cameraGridBuilt = true;
}

/* モーダル表示：このタイミングで“見えているカードだけ”ロード開始 */
function showCameraChooser(){
  buildCameraChooserItemsOnce();

  const ov = $('#cameraChooserOverlay');
  const md = $('#cameraChooser');
  if (ov) ov.classList.add('is-open');
  if (md) md.classList.add('is-open');

  setTimeout(()=>{
    const obs = ensureObserver();
    const imgs = $$('#cameraGrid img[data-spot]');
    imgs.forEach(img=>{
      const sid = img.getAttribute('data-spot');
      if (PHOTO_STATE[sid] === 'ok' || PHOTO_STATE[sid] === 'fail') return; // 決着済は不要
      if (!PHOTO_STATE[sid]) obs.observe(img);
    });
  }, 120);
}

function hideCameraChooser(){
  const ov = $('#cameraChooserOverlay');
  const md = $('#cameraChooser');
  if (ov) ov.classList.remove('is-open');
  if (md) md.classList.remove('is-open');
}

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  // 「カメラ起動」→ 写真グリッドのボトムシート
  const cameraBtn = $('#cameraBtn');
  if (cameraBtn) cameraBtn.addEventListener('click', showCameraChooser);
  const closeBtn = $('#cameraChooserClose');
  if (closeBtn) closeBtn.addEventListener('click', hideCameraChooser);
  const overlay = $('#cameraChooserOverlay');
  if (overlay) overlay.addEventListener('click', hideCameraChooser);

  // サインイン & スタンプ反映
  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // 復帰時に再反映（写真の再試行は発生しない設計）
  document.addEventListener('visibilitychange', async function(){
    if (document.visibilityState === 'visible') {
      const s = await fetchStamps(uid);
      renderStampUI(s);
      await handleCompletionFlow(uid, s);
    }
  });
  window.addEventListener('pageshow', async function(){
    const s = await fetchStamps(uid);
    renderStampUI(s);
    await handleCompletionFlow(uid, s);
  });

  // フォールバック：もし data-ar-spot / #openAR-spotN が別途ある場合
  const dataBtns = document.querySelectorAll('[data-ar-spot]');
  dataBtns.forEach(function(btn){
    btn.addEventListener('click', async function(ev){
      ev.preventDefault();
      const spot = btn.getAttribute('data-ar-spot');
      const base = EIGHTHWALL_URLS[spot];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const uid = await ensureAnonSafe();
      const url = new URL(base);
      url.searchParams.set('spotId', spot);
      if (uid) url.searchParams.set('uid', uid);
      location.href = url.toString();
    });
  });
  for (var i=1;i<=6;i++){
    const el = document.getElementById('openAR-spot'+i);
    if (el && !el._arBound) {
      el._arBound = true;
      el.addEventListener('click', async function(e){
        e.preventDefault();
        const spotNum = this.id.replace('openAR-spot','');
        const spot = 'spot'+spotNum;
        const base = EIGHTHWALL_URLS[spot];
        if (!base) { alert('このスポットのAR URLが未設定です'); return; }
        const uid = await ensureAnonSafe();
        const url = new URL(base);
        url.searchParams.set('spotId', spot);
        if (uid) url.searchParams.set('uid', uid);
        location.href = url.toString();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
