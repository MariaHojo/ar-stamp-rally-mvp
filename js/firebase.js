// js/firebase.js - Firebase 動的ロード + 匿名サインイン + ensureAnon()
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

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = () => reject(new Error('Load failed: ' + src));
      document.head.appendChild(s);
    });
  }

  window.firebaseReadyPromise = (async () => {
    if (window.firebase?.apps?.length) return;
    await loadScript(CDN + 'firebase-app.js');
    await loadScript(CDN + 'firebase-auth.js');
    await loadScript(CDN + 'firebase-database.js');
    firebase.initializeApp(CONFIG);
  })();

  async function waitAuthUser(auth){
    if (auth.currentUser) return auth.currentUser;
    return await new Promise(resolve => {
      const off = auth.onAuthStateChanged(u => { if (u) { off(); resolve(u); } });
    });
  }

  window.ensureAnon = async function(){
    try { await window.firebaseReadyPromise; } catch(e){}
    const auth = firebase.auth();
    if (!auth.currentUser) {
      try { await auth.signInAnonymously(); } catch(e) { /* raceは無視 */ }
    }
    const user = await waitAuthUser(auth);
    try { localStorage.setItem('uid', user.uid); } catch(e){}
    return user.uid;
  };
})();
