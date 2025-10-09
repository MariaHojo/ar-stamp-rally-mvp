/* map.js（差し替え版）
 * 目的：
 *  - スタンプ帳（6箇所）を Firebase v8 + localStorage で正しく反映
 *  - 6/6 達成で初回のみ完走モーダル表示＆インラインリンク表示
 *  - 「カメラ起動」→ スポット選択吹き出し（6箇所すべて AR 起動）
 *  - 8th Wall 各プロジェクトURLへ遷移（spotId/uid をクエリ付与）
 *  - アンケート送信者だけ “スペシャルコンテンツを見る” を表示（users/{uid}/postSurvey/submitted）
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 8th Wall 側 URL（要置換） ======
 * すべてあなたの実 URL に差し替えてください。
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

/* ====== LocalStorage util ====== */
function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
function lsRemove(k){ try{localStorage.removeItem(k);}catch{} }
function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
function seenKey(uid){ return `complete_6_seen_${uid}`; }
function surveyKey(uid){ return `post_survey_submitted_${uid}`; }  // フォールバック用

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

/* ====== アンケート送信済みの取得 ======
 * post-survey.js が users/{uid}/postSurvey/submitted = true を保存している想定。
 * 併せて localStorage フォールバックも確認。
 */
async function fetchSurveySubmitted(uid){
  // localStorage フォールバック（即時に表示できるよう先に見る）
  const local = lsGet(surveyKey(uid)) === 'true';

  try {
    const snap = await firebase.database().ref(`users/${uid}/postSurvey/submitted`).once('value');
    const remote = !!(snap && snap.val());
    // REMOTE を信用してローカルも同期
    if (remote) lsSet(surveyKey(uid), 'true');
    return remote || local;
  } catch (e) {
    console.warn('[map] fetch surveySubmitted remote failed:', e?.message||e);
    return local; // 失敗時はローカルの値を採用
  }
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

/* ====== カメラ起動（スポット選択の吹き出し） ====== */
function buildCameraChooserItems(){
  const list = $('#cameraChooserList');
  if (!list) return;
  list.innerHTML = '';

  // 2列×3段の写真グリッド
  list.classList.add('grid-chooser');

  ALL_SPOTS.forEach((id, idx)=>{
    const num = String(idx+1).padStart(2,'0');
    const a = document.createElement('a');
    a.className = 'grid-item';
    a.href = 'javascript:void(0)';
    a.setAttribute('data-spot', id);
    a.innerHTML = `
      <div class="thumb">
        <img loading="lazy" src="assets/images/current_photos/spot${num}.jpg" alt="${id}">
        <div class="label"></div>
      </div>
    `;
    list.appendChild(a);
  });

  // ラベルは map.html の文言に合わせる（日本語名）
  const NAMES = {
    spot1:'本館173前', spot2:'トロイヤー記念館（T館）前', spot3:'学生食堂（ガッキ）前',
    spot4:'チャペル前', spot5:'体育館（Pec-A）前', spot6:'本館307前'
  };
  list.querySelectorAll('.grid-item').forEach(a=>{
    const sid = a.getAttribute('data-spot');
    const label = a.querySelector('.label');
    if (label) label.textContent = NAMES[sid] || sid.toUpperCase();
    a.addEventListener('click', async ()=>{
      const uid  = await ensureAnonSafe();
      const base = EIGHTHWALL_URLS[sid];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const url = new URL(base);
      url.searchParams.set('spotId', sid);
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

  // スタンプ反映
  const stamps = await fetchStamps(uid);
  renderStampUI(stamps);
  await handleCompletionFlow(uid, stamps);

  // ★ アンケ送信済みを反映（初期表示）
  const submitted = await fetchSurveySubmitted(uid);
  showSpecialLink(!!submitted);

  // 復帰時に再反映（スタンプ & アンケ済み）
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

  // data-ar-spot / #openAR-spotN（直接ボタンがある場合のフォールバック）
  document.querySelectorAll('[data-ar-spot]').forEach(btn=>{
    btn.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const spot = btn.getAttribute('data-ar-spot');
      const base = EIGHTHWALL_URLS[spot];
      if (!base) { alert('このスポットのAR URLが未設定です'); return; }
      const uid2 = await ensureAnonSafe();
      const url = new URL(base);
      url.searchParams.set('spotId', spot);
      if (uid2) url.searchParams.set('uid', uid2);
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
        const uid2 = await ensureAnonSafe();
        const url = new URL(base);
        url.searchParams.set('spotId', spot);
        if (uid2) url.searchParams.set('uid', uid2);
        location.href = url.toString();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
