// firebase.js - v8 app/db/auth を順にロード→匿名サインイン→uid保存
(() => {
  const CFG = {
    apiKey: 'AIzaSyBtXZ6tiQWp0qBGOr7-TQ6OirwqL0PMBwo',
    authDomain: 'test-9faac.firebaseapp.com',
    databaseURL: 'https://test-9faac-default-rtdb.firebaseio.com',
    projectId: 'test-9faac',
    storageBucket: 'test-9faac.firebasestorage.app',
    messagingSenderId: '781249745593',
    appId: '1:781249745593:web:b10cea040da53b5e670168',
  };
  const CDN = 'https://www.gstatic.com/firebasejs/8.10.1/';

  function load(src){return new Promise((res,rej)=>{if([...document.scripts].some(s=>s.src===src))return res();const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error('load fail:'+src));(document.head||document.documentElement).appendChild(s);});}
  function saveUid(uid){try{localStorage.setItem('uid',uid);if(!localStorage.getItem('userId'))localStorage.setItem('userId',uid);}catch(_){}}

  async function boot(){
    await load(CDN+'firebase-app.js');
    await load(CDN+'firebase-database.js');
    await load(CDN+'firebase-auth.js');
    if(!firebase.apps.length) firebase.initializeApp(CFG);

    if (firebase.auth().currentUser){ saveUid(firebase.auth().currentUser.uid); return; }

    const gotUser=new Promise(r=>{const off=firebase.auth().onAuthStateChanged(u=>{if(u){saveUid(u.uid);off();r();}});});
    await firebase.auth().signInAnonymously().catch(e=>{console.warn('anon sign-in failed',e); throw e;});
    await gotUser;
  }

  window.firebaseReadyPromise = (async()=>{ await boot(); 
    document.dispatchEvent(new CustomEvent('firebase-ready',{detail:{uid:firebase.auth().currentUser.uid}}));
    return {firebase, uid: firebase.auth().currentUser.uid};
  })();
  window.getUid = ()=> (firebase.auth().currentUser && firebase.auth().currentUser.uid) || localStorage.getItem('uid');
})();