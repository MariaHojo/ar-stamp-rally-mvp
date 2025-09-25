/* map.js
   - スタンプ帳UI更新（ユーザー別に分離）
   - Firebase読取：/users/<accountKey>/stamps のみ
   - localStorageフォールバック：stamp_<accountKey>_<spot>
   - ピン：経路案内 + lastSpotId保存
   - カメラ起動：スポット選択の吹き出し → 8th Wall を起動（uid=accountKey, loginName）
   - コンプリートUI：ユーザー別フラグ
*/

const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
};

function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }

// ---- ユーザーキー（必須） ----
function getAccountKey(){ try{ return localStorage.getItem('accountKey') || null; }catch{ return null; } }
function getLoginName(){  try{ return localStorage.getItem('loginName')  || ''; }catch{ return ''; } }

function saveLastSpotId(s){ try{ localStorage.setItem('lastSpotId', s); }catch{} }
function getLastSpotId(){ try{ return localStorage.getItem('lastSpotId') || 'spot1'; }catch{ return 'spot1'; } }

// 旧キー掃除（バグ1対策）
function cleanupLegacyLocal(){
  try{
    ['spot1','spot2','spot3'].forEach(s => localStorage.removeItem('stamp_'+s));
  }catch{}
}

// ---- ローカルフォールバック（ユーザー別） ----
function getLocalStampFallback(){
  const key = getAccountKey() || 'guest';
  const rd = s => {
    try{ return localStorage.getItem(`stamp_${key}_${s}`) === 'true'; }catch{ return false; }
  };
  return { spot1: rd('spot1'), spot2: rd('spot2'), spot3: rd('spot3') };
}

function setStampUI(i, ok){
  const img=$('#stamp'+i+'Img'), ph=$('#stamp'+i+'Placeholder'), st=$('#stamp'+i+'Status');
  if(!img||!ph||!st) return;
  if(ok){
    img.style.display='block'; ph.style.display='none';
    st.textContent='取得済み'; st.classList.remove('not-obtained'); st.classList.add('obtained');
  } else {
    img.style.display='none'; ph.style.display='block'; ph.textContent='未取得';
    st.textContent='未取得'; st.classList.remove('obtained'); st.classList.add('not-obtained');
  }
}

// ---- Firebase 読み取り：/users/<accountKey>/stamps だけ ----
async function fetchStampsOnce(accountKey){
  try{
    if(!(window.firebase && firebase.apps && firebase.apps.length)) return {};
    const snap = await firebase.database().ref('users/'+accountKey+'/stamps').once('value');
    return snap.val() || {};
  }catch(e){
    console.warn('[map] read failed', e?.message||e);
    return {};
  }
}

// 取得＆描画（状態を返す）
async function loadAndRenderStamps(){
  const ak = getAccountKey() || 'guest';
  const merged = getLocalStampFallback();

  setStampUI(1, !!merged.spot1); setStampUI(2, !!merged.spot2); setStampUI(3, !!merged.spot3);

  if (window.firebaseReadyPromise) { try{ await window.firebaseReadyPromise; }catch{} }
  if (!(window.firebase && firebase.apps && firebase.apps.length)) {
    const completeLocal = !!merged.spot1 && !!merged.spot2 && !!merged.spot3;
    return { ...merged, complete: completeLocal };
  }

  const v = await fetchStampsOnce(ak);
  merged.spot1 = !!(merged.spot1 || v.spot1);
  merged.spot2 = !!(merged.spot2 || v.spot2);
  merged.spot3 = !!(merged.spot3 || v.spot3);

  setStampUI(1, merged.spot1); setStampUI(2, merged.spot2); setStampUI(3, merged.spot3);

  const complete = merged.spot1 && merged.spot2 && merged.spot3;
  return { ...merged, complete };
}

// ---- 8th Wall 起動（uid=accountKey を渡す）----
async function openXRForSpot(spotId){
  spotId = spotId || getLastSpotId() || 'spot1';
  const base = EIGHTHWALL_URLS[spotId];
  if (!base) { alert('このスポットのAR URLが未設定です'); return; }

  if (window.firebaseReadyPromise) { try{ await window.firebaseReadyPromise; }catch{} }
  const accountKey = getAccountKey() || 'guest';
  const loginName  = getLoginName() || '';
  const url = `${base}?spotId=${encodeURIComponent(spotId)}&uid=${encodeURIComponent(accountKey)}&loginName=${encodeURIComponent(loginName)}`;
  location.href = url;
}

