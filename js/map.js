/* map.js（差し替え版）
 * 修正点:
 * - Firebase v8 を真実ソースに：取得成功時は localStorage を「上書き」同期（削除含む）
 * - 6/6 未満に戻った場合は complete_seen をリセット
 * - スポット選択UI：画像グリッド（縦3×横2 / 正方形 / 画像クリックで起動）
 * - 画像はオーバーレイ表示時にだけ生成（loading="lazy"）
 * - 任意: URLに ?reset=1 でローカルキャッシュをクリア（テスト用）
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall 側 URL（要置換） ======
 * 例: 'https://yourname.8thwall.app/icu-spot1/'
 */
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/spot1/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  spot4: 'https://maria261081.8thwall.app/spot4/',
  spot5: 'https://maria261081.8thwall.app/spot5/',
  spot6: 'https://maria261081.8thwall.app/spot6/'
};

const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const AR_SPOTS        = ALL_SPOTS.slice();   // 全6箇所 AR
const COMPLETE_TARGET = 6;

/* 表示名（ふち有文字に使用） */
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

/* ====== スタンプ取得状態（Firebase優先 + ローカル同期） ======
 * 成功してリモートが取れた場合：
 *   - ローカルは「リモート内容に合わせて」上書き（true/false/削除）
 *   - 画面反映もリモート準拠
 * 失敗した場合（オフライン等）：
 *   - ローカルのみで反映
 */
async function fetchStampsAndSync(uid) {
  let remote = null;
  let gotRemote = false;

  try {
    const snap = await firebase.database().ref(`users/${uid}/stamps`).once('value'); // v8: once('value')
    remote = snap && typeof snap.val === 'function' ? snap.val() : snap?.val();
    gotRemote = true;
  } catch(e) {
    console.warn('[map] fetch stamps remote failed:', e?.message||e);
  }

  const stamps = {};
  if (gotRemote) {
    // リモートを真実としてローカルへ同期
    ALL_SPOTS.forEach(id=>{
      const val = !!(remote && remote[id]);
      stamps[id] = val;
      if (val) lsSet(lsKeyStamp(uid,id), 'true');
      else     lsRemove(lsKeyStamp(uid,id));
    });
  } else {
    // リモート失敗時はローカルのみ
    ALL_SPOTS.forEach(id=>{
      const local = lsGet(lsKeyStamp(uid,id)) === 'true';
      stamps[id] = local;
    });
  }

  return {stamps, gotRemote};
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
function resetCompleteSeenIfNeeded(uid, stamps){
  const cnt = countCollected(stamps);
  if (cnt < COMPLETE_TARGET) {
    lsRemove(seenKey(uid)); // 未達なら既視フラグを消す
  }
}
async function handleCompletionFlow(uid, stamps){
  const got = countCollected(stamps);
  if (got < COMPLETE_TARGET) return;
  if (lsGet(seenKey(uid)) === 'true') return; // 初回のみ
  openCompleteModal();
  lsSet(seenKey(uid), 'true');
}

/* ====== カメラ起動（スポット選択の写真グリッド） ======
 *  - 正方形 2列（縦3×横2）
 *  - 画像クリックで AR 起動
 *  - 画像は表示時に生成（lazy）
 */
function buildCameraChooserGrid(){
  const list = $('#cameraChooserList');
  if (!list) return;
  list.innerHTML = '';

  // グリッド用クラスを確実に付与（map.html 側 CSS と連動）
  list.className = 'grid-chooser';

  ALL_SPOTS.forEach((id, idx)=>{
    const href = EIGHTHWALL_URLS[id] || '';
    const label = SPOT_LABELS[id] || id.toUpperCase();
    const num   = String(idx+1).padStart(2,'0');
    const src   = `assets/images/current_photos/spot${num}.jpg`;

    // aタグ + 画像 + ラベル（ふち有文字）
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'grid-item';
    a.setAttribute('data-spot', id);
    a.innerHTML = `
      <div class="thumb">
        <img src="${src}" alt="${label}" loading="lazy" />
        <div class="label">${label}</div>
      </div>
    `;
    list.appendChild(a);
  });

  // クリック → AR 起動
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

/* ====== キャッシュ手動リセット（?reset=1） ====== */
function maybeResetLocal(uid){
  const p = new URLSearchParams(location.search);
  if (p.get('reset') === '1') {
    // stamp_ と complete を掃除
    ALL_SPOTS.forEach(id=> lsRemove(lsKeyStamp(uid,id)));
    lsRemove(seenKey(uid));
    console.log('[map] localStorage reset for uid:', uid);
  }
}

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  // 「カメラ起動」→ 写真グリッド
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  const uid = await ensureAnonSafe();
  maybeResetLocal(uid);

  // リモート取得成功ならローカルへ同期。失敗時はローカルのみ。
  const {stamps, gotRemote} = await fetchStampsAndSync(uid);
  renderStampUI(stamps);
  resetCompleteSeenIfNeeded(uid, stamps);
  await handleCompletionFlow(uid, stamps);

  // 復帰時に再反映（毎回リモートと同期を試みる）
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
