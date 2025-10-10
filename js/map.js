/* map.js（言語切替対応・差し替え版）
 * 目的：
 *  - 既存機能維持：スタンプ帳、コンプリート表示、カメラ起動の写真グリッド、8th Wall 起動
 *  - 言語切替（日本語/English）：テキストのみ動的置換（localStorage に保存）
 */

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

/* ====== 言語設定 ====== */
const LANG_KEY = 'lang';
function getLang(){ try{ return localStorage.getItem(LANG_KEY) || 'ja'; } catch{ return 'ja'; } }
function setLang(lang){ try{ localStorage.setItem(LANG_KEY, lang); } catch{} }

const I18N = {
  ja: {
    docTitle: 'マップ | ARスタンプラリー',
    termsLink: 'プライバシーポリシー・ご利用上の注意',
    tutorialLink: 'チュートリアル',
    stampbookTitle: 'スタンプ帳',
    notCollected: '未取得',
    collectedMark: '✅取得済',
    completeLink: '🎉 コンプリートを確認する',
    specialLink: '🌟 スペシャルコンテンツを見る',
    mapHint: '地図のピンをタップするとスタンプ配置場所までの案内が出ます！（別アプリへ移動）',
    camChooserTitle: 'スポットを選んでください',
    camChooserDesc: '写真をタップするとARが起動します。',
    close: '閉じる',
    cameraStart: 'カメラ起動',
    completeTitle: '🎉 コンプリート！',
    completeLead: '全てのスタンプを集めました。ご参加ありがとうございます！',
    backToMap: 'マップに戻る',
    toSurvey: 'アンケートへ（お答えいただいた方にはスペシャルコンテンツがあります！）',
    spots: {
      spot1: '本館173前',
      spot2: 'トロイヤー記念館（T館）前',
      spot3: '学生食堂（ガッキ）前',
      spot4: 'チャペル前',
      spot5: '体育館（Pec-A）前',
      spot6: '本館307前',
    }
  },
  en: {
    docTitle: 'Map | AR Stamp Rally',
    termsLink: 'Privacy Policy & Notes',
    tutorialLink: 'Tutorial',
    stampbookTitle: 'Stamp Book',
    notCollected: 'Not collected',
    collectedMark: 'Collected',
    completeLink: '🎉 View “Complete”',
    specialLink: '🌟 View Special Contents',
    mapHint: 'Tap a map pin to open directions to the stamp location (opens external app).',
    camChooserTitle: 'Choose a Spot',
    camChooserDesc: 'Tap a photo to launch AR.',
    close: 'Close',
    cameraStart: 'Open Camera',
    completeTitle: '🎉 Complete!',
    completeLead: 'You collected all stamps. Thank you for participating!',
    backToMap: 'Back to Map',
    toSurvey: 'Go to Survey (Special contents after answering!)',
    spots: {
      spot1: 'In Front of Main Hall 173',
      spot2: 'In Front of Troyer Memorial (T Bldg.)',
      spot3: 'In Front of Student Cafeteria',
      spot4: 'In Front of Chapel',
      spot5: 'In Front of Gymnasium (Pec-A)',
      spot6: 'In Front of Main Hall 307',
    }
  }
};

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
const AR_SPOTS        = ALL_SPOTS.slice();
const COMPLETE_TARGET = 6;

