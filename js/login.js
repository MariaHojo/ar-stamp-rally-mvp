// js/login.js
// 必須のDOM要素：#loginForm, #loginName, #loginPin
// 任意（あると便利）：#loggedInCard, #currentName, #goMap, #switchAccount

(function(){
  function $(s){ return document.querySelector(s); }
  const PEPPER = 'arstamprally_pepper_v1';

  async function sha256Hex(str){
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function normName(name){ return (name||'').trim().toLowerCase().replace(/\s+/g,''); }
  async function computeAccountKey(name, pin){
    return await sha256Hex(`${normName(name)}|${pin}|${PEPPER}`);
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
    await firebase.database().ref('nameIndex/'+nameKey).set({ accountKey, displayName, createdAt: now });
    await firebase.database().ref('users/'+accountKey+'/profile').update({ displayName, updatedAt: now });
  }

  function cleanupLegacyLocal(){
    try{
      // 旧キー（ユーザー分離なし）を削除
      ['spot1','spot2','spot3'].forEach(s => localStorage.removeItem('stamp_'+s));
      localStorage.removeItem('uid');
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

    const idx = await getNameIndex(nameKey);
    if(idx && idx.accountKey){
      if(idx.accountKey !== accountKey){
        alert('このニックネームは既に登録済みですが、PINが一致しません。PINを確認してください。');
        return;
      }
      // 既存：OK
    }else{
      // 新規：予約
      await setNameIndex(nameKey, accountKey, name);
    }

    try{
      localStorage.setItem('accountKey', accountKey);
      localStorage.setItem('loginName', name);
      cleanupLegacyLocal();
    }catch{}

    location.href = 'map.html';
  }

  function showLoggedInCard(){
    const ak = localStorage.getItem('accountKey');
    const ln = localStorage.getItem('loginName');
    const has = !!ak;
    const card = $('#loggedInCard');
    const sec  = $('#loginSection');

    if(has && card){
      card.classList.remove('hidden');
      $('#currentName') && ($('#currentName').textContent = ln || '(未設定)');
      sec && sec.classList.add('hidden');
    }else{
      card && card.classList.add('hidden');
      sec && sec.classList.remove('hidden');
    }
  }

  function bindSwitch(){
    $('#switchAccount')?.addEventListener('click', ()=>{
      try{
        localStorage.removeItem('accountKey');
        // loginName は残しておくと再入力が楽
      }catch{}
      showLoggedInCard();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // フォーム送信
    $('#loginForm')?.addEventListener('submit', onSubmit);

    // 既存ユーザー表示/切替
    showLoggedInCard();
    bindSwitch();
  });
})();
