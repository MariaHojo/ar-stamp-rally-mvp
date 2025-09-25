/* map.js（匿名UID専用）
   - スタンプUI更新（users/{uid}/stamps を読む）
   - ローカルフォールバックは uid 名前空間付き
   - カメラ起動：スポット選択 → 8th Wall へ uid を付与
   - 完了検知：初回は complete.html へ自動遷移。その後はリンク常時表示
*/

// ← 3スポットの 8th Wall URL を実URLに置換
const EIGHTHWALL_URLS = {
  spot1: 'https://maria261081.8thwall.app/test-3/',
  spot2: 'https://maria261081.8thwall.app/spot2/',
  spot3: 'https://maria261081.8thwall.app/spot3/',
};

function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }

function getUidSync(){ try{ return firebase?.auth?.()?.currentUser?.uid || localStorage.getItem('uid'); }catch{ return null; } }
function lsKey(spot){ const uid=getUidSync() || 'nouid'; return `stamp_${uid}_${spot}`; }

function getLocalStampFallback(){
  try {
    return {
      spot1: localStorage.getItem(lsKey('spot1')) === 'true',
      spot2: localStorage.getItem(lsKey('spot2')) === 'true',
      spot3: localStorage.getItem(lsKey('spot3')) === 'true',
    };
  } catch { return { spot1:false, spot2:false, spot3:false }; }
}
function persistLocalStamps(v){
  try {
    if (typeof v.spot1 !== 'undefined') localStorage.setItem(lsKey('spot1'), String(!!v.spot1));
    if (typeof v.spot2 !== 'undefined') localStorage.setItem(lsKey('spot2'), String(!!v.spot2));
    if (typeof v.spot3 !== 'undefined') localStorage.setItem(lsKey('spot3'), String(!!v.spot3));
  } catch {}
}

function setStampUI(i, ok){
  const img=$('#stamp'+i+'Img'), ph=$('#stamp'+i+'Placeholder'), st=$('#stamp'+i+'Status');
  if(!img||!st||!ph) return;
  if(ok){ img.style.display='block'; ph.style.display='none'; st.textContent='取得済み'; st.classList.add('obtained'); st.classList.remove('not-obtained'); }
  else { img.style.display='none'; ph.style.display='block'; ph.textContent='未取得'; st.textContent='未取得'; st.classList.add('not-obtained'); st.classList.remove('obtained'); }
}

async function loadAndRenderStamps(){
  const merged = getLocalStampFallback();
  setStampUI(1, !!merged.spot1); setStampUI(2, !!merged.spot2); setStampUI(3, !!merged.spot3);

  const uid = await window.ensureAnon();
  const db = firebase.database();
  try {
    const snap = await db.ref(`users/${uid}/stamps`).once('value');
    const v = snap.val() || {};
    merged.spot1 = !!v.spot1;
    merged.spot2 = !!v.spot2;
    merged.spot3 = !!v.spot3;
    persistLocalStamps(merged);
  } catch(e) {
    console.warn('[map] fetch failed:', e?.message||e);
  }

  setStampUI(1, !!merged.spot1); setStampUI(2, !!merged.spot2); setStampUI(3, !!merged.spot3);
  const complete = !!merged.spot1 && !!merged.spot2 && !!merged.spot3;
  return { ...merged, complete };
}

function saveLastSpotId(s){ try{ localStorage.setItem('lastSpotId', s); }catch{} }
function getLastSpotId(){ try{ return localStorage.getItem('lastSpotId') || 'spot1'; }catch{ return 'spot1'; } }

