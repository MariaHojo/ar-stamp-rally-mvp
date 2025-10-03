/* map.js（差し替え版：写真の遅延読込＆再試行抑止）
 *  - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 *  - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 *  - 「カメラ起動」→ スポット選択（写真カードの2列×3行グリッド）
 *  - 8th Wall 各プロジェクトURLへ遷移（spotId/uid をクエリ付与）
 *  - 写真はモーダル表示時のみ遅延ロード／一度だけ拡張子フォールバック／失敗後は再試行しない
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

/* ====== スタンプ取得状態の取得 ====== */
async function fetchStamps(uid) {
  let remote = null;
  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value'); // v8: once('value')
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

/* ====== スタンプ帳 UI 反映 ====== */
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

/* ====== 完走モーダル ====== */
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
  if (lsGet(seenKey(uid)) === 'true') return; // 初回のみ
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

/* ====== カメラ起動（写真の遅延読込を徹底） ====== */

/* 画像URL生成（まず jpg を試し、必要なら png フォールバック） */
function photoUrl(spotId, ext='jpg'){
  const n = spotId.replace('spot','').padStart(2,'0');
  return `assets/images/Todays_photos/Todays_photos_${n}.${ext}`;
}

/* 軽量なプレースホルダ（グレーの1x1 PNG） */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4zwAAAgABd8YI1QAAAABJRU5ErkJggg==';

/* 画像ロード状態のキャッシュ（再試行抑止） */
const PHOTO_STATE = Object.create(null);
/* 値：'ok' | 'jpgfail' | 'fail'（jpgもpngも失敗） */

let cameraGridBuilt = false;   // モーダルDOMは1回だけ構築
let imgObserver = null;        // IntersectionObserver（可視範囲のみロード）

/* 可視範囲に入ったときだけロード */
function ensureObserver(){
  if (imgObserver) return imgObserver;
  imgObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const img = entry.target;
      if (!entry.isIntersecting) return;
      imgObserver.unobserve(img);
      lazyLoadImage(img);
    });
  }, {root: $('#cameraChooser'), rootMargin: '50px', threshold: 0.01});
  return imgObserver;
}

/* 実際のロード処理：jpg → 失敗なら png → 失敗ならプレースホルダ確定（以後再試行なし） */
function lazyLoadImage(img){
  const sid = img.getAttribute('data-spot');
  if (!sid) return;

  if (PHOTO_STATE[sid] === 'ok' || PHOTO_STATE[sid] === 'fail') {
    // すでに決着済み（ok or 完全失敗）
    return;
  }

  // 1) jpg を試す
  if (!PHOTO_STATE[sid]) {
    PHOTO_STATE[sid] = 'loading-jpg';
    img.onerror = () => {
      PHOTO_STATE[sid] = 'jpgfail';
      // 2) png を試す
      img.onerror = () => {
        PHOTO_STATE[sid] = 'fail';
        img.src = PLACEHOLDER;   // 以降はプレースホルダ固定
      };
      img.src = photoUrl(sid, 'png');
    };
    img.onload = () => { PHOTO_STATE[sid] = 'ok'; };
    img.src = photoUrl(sid, 'jpg');
    return;
  }

  // 直前に jpg が失敗して 'jpgfail' 済み → png だけ試す
  if (PHOTO_STATE[sid] === 'jpgfail') {
    img.onerror = () => { PHOTO_STATE[sid] = 'fail'; img.src = PLACEHOLDER; };
    img.onload  = () => { PHOTO_STATE[sid] = 'ok'; };
    img.src     = photoUrl(sid, 'png');
  }
}

/* グリッドDOMの構築（初回のみ）。画像はここでは読み込まない（src未設定） */
function buildCameraChooserItemsOnce(){
  if (cameraGridBuilt) return;
  const grid = $('#cameraGrid');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_SPOTS.forEach((id)=>{
    const isAR = AR_SPOTS.includes(id);

    const card = document.createElement('div');
    card.className = 'spot-card' + (isAR ? '' : ' is-disabled');

    // サムネ（正方形・丸角） ※ src は設定しない＝0リクエスト
    const thumb = document.createElement('div');
    thumb.className = 'spot-thumb';

    const img = document.createElement('img');
    img.alt = `${SPOT_LABEL[id] || id} の写真`;
    img.loading = 'lazy';
    img.src = PLACEHOLDER;              // 透過的な灰色1px（ネットワークリクエストなし）
    img.setAttribute('data-spot', id);  // 後で lazyLoadImage が参照
    thumb.appendChild(img);

    // バッジ
    const badge = document.createElement('div');
    badge.className = 'badge' + (isAR ? '' : ' badge-gray');
    badge.textContent = isAR ? 'AR' : '準備中';
    thumb.appendChild(badge);

    // 名称（ふち有）
    const nameWrap = document.createElement('div');
    nameWrap.className = 'spot-name-wrap';
    const name = document.createElement('div');
    name.className = 'spot-name';
    name.textContent = SPOT_LABEL[id] || id.toUpperCase();
    nameWrap.appendChild(name);

    // アクション
    const action = document.createElement('div');
    action.className = 'spot-action';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = isAR ? 'このスポットのARを起動' : '起動できません';
    if (!isAR) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', async ()=>{
        const uid  = await ensureAnonSafe();
        const base = EIGHTHWALL_URLS[id];
        if (!base) { alert('このスポットのAR URLが未設定です'); return; }
        const url = new URL(base);
        url.searchParams.set('spotId', id);
        if (uid) url.searchParams.set('uid', uid);
        location.href = url.toString();
      });
    }
    action.appendChild(btn);

    // カード構築
    card.appendChild(thumb);
    card.appendChild(nameWrap);
    card.appendChild(action);

    grid.appendChild(card);
  });

  cameraGridBuilt = true;
}

/* モーダル表示：このタイミングで“見えているカードだけ”ロード開始 */
function showCameraChooser(){
  buildCameraChooserItemsOnce();

  // 開いたあとに少し待ってから可視領域を監視（開くアニメーション考慮）
  $('#cameraChooserOverlay')?.classList.add('is-open');
  $('#cameraChooser')?.classList.add('is-open');

  setTimeout(()=>{
    const obs = ensureObserver();
    // 既にOK/FAILがついているものは監視不要
    $$('#cameraGrid img[data-spot]').forEach(img=>{
      const sid = img.getAttribute('data-spot');
      if (PHOTO_STATE[sid] === 'ok' || PHOTO_STATE[sid] === 'fail') return; // 決着済
      // まだ何も試していない場合だけ監視開始
      if (!PHOTO_STATE[sid]) obs.observe(img);
    });
  }, 120);
}

function hideCameraChooser(){
  $('#cameraChooserOverlay')?.classList.remove('is-open');
  $('#cameraChooser')?.classList.remove('is-open');
  // 非表示にしても監視は維持（次回開いたときに未ロードの分だけ再計算）
}

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  // 「カメラ起動」→ 写真グリッドのボトムシート
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  // サインイン & スタンプ反映
  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // 復帰時に再反映（写真の再試行は発生しない設計）
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

  // data-ar-spot / #openAR-spotN（直接ボタンがある場合のフォールバック）
  document.querySelectorAll('[data-ar-spot]').forEach(btn=>{
    btn.addEventListener('click', async (ev)=>{
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
  for (let i=1;i<=6;i++){
    const el = document.getElementById('openAR-spot'+i);
    if (el && !el._arBound) {
      el._arBound = true;
      el.addEventListener('click', async (e)=>{
        e.preventDefault();
        const spot = 'spot'+i;
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
