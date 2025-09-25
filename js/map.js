/* map.js
   - スタンプ帳UI更新
   - Firebase読取（uid / loginName / url uid / guest をORマージ）
   - localStorageフォールバック
   - ピン：経路案内 + lastSpotId保存
   - カメラ起動：スポット選択の吹き出し → 選択した 8th Wall を起動（uid, loginName を付与）
*/

// ← 3スポットの 8th Wall URL を実URLに置換
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/', // 例
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
};

function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }

function getUid(){
  try{ if (window.firebase?.auth && firebase.auth().currentUser) return firebase.auth().currentUser.uid; }catch{}
  try{ return localStorage.getItem('uid'); }catch{ return null; }
}
function getLoginName(){ try{ return localStorage.getItem('loginName') || null; }catch{ return null; } }
function getUrlUid(){ try{ return new URLSearchParams(location.search).get('uid'); }catch{ return null; } }
function saveLastSpotId(s){ try{ localStorage.setItem('lastSpotId', s); }catch{} }
function getLastSpotId(){ try{ return localStorage.getItem('lastSpotId') || 'spot1'; }catch{ return 'spot1'; } }

function getLocalStampFallback(){
  const key = s => (localStorage.getItem('stamp_'+s) === 'true') || (localStorage.getItem('stamp_'+s) === true);
  try { return { spot1:key('spot1'), spot2:key('spot2'), spot3:key('spot3') }; }
  catch { return { spot1:false, spot2:false, spot3:false }; }
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

function getUserKeyCandidates(){
  const list=[]; const uid=getUid(); const ln=getLoginName(); const qp=getUrlUid();
  if(uid) list.push(uid);
  if(ln && !list.includes(ln)) list.push(ln);
  if(qp && !list.includes(qp)) list.push(qp);
  if(!list.includes('guest')) list.push('guest');
  return list;
}

async function fetchStampsOnce(key){
  try{
    if(!(window.firebase && firebase.apps && firebase.apps.length)) return {};
    const snap = await firebase.database().ref('users/'+key+'/stamps').once('value');
    const v=snap.val()||{}; console.log('[map] fetched',key,v); return v;
  }catch(e){ console.warn('[map] read failed for',key,e?.message||e); return {}; }
}

async function loadAndRenderStamps(){
  const merged = getLocalStampFallback();
  setStampUI(1, !!merged.spot1);
  setStampUI(2, !!merged.spot2);
  setStampUI(3, !!merged.spot3);

  if (window.firebaseReadyPromise) { try{ await window.firebaseReadyPromise; }catch{} }
  if (!(window.firebase && firebase.apps && firebase.apps.length)) {
    console.log('[map] firebase not ready. local only'); return;
  }

  for (const k of getUserKeyCandidates()){
    const v = await fetchStampsOnce(k);
    merged.spot1 = merged.spot1 || !!v.spot1;
    merged.spot2 = merged.spot2 || !!v.spot2;
    merged.spot3 = merged.spot3 || !!v.spot3;
    if (merged.spot1 && merged.spot2 && merged.spot3) break;
  }
  setStampUI(1, !!merged.spot1);
  setStampUI(2, !!merged.spot2);
  setStampUI(3, !!merged.spot3);
}
window.loadAndRenderStamps = loadAndRenderStamps;

function openDirections(lat,lng,label){
  const ll=`${lat},${lng}`;
  saveLastSpotId(label&&/spot\d/i.test(label)?label.toLowerCase():getLastSpotId());
  if (/Android/i.test(navigator.userAgent)) location.href=`geo:${ll}?q=${ll}(${label||''})`;
  else if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) location.href=`http://maps.apple.com/?daddr=${ll}&dirflg=w`;
  else location.href=`https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
}

async function openXRForSpot(spotId){
  spotId = spotId || getLastSpotId() || 'spot1';
  const base = EIGHTHWALL_URLS[spotId];
  if (!base) { alert('このスポットのAR URLが未設定です'); return; }

  if (window.firebaseReadyPromise) { try{ await window.firebaseReadyPromise; }catch{} }
  const uid = getUid() || getLoginName() || 'guest';
  const loginName = getLoginName() || '';
  const url = `${base}?spotId=${encodeURIComponent(spotId)}&uid=${encodeURIComponent(uid)}&loginName=${encodeURIComponent(loginName)}`;
  location.href = url;
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

/* ===== 初期化 ===== */
function initMapPage(){
  // スタンプ帳の開閉
  const toggleBtn=$('#stampToggle'), book=$('#stampBook');
  if (toggleBtn && book){
    const closed=()=>{ book.style.display='none'; toggleBtn.textContent='▼スタンプ帳'; };
    const open  =()=>{ book.style.display='block'; toggleBtn.textContent='▲スタンプ帳'; };
    closed(); toggleBtn.addEventListener('click',()=> (book.style.display==='block'?closed():open()));
  }

  // ピンの経路案内
  $all('.pin').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const lat=parseFloat(btn.dataset.lat), lng=parseFloat(btn.dataset.lng), label=btn.dataset.label||btn.dataset.spot||'spot1';
      saveLastSpotId(btn.dataset.spot||'spot1'); openDirections(lat,lng,label);
    });
  });

  // カメラ起動 → 吹き出しを表示（※直行起動は削除）
  const cam = $('#cameraBtn');
  if (cam) cam.addEventListener('click', () => showCameraChooser());

  // スタンプ初期描画 & 画面復帰時の再取得
  loadAndRenderStamps();
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) loadAndRenderStamps(); });
  window.addEventListener('pageshow', ()=> loadAndRenderStamps());
}

document.addEventListener('DOMContentLoaded', initMapPage);