/* ===== カメラ起動：スポット選択 ===== */
function getAvailableSpots(){
  const items=[];
  for (const spotId of ['spot1','spot2','spot3']){
    const url=EIGHTHWALL_URLS[spotId];
    if (url && /^https?:\/\//i.test(url)) items.push({ spotId, label:`スポット${spotId.replace('spot','')}` });
  }
  return items;
}
function showCameraChooser(){
  const overlay=$('#cameraChooserOverlay'), chooser=$('#cameraChooser'), list=$('#cameraChooserList'), close=$('#cameraChooserClose');
  if(!overlay||!chooser||!list||!close) return;
  list.innerHTML='';
  const items=getAvailableSpots();
  if(items.length===1){ saveLastSpotId(items[0].spotId); openXRForSpot(items[0].spotId); return; }
  items.forEach(({spotId,label})=>{
    const btn=document.createElement('button');
    btn.type='button'; btn.className='item-btn'; btn.dataset.spot=spotId;
    btn.innerHTML=`<strong>${label}</strong> のARを起動`;
    btn.addEventListener('click',()=>{ hideCameraChooser(); saveLastSpotId(spotId); openXRForSpot(spotId); });
    list.appendChild(btn);
  });
  overlay.hidden=false; chooser.hidden=false;
  const onClose=()=>hideCameraChooser();
  overlay.addEventListener('click', onClose, {once:true});
  close.addEventListener('click', onClose, {once:true});
}
function hideCameraChooser(){ $('#cameraChooserOverlay')?.setAttribute('hidden',''); $('#cameraChooser')?.setAttribute('hidden',''); }

async function openXRForSpot(spotId){
  spotId = spotId || getLastSpotId() || 'spot1';
  const base = EIGHTHWALL_URLS[spotId];
  if (!base) { alert('このスポットのAR URLが未設定です'); return; }
  const uid = await window.ensureAnon();
  const url = `${base}?spotId=${encodeURIComponent(spotId)}&uid=${encodeURIComponent(uid)}`;
  location.href = url;
}

/* ===== 完了UI（初回は自動遷移、以後はリンク表示） ===== */
function completeFlagKeys(){
  const uid = getUidSync() || 'nouid';
  return {
    redirectedKey: `complete_redirected_${uid}`, // 初回遷移したか
    linkKey:       `complete_link_enabled_${uid}`, // 常時リンク表示
  };
}
function setLocalFlag(k,val){ try{ localStorage.setItem(k, String(!!val)); }catch{} }
function getLocalFlag(k){ try{ return localStorage.getItem(k)==='true'; }catch{ return false; } }
function setCompleteLinkVisible(v){ const area=$('#completeLinkArea'); if(area) area.style.display = v ? 'block':'none'; }

async function handleCompletionFlow(state){
  const { redirectedKey, linkKey } = completeFlagKeys();
  if(!state?.complete){
    if(!getLocalFlag(linkKey)) setCompleteLinkVisible(false);
    return;
  }
  // すでに遷移済み → リンクだけ表示
  if(getLocalFlag(redirectedKey)){
    setLocalFlag(linkKey, true);
    setCompleteLinkVisible(true);
    return;
  }
  // 初達成：complete.html へ遷移（戻ってきたらリンク常時表示）
  setLocalFlag(redirectedKey, true);
  setLocalFlag(linkKey, true);
  setCompleteLinkVisible(true);
  location.href = 'complete.html';
}

/* ===== ページ初期化 ===== */
function openDirections(lat,lng,label){
  const ll=`${lat},${lng}`;
  saveLastSpotId(label&&/spot\d/i.test(label)?label.toLowerCase():getLastSpotId());
  if(/Android/i.test(navigator.userAgent)) location.href=`geo:${ll}?q=${ll}(${label||''})`;
  else if(/iPad|iPhone|iPod/i.test(navigator.userAgent)) location.href=`http://maps.apple.com/?daddr=${ll}&dirflg=w`;
  else location.href=`https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=walking`;
}

async function boot(){
  await window.ensureAnon();
  // スタンプ帳の開閉
  const toggleBtn=$('#stampToggle'), book=$('#stampBook');
  if(toggleBtn && book){
    const closed=()=>{ book.style.display='none'; toggleBtn.textContent='▼スタンプ帳'; };
    const open=()=>{ book.style.display='block'; toggleBtn.textContent='▲スタンプ帳'; };
    closed(); toggleBtn.addEventListener('click', ()=> (book.style.display==='block'?closed():open()));
  }
  // ピン → 経路案内
  $all('.pin').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const lat=parseFloat(btn.dataset.lat), lng=parseFloat(btn.dataset.lng), label=btn.dataset.label||btn.dataset.spot||'spot1';
      saveLastSpotId(btn.dataset.spot||'spot1'); openDirections(lat,lng,label);
    });
  });
  // カメラ起動 → 吹き出し
  $('#cameraBtn')?.addEventListener('click', ()=> showCameraChooser());

  const state = await loadAndRenderStamps();
  await handleCompletionFlow(state);

  document.addEventListener('visibilitychange', async ()=>{ if(!document.hidden){ const s = await loadAndRenderStamps(); await handleCompletionFlow(s); } });
  window.addEventListener('pageshow', async ()=>{ const s = await loadAndRenderStamps(); await handleCompletionFlow(s); });
}
document.addEventListener('DOMContentLoaded', boot);
