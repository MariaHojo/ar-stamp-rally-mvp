// complete.js：現在のユーザーでコンプリートか判定し、UIを表示
function getUid(){ try{ if (window.firebase?.auth && firebase.auth().currentUser) return firebase.auth().currentUser.uid; }catch{} try{ return localStorage.getItem('uid'); }catch{ return null; } }
function getLoginName(){ try{ return localStorage.getItem('loginName') || null; }catch{ return null; } }

function getLocalStampFallback(){
  const key = s => (localStorage.getItem('stamp_'+s) === 'true') || (localStorage.getItem('stamp_'+s) === true);
  try { return { spot1:key('spot1'), spot2:key('spot2'), spot3:key('spot3') }; }
  catch { return { spot1:false, spot2:false, spot3:false }; }
}
function getUserKeyCandidates(){
  const list=[]; const uid=getUid(); const ln=getLoginName();
  if(uid) list.push(uid); if(ln && !list.includes(ln)) list.push(ln); if(!list.includes('guest')) list.push('guest');
  return list;
}
async function fetchStampsOnce(key){
  try{
    if(!(window.firebase && firebase.apps && firebase.apps.length)) return {};
    const snap = await firebase.database().ref('users/'+key+'/stamps').once('value');
    return snap.val() || {};
  }catch{ return {}; }
}

async function detectComplete(){
  const merged = getLocalStampFallback();

  if (window.firebaseReadyPromise) { try{ await window.firebaseReadyPromise; }catch{} }
  if (window.firebase && firebase.apps && firebase.apps.length){
    for (const k of getUserKeyCandidates()){
      const v = await fetchStampsOnce(k);
      merged.spot1 = merged.spot1 || !!v.spot1;
      merged.spot2 = merged.spot2 || !!v.spot2;
      merged.spot3 = merged.spot3 || !!v.spot3;
      if (merged.spot1 && merged.spot2 && merged.spot3) break;
    }
  }
  return !!merged.spot1 && !!merged.spot2 && !!merged.spot3;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const ok = await detectComplete();
  const card = document.getElementById('completeCard');
  const noti = document.getElementById('notComplete');
  if (ok) card.style.display = 'block';
  else    noti.style.display = 'block';
});
