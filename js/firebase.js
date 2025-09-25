// js/firebase.js - 動的ロード + 匿名サインイン + 準備完了Promise
(function(){
  const CDN = 'https://www.gstatic.com/firebasejs/8.10.1/';
  const CONFIG = {
    apiKey: 'AIzaSyBtXZ6tiQWp0qBGOr7-TQ6OirwqL0PMBwo',
    authDomain: 'test-9faac.firebaseapp.com',
    databaseURL: 'https://test-9faac-default-rtdb.firebaseio.com',
    projectId: 'test-9faac',
    storageBucket: 'test-9faac.firebasestorage.app',
    messagingSenderId: '781249745593',
    appId: '1:781249745593:web:b10cea040da53b5e670168',
  };

  function load(src){ return new Promise((res,rej)=>{ if ([...document.scripts].some(s=>s.src===src)) return res();
    const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('load '+src));
    (document.head||document.documentElement).appendChild(s);
  });}

  async function boot(){
    await load(CDN+'firebase-app.js');
    await load(CDN+'firebase-database.js');
    await load(CDN+'firebase-auth.js');
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    try{
      // すでにログイン済みなら何もしない
      await (firebase.auth().currentUser ? Promise.resolve() : firebase.auth().signInAnonymously());
      const uid = firebase.auth().currentUser?.uid;
      try{ localStorage.setItem('uid', uid); }catch{}
    }catch(e){ console.warn('[web] anon auth failed', e); }
  }

  window.firebaseReadyPromise = (window.firebaseReadyPromise || boot());
})();