// ---- 地図アプリで経路案内 ----
function openDirections(lat,lng,label){
  const ll=`${lat},${lng}`;
  saveLastSpotId(label && /spot\d/i.test(label) ? label.toLowerCase() : getLastSpotId());
  if (/Android/i.test(navigator.userAgent)) {
    location.href = `geo:${ll}?q=${ll}(${label||''})`;
  } else if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
    location.href = `http://maps.apple.com/?daddr=${ll}&dirflg=w`;
  } else {
    location.href = `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
  }
}

/* ===== カメラ起動：スポット選択の吹き出し ===== */
function getAvailableSpots() {
  const items = [];
  for (const spotId of ['spot1','spot2','spot3']) {
    const url = EIGHTHWALL_URLS[spotId];
    if (url && /^https?:\/\//i.test(url) && !/YOUR-8THWALL-URL/i.test(url)) {
      items.push({ spotId, label: `スポット${spotId.replace('spot','')}` });
    }
  }
  return items;
}

function showCameraChooser() {
  const overlay = document.getElementById('cameraChooserOverlay');
  const chooser = document.getElementById('cameraChooser');
  const list    = document.getElementById('cameraChooserList');
  const close   = document.getElementById('cameraChooserClose');
  if (!overlay || !chooser || !list || !close) return;

  list.innerHTML = '';
  const items = getAvailableSpots();

  if (items.length === 1) {
    saveLastSpotId(items[0].spotId);
    openXRForSpot(items[0].spotId);
    return;
  }

  items.forEach(({ spotId, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item-btn';
    btn.dataset.spot = spotId;
    btn.innerHTML = `<strong>${label}</strong> のARを起動`;
    btn.addEventListener('click', () => {
      hideCameraChooser();
      saveLastSpotId(spotId);
      openXRForSpot(spotId);
    });
    list.appendChild(btn);
  });

  overlay.hidden = false;
  chooser.hidden = false;

  const onClose = () => hideCameraChooser();
  overlay.addEventListener('click', onClose, { once: true });
  close.addEventListener('click', onClose, { once: true });

  function onKey(e) { if (e.key === 'Escape') { hideCameraChooser(); document.removeEventListener('keydown', onKey); } }
  document.addEventListener('keydown', onKey);
}

function hideCameraChooser() {
  const overlay = document.getElementById('cameraChooserOverlay');
  const chooser = document.getElementById('cameraChooser');
  if (overlay) overlay.hidden = true;
  if (chooser) chooser.hidden = true;
}

/* ===== コンプリートUI：ユーザー別フラグ ===== */
function getFlagKeys(){
  const key = getAccountKey() || 'guest';
  return {
    seenKey: `complete_seen_${key}`,
    linkKey: `complete_link_enabled_${key}`,
  };
}
function setLocalFlag(k, val){ try{ localStorage.setItem(k, String(!!val)); }catch{} }
function getLocalFlag(k){ try{ return localStorage.getItem(k) === 'true'; }catch{ return false; } }

function setCompleteLinkVisible(visible){
  const area = document.getElementById('completeLinkArea');
  if (!area) return;
  area.style.display = visible ? 'block' : 'none';
}
function showCompleteOverlay(){ const ov = document.getElementById('completeOverlay'); if (ov) ov.style.display = 'block'; }
function hideCompleteOverlay(){ const ov = document.getElementById('completeOverlay'); if (ov) ov.style.display = 'none'; }

async function handleCompletionUI(state){
  if (!state?.complete) {
    const { linkKey } = getFlagKeys();
    if (!getLocalFlag(linkKey)) setCompleteLinkVisible(false);
    return;
  }
  const { seenKey, linkKey } = getFlagKeys();
  if (getLocalFlag(seenKey)) { setCompleteLinkVisible(true); return; }

  showCompleteOverlay();
  const closeBtn  = document.getElementById('completeClose');
  const laterBtn  = document.getElementById('completeLater');
  const closeOnce = () => {
    hideCompleteOverlay();
    setLocalFlag(seenKey, true);
    setLocalFlag(linkKey, true);
    setCompleteLinkVisible(true);
    closeBtn?.removeEventListener('click', closeOnce);
    laterBtn?.removeEventListener('click', closeOnce);
  };
  closeBtn?.addEventListener('click', closeOnce);
  laterBtn?.addEventListener('click', closeOnce);
}

async function bootCompletionFlow(){
  const state = await loadAndRenderStamps();
  await handleCompletionUI(state);
}

/* ===== 初期化 ===== */
function initMapPage(){
  cleanupLegacyLocal(); // ← 旧キー掃除（重要）

  const toggleBtn=$('#stampToggle'), book=$('#stampBook');
  if (toggleBtn && book){
    const closed=()=>{ book.style.display='none'; toggleBtn.textContent='▼スタンプ帳'; };
    const open  =()=>{ book.style.display='block'; toggleBtn.textContent='▲スタンプ帳'; };
    closed(); toggleBtn.addEventListener('click',()=> (book.style.display==='block'?closed():open()));
  }

  $all('.pin').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const lat=parseFloat(btn.dataset.lat), lng=parseFloat(btn.dataset.lng), label=btn.dataset.label||btn.dataset.spot||'spot1';
      saveLastSpotId(btn.dataset.spot||'spot1');
      openDirections(lat,lng,label);
    });
  });

  const cam = $('#cameraBtn');
  if (cam) cam.addEventListener('click', () => showCameraChooser());

  bootCompletionFlow();
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) bootCompletionFlow(); });
  window.addEventListener('pageshow', ()=> bootCompletionFlow());
}
document.addEventListener('DOMContentLoaded', initMapPage);
