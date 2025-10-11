/* map.js（完全差し替え）
 * - 変数の二重宣言を避けるため IIFE でスコープを閉じる
 * - 予約風記号 $/$$ は使わず q/qa を使用
 * - スポット選択/スタンプ帳の文言を i18n（app_lang）に追従
 * - 8th Wall への遷移、スタンプ状態の反映、完走モーダルは従来通り
 */
(function () {
  'use strict';

  const q  = (s)=>document.querySelector(s);
  const qa = (s)=>Array.from(document.querySelectorAll(s));

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
  const COMPLETE_TARGET = 6;

  /* ====== 言語 ====== */
  function getLang(){ try { return localStorage.getItem('app_lang') || 'ja'; } catch { return 'ja'; } }

  /* ====== 表示名・写真パス（i18n） ====== */
  const SPOT_LABELS = {
    ja: {
      spot1: '本館173前',
      spot2: 'トロイヤー記念館（T館）前',
      spot3: '学生食堂（ガッキ）前',
      spot4: 'チャペル前',
      spot5: '体育館（Pec-A）前',
      spot6: '本館307前',
    },
    en: {
      spot1: 'In front of Main Building 173',
      spot2: 'In front of Troyer Memorial (T Bldg.)',
      spot3: 'In front of Student Cafeteria',
      spot4: 'In front of the Chapel',
      spot5: 'In front of Gym (Pec-A)',
      spot6: 'In front of Main Building 307',
    }
  };
  function spotLabel(spotId, lang = getLang()){
    return (SPOT_LABELS[lang] && SPOT_LABELS[lang][spotId]) || (SPOT_LABELS.ja[spotId] || spotId.toUpperCase());
  }
  function photoSrc(spotId){
    const nn = String(spotId.replace('spot','')).padStart(2,'0');
    return `assets/images/current_photos/spot${nn}.JPG`;
  }

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

  /* ====== スタンプ帳 UI 反映（i18n） ====== */
  function renderStampUI(stamps){
    const lang = getLang();
    const txtGot = (lang==='en') ? 'Collected' : '取得済';
    const txtNot = (lang==='en') ? 'Not collected' : '未取得';

    qa('.stamp-cell[data-spot]').forEach(cell=>{
      const spot = cell.dataset.spot;
      const got  = !!stamps[spot];
      cell.classList.toggle('is-got', got);
      const mark = cell.querySelector('.mark');
      if (mark) mark.textContent = got ? txtGot : txtNot;
    });

    const cnt = ALL_SPOTS.reduce((n,id)=> n + (stamps[id] ? 1 : 0), 0);
    const elCount = q('#stampCount');
    if (elCount) elCount.textContent = `${cnt}/${ALL_SPOTS.length}`;

    const inline = q('#completeInline');
    if (inline) inline.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
    const special = q('#specialInline');
    if (special) special.style.display = (cnt >= COMPLETE_TARGET) ? 'block' : 'none';
  }

  /* ====== 完走モーダル ====== */
  function openCompleteModal(){
    q('#completeOverlay')?.classList.add('is-open');
    q('#completeModal')?.classList.add('is-open');
  }
  function closeCompleteModal(){
    q('#completeOverlay')?.classList.remove('is-open');
    q('#completeModal')?.classList.remove('is-open');
  }
  function bindCompleteModalButtons(){
    q('#closeComplete')?.addEventListener('click', closeCompleteModal);
    q('#completeOverlay')?.addEventListener('click', closeCompleteModal);
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
    const list = q('#cameraChooserList');
    if (!list) return;
    list.innerHTML = '';

    const lang = getLang();

    ALL_SPOTS.forEach((id)=>{
      const name = spotLabel(id, lang);
      const src  = photoSrc(id);

      const item = document.createElement('div');
      item.className = 'item';
      item.setAttribute('data-spot', id);
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

    list.querySelectorAll('a.photoLink[data-spot]').forEach(a=>{
      a.addEventListener('click', async (ev)=>{
        ev.preventDefault();
        const spot = a.getAttribute('data-spot');
        const base = EIGHTHWALL_URLS[spot];
        if (!base) {
          alert(getLang()==='en' ? 'AR URL is not set for this spot.' : 'このスポットのAR URLが未設定です');
          return;
        }
        const uid  = await ensureAnonSafe();
        const url  = new URL(base);
        url.searchParams.set('spotId', spot);
        if (uid) url.searchParams.set('uid', uid);
        location.href = url.toString();
      });
    });
  }
  function showCameraChooser(){
    buildCameraChooserItems(); // 開いた時点の言語で生成
    q('#cameraChooserOverlay')?.classList.add('is-open');
    q('#cameraChooser')?.classList.add('is-open');
  }
  function hideCameraChooser(){
    q('#cameraChooserOverlay')?.classList.remove('is-open');
    q('#cameraChooser')?.classList.remove('is-open');
  }

  /* ====== 起動 ====== */
  async function boot(){
    bindCompleteModalButtons();

    q('#cameraBtn')?.addEventListener('click', showCameraChooser);
    q('#cameraChooserClose')?.addEventListener('click', hideCameraChooser);
    q('#cameraChooserOverlay')?.addEventListener('click', hideCameraChooser);

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

    // data-ar-spot / #openAR-spotN フォールバック
    document.querySelectorAll('[data-ar-spot]').forEach(btn=>{
      btn.addEventListener('click', async (ev)=>{
        ev.preventDefault();
        const spot = btn.getAttribute('data-ar-spot');
        const base = EIGHTHWALL_URLS[spot];
        if (!base) {
          alert(getLang()==='en' ? 'AR URL is not set for this spot.' : 'このスポットのAR URLが未設定です');
          return;
        }
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
          if (!base) {
            alert(getLang()==='en' ? 'AR URL is not set for this spot.' : 'このスポットのAR URLが未設定です');
            return;
          }
          const uid = await ensureAnonSafe();
          const url = new URL(base);
          url.searchParams.set('spotId', spot);
          if (uid) url.searchParams.set('uid', uid);
          location.href = url.toString();
        });
      }
    }

    // 言語切替に追従（モーダル開いていれば再生成）
    window.addEventListener('app_lang_changed', async ()=>{
      const s = await fetchStamps(uid);
      renderStampUI(s);
      if (q('#cameraChooser')?.classList.contains('is-open')) buildCameraChooserItems();
    });
    window.addEventListener('storage', async (e)=>{
      if (e.key === 'app_lang') {
        const s = await fetchStamps(uid);
        renderStampUI(s);
        if (q('#cameraChooser')?.classList.contains('is-open')) buildCameraChooserItems();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
