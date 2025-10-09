/* map.js（差し替え版）
 * 目的：
 *  - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 *  - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 *  - 「カメラ起動」→ スポット選択の写真グリッド（6箇所すべて AR 起動）
 *  - 写真ソースを assets/images/current_photos/spotXX.jpg に統一（XX=01..06）
 *  - 画像はモーダルを開いた時にだけ生成（負荷低減）＋ <img loading="lazy">
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall 側 URL（要置換） ======
 * 例: 'https://yourname.8thwall.app/icu-spot1/'
 */
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/spot1/', // ←実URLに置換
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  spot4: 'https://maria261081.8thwall.app/spot4/',
  spot5: 'https://maria261081.8thwall.app/spot5/',
  spot6: 'https://maria261081.8thwall.app/spot6/'
};

const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const AR_SPOTS        = ALL_SPOTS.slice();   // 6箇所すべて AR
const COMPLETE_TARGET = 6;

/* ====== 表示名・写真パス ====== */
const SPOT_LABELS = {
  spot1: '本館173前',
  spot2: 'トロイヤー記念館（T館）前',
  spot3: '学生食堂（ガッキ）前',
  spot4: 'チャペル前',
  spot5: '体育館（Pec-A）前',
  spot6: '本館307前',
};
const photoSrc = (spotId) => {
  const nn = String(spotId.replace('spot','')).padStart(2,'0');
  return `assets/images/current_photos/spot${nn}.JPG`; // ←今回の差し替えポイント
};

/* ====== LocalStorage util ====== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }

/* ====== Auth（匿名） ====== */
async function ensureAnonSafe() {
  // 既存の ensureAnon があればそれを優先
  if (typeof window.ensureAnon === 'function') {
    try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
  }
  // フォールバック（v8）
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
  // 各セル（取得/未取得の文言・クラス）
  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got  = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? '✅取得済' : '未取得';
  });

  // 合計カウント
  const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

  // 完了インラインリンク（見出し直下）
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

/* ====== カメラ起動（スポット選択：写真グリッド） ====== */
function buildCameraChooserItems(){
  const list = $('#cameraChooserList');
  if (!list) return;
  list.innerHTML = '';

  // 2列×3行のグリッド項目
  ALL_SPOTS.forEach((id)=>{
    const name = SPOT_LABELS[id] || id.toUpperCase();
    const src  = photoSrc(id);

    const item = document.createElement('div');
    item.className = 'item';

    // 画像リンク全体が押下対象（ボタンは置かない）
    item.innerHTML = `
      <a class="photoLink" href="#" data-spot="${id}" aria-label="${name}">
        <div class="thumbWrap">
          <img loading="lazy" src="${src}" alt="${name}">
          <div class="label">${name}</div>
        </div>
      </a>
    `;
    list.appendChild(item);
  });

  // 画像クリックで AR 起動
  list.querySelectorAll('a.photoLink[data-spot]').forEach(a=>{
    a.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const spot = a.getAttribute('data-spot');
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
  buildCameraChooserItems(); // 開いた時点で初めて生成→不要な事前読込を防ぐ
  $('#cameraChooserOverlay')?.classList.add('is-open');
  $('#cameraChooser')?.classList.add('is-open');
}
function hideCameraChooser(){
  $('#cameraChooserOverlay')?.classList.remove('is-open');
  $('#cameraChooser')?.classList.remove('is-open');
}

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  // 「カメラ起動」→ 写真グリッド
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  // サインイン & スタンプ反映
  const uid = await ensureAnonSafe();
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // 復帰時に再反映
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

/* ====== カメラ選択モーダルの見た目（画像・名札）に合わせた CSS を map.html に用意してください ======
  .camera-chooser .list{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px }
  .camera-chooser .item{ padding:0; border:none; background:transparent }
  .thumbWrap{ position:relative; aspect-ratio:1/1; border-radius:12px; overflow:hidden;
              box-shadow:0 10px 26px rgba(0,0,0,.12); border:1px solid #e3eaf6 }
  .thumbWrap img{ width:100%; height:100%; object-fit:cover; display:block }
  .thumbWrap .label{
    position:absolute; left:8px; bottom:8px; right:8px;
    font-weight:900; font-size:14px; line-height:1.2; color:#fff;
    text-shadow: -1px -1px 0 #2b3a68, 1px -1px 0 #2b3a68, -1px 1px 0 #2b3a68, 1px 1px 0 #2b3a68;
    background:linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,0));
    padding:10px 10px 12px; border-radius:0 0 10px 10px;
  }
*/