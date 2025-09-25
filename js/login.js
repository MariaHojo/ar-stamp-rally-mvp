// js/login.js
// フォーム要件：
// <form id="loginForm">
//   <input id="loginName" ...>
//   <input id="loginPin"  ...>  // 4桁数字
//   <button type="submit">はじめる</button>
// </form>

(async function(){
  function $(s){ return document.querySelector(s); }
  const PEPPER = 'arstamprally_pepper_v1';

  async function sha256Hex(str){
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function normName(name){ return (name||'').trim().toLowerCase().replace(/\s+/g,''); }

  async function computeAccountKey(name, pin){
    const nameKey = normName(name);
    return await sha256Hex(`${nameKey}|${pin}|${PEPPER}`);
  }

  async function ensureFirebaseReady(){
    try{ await window.firebaseReadyPromise; }catch{}
    if(!(window.firebase && firebase.apps && firebase.apps.length)){
      throw new Error('Firebase not initialized');
    }
  }

  async function getNameIndex(nameKey){
    await ensureFirebaseReady();
    const snap = await firebase.database().ref('nameIndex/'+nameKey).once('value');
    return snap.val();
  }

  async function setNameIndex(nameKey, accountKey, displayName){
    await ensureFirebaseReady();
    const now = Date.now();
    await firebase.database().ref('nameIndex/'+nameKey).set({
      accountKey, displayName, createdAt: now
    });
    // プロフィールも作成（既存でも上書き安全）
    await firebase.database().ref('users/'+accountKey+'/profile').update({
      displayName, updatedAt: now
    });
  }

  // 旧ローカルキー掃除
  function cleanupLegacyLocal(){
    try{
      ['spot1','spot2','spot3'].forEach(s => localStorage.removeItem('stamp_'+s));
      localStorage.removeItem('uid'); // 以前の一時保存があれば
    }catch{}
  }

  async function onSubmit(e){
    e.preventDefault();
    const name = $('#loginName')?.value || '';
    const pin  = $('#loginPin')?.value || '';
    if(!name){ alert('ニックネームを入力してください'); return; }
    if(!/^\d{4}$/.test(pin)){ alert('PINは4桁の数字で入力してください'); return; }

    const nameKey = normName(name);
    const accountKey = await computeAccountKey(name, pin);

    // 区別：既存か新規か
    const idx = await getNameIndex(nameKey);
    if(idx && idx.accountKey){
      if(idx.accountKey !== accountKey){
        alert('このニックネームは既に登録済みですが、PINが一致しません。PINを確認してください。');
        return;
      }
      // 既存アカウントでOK（再ログイン）
    }else{
      // 新規登録
      await setNameIndex(nameKey, accountKey, name);
    }

    // ここで「誰であるか」をローカルに保持（全ページ共通で使う）
    try{
      localStorage.setItem('accountKey', accountKey);
      localStorage.setItem('loginName', name);
      // 旧フォーマットのスタンプ残骸掃除
      cleanupLegacyLocal();
    }catch{}

    // マップへ
    location.href = 'map.html';
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    $('#loginForm')?.addEventListener('submit', onSubmit);
  });
})();
