// firebase.js (Web/GitHub Pages) - Anonymous Auth + RTDB init + helper
// 1ファイルで firebase-app/database/auth を動的ロードし、匿名サインインして uid を保存します。

(() => {
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBtXZ6tiQWp0qBGOr7-TQ6OirwqL0PMBwo',
    authDomain: 'test-9faac.firebaseapp.com',
    databaseURL: 'https://test-9faac-default-rtdb.firebaseio.com',
    projectId: 'test-9faac',
    storageBucket: 'test-9faac.firebasestorage.app',
    messagingSenderId: '781249745593',
    appId: '1:781249745593:web:b10cea040da53b5e670168',
  };

  const LOG = (...a) => console.log('[firebase/js]', ...a);

  function loadScript(src) {
    return new Promise((res, rej) => {
      // 既に同じsrcが入っていればスキップ
      if ([...document.scripts].some(s => s.src === src)) return res();
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('load fail: ' + src));
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function ensureLibs() {
    if (!window.firebase) await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
    if (!firebase.database) await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
    if (!firebase.auth) await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
  }

  function saveUid(uid) {
    try {
      localStorage.setItem('uid', uid);
      // 互換: 既存コードが userId を参照する場合のためミラー
      if (!localStorage.getItem('userId')) localStorage.setItem('userId', uid);
    } catch (_) {}
  }

  async function ensureInitialized() {
    await ensureLibs();
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
      LOG('initialized');
    }
  }

  async function ensureAnonSignIn() {
    await ensureInitialized();

    // 既にログイン済みならそれを使う
    if (firebase.auth().currentUser) {
      const uid = firebase.auth().currentUser.uid;
      saveUid(uid);
      LOG('already signed in:', uid);
      return firebase.auth().currentUser;
    }

    // 監視して uid を保存
    const gotUser = new Promise((resolve) => {
      const off = firebase.auth().onAuthStateChanged(u => {
        if (u) {
          saveUid(u.uid);
          LOG('signed in anonymously:', u.uid);
          off(); resolve(u);
        }
      });
    });

    // 匿名ログイン開始（有効化されていないと auth/operation-not-allowed）
    try {
      await firebase.auth().signInAnonymously();
    } catch (e) {
      console.warn('[firebase/js] signInAnonymously failed:', e.code, e.message);
      throw e;
    }
    return gotUser;
  }

  // 公開: 他スクリプトが待てるように Promise を曝す
  const ready = (async () => {
    await ensureAnonSignIn();
    // DOMへ通知（任意）
    document.dispatchEvent(new CustomEvent('firebase-ready', {
      detail: { uid: firebase.auth().currentUser && firebase.auth().currentUser.uid }
    }));
    return { firebase, uid: firebase.auth().currentUser.uid };
  })();

  // window へエクスポート
  window.firebaseReadyPromise = ready;
  window.getUid = () => (firebase.auth().currentUser && firebase.auth().currentUser.uid) || localStorage.getItem('uid');

})();
