// js/firebase.js — Firebase v8 動的ロード + 初期化 + 匿名サインイン保証
(function () {
  // 多重実行ガード
  if (window._firebaseBooting) return;
  window._firebaseBooting = true;

  const CDN = 'https://www.gstatic.com/firebasejs/8.10.1/';
  const CONFIG = {
    apiKey: 'AIzaSyBtXZ6tiQWp0qBGOr7-TQ6OirwqL0PMBwo',
    authDomain: 'test-9faac.firebaseapp.com',
    databaseURL: 'https://test-9faac-default-rtdb.firebaseio.com',
    projectId: 'test-9faac',
    // Storage を使う場合に備え、一般的な bucket ドメインに修正
    storageBucket: 'test-9faac.appspot.com',
    messagingSenderId: '781249745593',
    appId: '1:781249745593:web:b10cea040da53b5e670168',
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    // app 本体
    if (!window.firebase?.apps) {
      await loadScript(CDN + 'firebase-app.js');
    }
    // 必要 SDK
    const needsAuth = !firebase.auth;
    const needsDB = !firebase.database;
    const loaders = [];
    if (needsAuth) loaders.push(loadScript(CDN + 'firebase-auth.js'));
    if (needsDB)  loaders.push(loadScript(CDN + 'firebase-database.js'));
    if (loaders.length) await Promise.all(loaders);

    // 初期化（未初期化のときのみ）
    if (!firebase.apps.length) {
      firebase.initializeApp(CONFIG);
    }
  }

  // ---- 準備系 Promise を公開 ----
  // 初期化のみ
  if (!window.firebaseInitPromise) {
    window.firebaseInitPromise = boot();
  }

  // 現在ユーザーを待つ（タイムアウト付き）
  async function waitAuthUser(auth, timeoutMs) {
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve, reject) => {
      const off = auth.onAuthStateChanged(u => {
        if (u) { clearTimeout(timer); off(); resolve(u); }
      });
      const t = Math.max(1000, timeoutMs | 0 || 10000);
      const timer = setTimeout(() => { off(); reject(new Error('Auth timeout')); }, t);
    });
  }

  // 公開 API：匿名サインインを保証し uid を返す
  window.ensureAnon = async function ensureAnon() {
    await window.firebaseInitPromise;
    const auth = firebase.auth();

    if (!auth.currentUser) {
      try { await auth.signInAnonymously(); }
      catch (e) { /* レース時は既にサインイン済みのことがあるので黙殺 */ }
    }

    let user;
    try {
      user = await waitAuthUser(auth, 10000);
    } catch (e) {
      const cached = localStorage.getItem('uid');
      if (cached) return cached; // オフライン時はキャッシュ継続
      throw e;
    }

    try { localStorage.setItem('uid', user.uid); } catch {}
    return user.uid;
  };

  // 互換：この Promise を await すれば「初期化＋匿名サインイン完了」まで待てる
  window.firebaseReadyPromise = Promise.resolve(window.firebaseInitPromise)
    .then(() => window.ensureAnon())
    .catch((e) => {
      console.warn('[firebase] ready error:', e?.message || e);
    });

})();