/* ====== 表示名（言語連動）・写真パス ====== */
function spotLabel(spotId){
  const lang = getLang();
  return I18N[lang].spots[spotId] || spotId.toUpperCase();
}
const photoSrc = (spotId) => {
  const nn = String(spotId.replace('spot','')).padStart(2,'0');
  // 拡張子は JPG 想定（必要なら .jpg に合わせる）
  return `assets/images/current_photos/spot${nn}.JPG`;
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

/* ====== i18n を画面に適用 ====== */
function applyI18n(){
  const lang = getLang();
  const t = I18N[lang];

  // <html lang="">
  try { document.documentElement.setAttribute('lang', lang); } catch {}

  // タイトル
  document.title = t.docTitle;

  // 上部リンク／ラベル
  $('#termsLink') && ($('#termsLink').textContent = t.termsLink);
  $('#tutorialLink') && ($('#tutorialLink').textContent = t.tutorialLink);
  $('#stampbookTitle') && ($('#stampbookTitle').textContent = t.stampbookTitle);

  // 地図ヒント
  $('#mapHint') && ($('#mapHint').textContent = t.mapHint);

  // カメラ選択モーダル
  $('#cameraChooserTitle') && ($('#cameraChooserTitle').textContent = t.camChooserTitle);
  $('#cameraChooserDesc') && ($('#cameraChooserDesc').textContent = t.camChooserDesc);
  $('#cameraChooserClose') && ($('#cameraChooserClose').textContent = t.close);
  $('#cameraBtn') && ($('#cameraBtn').textContent = t.cameraStart);

  // 完走モーダル
  $('#completeTitle') && ($('#completeTitle').textContent = t.completeTitle);
  $('#completeLead') && ($('#completeLead').textContent = t.completeLead);
  $('#closeComplete') && ($('#closeComplete').textContent = t.backToMap);
  $('#toSurvey') && ($('#toSurvey').textContent = t.toSurvey);

  // インラインリンク（見出し直下）
  $('#completeLink') && ($('#completeLink').textContent = t.completeLink);
  $('#specialLink') && ($('#specialLink').textContent = t.specialLink);

  // スタンプ帳のスポット名
  $$('[data-spot-name]').forEach(el=>{
    const id = el.getAttribute('data-spot-name');
    el.textContent = spotLabel(id);
  });

  // 取得/未取得表示は renderStampUI 内で（言語連動）
}

/* ====== スタンプ帳 UI 反映 ====== */
function renderStampUI(stamps){
  const lang = getLang();
  const t = I18N[lang];

  $$('.stamp-cell[data-spot]').forEach(cell=>{
    const spot = cell.dataset.spot;
    const got  = !!stamps[spot];
    cell.classList.toggle('is-got', got);
    const mark = cell.querySelector('.mark');
    if (mark) mark.textContent = got ? t.collectedMark : t.notCollected;
  });

  const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
  const elCount = $('#stampCount');
  if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

  const inline = $('#completeInline');
  if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';

  const special = $('#specialInline');
  if (special) special.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
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

  ALL_SPOTS.forEach((id)=>{
    const name = spotLabel(id);
    const src  = photoSrc(id);

    const item = document.createElement('div');
    item.className = 'item';
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
  buildCameraChooserItems(); // 開いた時点で生成
  $('#cameraChooserOverlay')?.classList.add('is-open');
  $('#cameraChooser')?.classList.add('is-open');
}
function hideCameraChooser(){
  $('#cameraChooserOverlay')?.classList.remove('is-open');
  $('#cameraChooser')?.classList.remove('is-open');
}

/* ====== 言語 UI バインド ====== */
function bindLanguageUI(){
  const btn  = $('#langBtn');
  const menu = $('#langMenu');
  if (!btn || !menu) return;

  const toggle = ()=>{
    const open = menu.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });
  document.addEventListener('click', (e)=>{
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
    }
  });
  menu.querySelectorAll('button[data-lang]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const lang = b.getAttribute('data-lang');
      setLang(lang);
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
      applyI18n();            // ラベル等差し替え
      // カメラ選択モーダルを開いていた場合の名札を再生成
      if ($('#cameraChooser')?.classList.contains('is-open')) {
        buildCameraChooserItems();
      }
    });
  });
}

/* ====== 起動 ====== */
async function boot(){
  bindLanguageUI();
  applyI18n();

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
      applyI18n(); // ついでにラベルも同期
    }
  });
  window.addEventListener('pageshow', async ()=>{
    const s = await fetchStamps(uid);
    renderStampUI(s);
    await handleCompletionFlow(uid, s);
    applyI18n();
  });

  // data-ar-spot / #openAR-spotN（フォールバック）
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
