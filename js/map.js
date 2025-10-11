/* map.js（凍結対策付き・完全差し替え）
   - カメラ選択モーダル：オーバーレイ自動用意、開閉で body スクロール固定/解除、Esc で閉じる
   - i18n と 8th Wall 遷移、スタンプ帳は従来どおり
*/
(function () {
  'use strict';

  const q  = (s)=>document.querySelector(s);
  const qa = (s)=>Array.from(document.querySelectorAll(s));

  /* ====== 8th Wall URL ====== */
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

  /* ====== Lang ====== */
  function getLang(){ try { return localStorage.getItem('app_lang') || 'ja'; } catch { return 'ja'; } }

  /* ====== Labels / Photo ====== */
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

  /* ====== LS util ====== */
  function lsGet(k){ try{return localStorage.getItem(k);}catch{return null;} }
  function lsSet(k,v){ try{localStorage.setItem(k,v);}catch{} }
  function lsKeyStamp(uid, spot){ return `stamp_${uid}_${spot}`; }
  function seenKey(uid){ return `complete_6_seen_${uid}`; }

  /* ====== Auth ====== */
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

  /* ====== Stamps ====== */
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

  /* ====== Complete Modal ====== */
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
    if (lsGet(seenKey(uid)) === 'true') return;
    openCompleteModal();
    lsSet(seenKey(uid), 'true');
  }

  /* ====== Camera chooser ====== */
  function ensureOverlay(){
    // map.html に #cameraChooserOverlay が無い場合は生成
    let ov = q('#cameraChooserOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cameraChooserOverlay';
      ov.className = 'camera-chooser-overlay';
      ov.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ov);
    }
    // クリックで閉じる
    ov.addEventListener('click', hideCameraChooser);
    return ov;
  }

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

    // click → 8th Wall
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
        // 閉じてから遷移（スクロール解除を確実に）
        hideCameraChooser(true);
        location.href = url.toString();
      });
    });
  }

  function lockScroll(lock){
    try{
      if (lock){
        // 現在のスクロール位置を保持して固定
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        document.body.dataset.scrollY = String(scrollY);
        document.body.style.top = `-${scrollY}px`;
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }else{
        const y = parseInt(document.body.dataset.scrollY || '0', 10);
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, y);
        delete document.body.dataset.scrollY;
      }
    }catch{}
  }

  function showCameraChooser(){
    ensureOverlay();
    buildCameraChooserItems(); // 開いた時点の言語で生成
    q('#cameraChooserOverlay')?.classList.add('is-open');
    q('#cameraChooser')?.classList.add('is-open');
    lockScroll(true);
  }
  function hideCameraChooser(keepPos){
    q('#cameraChooserOverlay')?.classList.remove('is-open');
    q('#cameraChooser')?.classList.remove('is-open');
    // keepPos=true ならそのまま（遷移直前用）。通常は解除。
    lockScroll(!keepPos ? false : false);
  }

  /* ====== boot ====== */
  async function boot(){
    bindCompleteModalButtons();

    q('#cameraBtn')?.addEventListener('click', showCameraChooser);
    q('#cameraChooserClose')?.addEventListener('click', ()=> hideCameraChooser(false));
    // Esc で閉じる
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') hideCameraChooser(false);
    });

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
