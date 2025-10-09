/* map.js（差し替え版：iOS表示 & アンケ反映修正）
 * 目的：
 *  - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 *  - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 *  - 「カメラ起動」→ スポット選択吹き出し（写真グリッド 2×3）
 *  - 8th Wall 各プロジェクトURLへ遷移（spotId/uid をクエリ付与）
 *  - アンケ送信者だけ “スペシャルコンテンツを見る” を表示（複数パスを走査）
 *  - モバイル(iOS Safari含む)で写真が出ない問題対応：.list→.grid-chooserへ置換、lazy無効、確実に読み込み
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall 側 URL（要置換） ====== */
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/spot1/', // ←実URLに置換
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
  spot4: 'https://maria261081.8thwall.app/spot4/',
  spot5: 'https://maria261081.8thwall.app/spot5/',
  spot6: 'https://maria261081.8thwall.app/spot6/'
};

const ALL_SPOTS       = ['spot1','spot2','spot3','spot4','spot5','spot6'];
const COMPLETE_TARGET = 6;

/* ====== LocalStorage util ====== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsRemove(k){ try{localStorage.removeItem(k);}catch{} }

function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }
function surveyKey(uid){ return `post_survey_submitted_${uid}`; }  // フォールバック

/* ====== Auth（匿名） ====== */
async function ensureAnonSafe() {
  // 既存 ensureAnon 優先
  if (typeof window.ensureAnon === 'function') {
    try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
  }
  // v8 フォールバック
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

/* ====== スタンプ取得状態 ====== */
async function fetchStamps(uid) {
  let remote = null;
  try {
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

/* ====== アンケ送信済みの取得（複数パス対応） ======
 * どれか true になっていればOK：
 * - users/{uid}/postSurvey/submitted
 * - users/{uid}/survey/submitted
 * - surveys/{uid}/submitted
 * さらに localStorage フォールバック（post_survey_submitted_${uid}）
 */
async function fetchSurveySubmitted(uid){
  const local = lsGet(surveyKey(uid)) === 'true';
  let remote = false;

  async function read(path){
    try {
      const snap = await firebase.database().ref(path).once('value');
      return !!(snap && snap.val());
    } catch(e) {
      return false;
    }
  }

  // 複数パスを順にチェック
  const paths = [
    `users/${uid}/postSurvey/submitted`,
    `users/${uid}/survey/submitted`,
    `surveys/${uid}/submitted`,
  ];
  for (const p of paths) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await read(p);
    if (ok) { remote = true; break; }
  }

  if (remote) lsSet(surveyKey(uid), 'true');
  return remote || local;
}

/* ====== スタンプ帳 UI ====== */
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

function showSpecialLink(visible){
  const el = $('#specialInline');
  if (!el) return;
  el.style.display = visible ? 'block' : 'none';
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

/* ====== カメラ起動（スポット選択の吹き出し） ======
 * iOS Safari で画像が出ない主因：
 *  - コンテナに .list（1列CSS）が残っていて、.grid-chooser のレイアウトが効かない
 *  - lazy=“lazy” が古いSafariで効かず読み込まれないことがある
 * 対策：
 *  - class を完全に置換：list → grid-chooser
 *  - lazy は使わず即ロード（decoding=“async” はOK）
 *  - onerror プレースホルダ
 */
function buildCameraChooserItems(){
  const container = $('#cameraChooserList');
  if (!container) return;

  // class を完全に置換：*.list → grid-chooser
  container.className = 'grid-chooser';
  container.innerHTML = '';

  const NAMES = {
    spot1:'本館173前', spot2:'トロイヤー記念館（T館）前', spot3:'学生食堂（ガッキ）前',
    spot4:'チャペル前', spot5:'体育館（Pec-A）前', spot6:'本館307前'
  };

  ALL_SPOTS.forEach((id, idx)=>{
    const num = String(idx+1).padStart(2,'0');
    const a = document.createElement('a');
    a.className = 'grid-item';
    a.href = 'javascript:void(0)';
    a.setAttribute('data-spot', id);

    // 画像要素（lazyは使わない）
    const img = new Image();
    img.src = `assets/images/current_photos/spot${num}.jpg`;
    img.alt = NAMES[id] || id.toUpperCase();
    img.decoding = 'async';
    img.onerror = () => {
      // 何かしらの理由で読み込めない場合は薄いプレースホルダ
      img.removeAttribute('src');
      img.style.background = '#eef3ff';
    };

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.appendChild(img);

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = NAMES[id] || id.toUpperCase();
    thumb.appendChild(label);

    a.appendChild(thumb);
    container.appendChild(a);

    // クリックで AR 起動
    a.addEventListener('click', async ()=>{
      const uid  = await ensureAnonSafe();
      const base = EIGHTHWALL_URLS[id];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const url = new URL(base);
      url.searchParams.set('spotId', id);
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

/* ====== 起動 ====== */
async function boot(){
  bindCompleteModalButtons();

  // 「カメラ起動」→ 吹き出し
  $('#cameraBtn')?.addEventListener('click', showCameraChooser);
  $('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
  $('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

  // サインイン
  const uid = await ensureAnonSafe();

  // スタンプ UI
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // アンケ送信済み反映（初期）
  const submitted = await fetchSurveySubmitted(uid);
  showSpecialLink(!!submitted);

  // 復帰時の再反映（スタンプ & アンケ）
  document.addEventListener('visibilitychange', async ()=>{
    if (document.visibilityState === 'visible') {
      const s = await fetchStamps(uid);
      renderStampUI(s);
      await handleCompletionFlow(uid, s);
      const sub = await fetchSurveySubmitted(uid);
      showSpecialLink(!!sub);
    }
  });
  window.addEventListener('pageshow', async ()=>{
    const s = await fetchStamps(uid);
    renderStampUI(s);
    await handleCompletionFlow(uid, s);
    const sub = await fetchSurveySubmitted(uid);
    showSpecialLink(!!sub);
  });
}

document.addEventListener('DOMContentLoaded', boot);
