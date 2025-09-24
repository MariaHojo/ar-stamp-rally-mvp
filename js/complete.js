/* complete.js（整理版）
   - Firebase準備を待ち、stamps を uid/loginName/url uid/guest で OR マージして取得
   - UI反映（各スタンプ/全取得バッジ/メッセージ）
   - 全取得時に /users/<uid>/complete=true と完了時刻を保存（任意）
   - ボタン：マップへ戻る / 事後アンケートへ
   - /events に簡易ログ（任意）
*/

(function(){
  const $ = (s) => document.querySelector(s);

  // --- helpers ---
  function getQuery(key){ try{ return new URLSearchParams(location.search).get(key) }catch{ return null } }
  function getUid(){
    try { if (window.firebase?.auth?.currentUser) return firebase.auth().currentUser.uid; } catch {}
    try { return localStorage.getItem('uid'); } catch { return null; }
  }
  function getLoginName(){ try { return localStorage.getItem('loginName') || '' } catch { return '' } }

  async function ensureFirebaseReady(){
    if (window.firebaseReadyPromise) { try { await window.firebaseReadyPromise; } catch {} }
    return (window.firebase && firebase.apps && firebase.apps.length) ? firebase : null;
  }

  async function logEvent(type, meta={}){
    const fb = await ensureFirebaseReady(); if (!fb) return;
    try {
      const uid = getUid() || 'guest';
      const ref = firebase.database().ref('events').push();
      await ref.set({
        uid, type, ...meta,
        ts: (typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now(),
        ua: navigator.userAgent
      });
    } catch {}
  }

  // --- stamps ---
  function setCellUI(idx, obtained){
    const img = $('#s'+idx+'img');
    const ph  = $('#s'+idx+'ph');
    const st  = $('#s'+idx+'st');
    if (!img || !ph || !st) return;
    if (obtained){
      img.style.display = 'block';
      ph.style.display  = 'none';
      st.textContent    = '取得済み';
      st.classList.remove('not'); st.classList.add('obtained');
    } else {
      img.style.display = 'none';
      ph.style.display  = 'block';
      st.textContent    = '未取得';
      st.classList.remove('obtained'); st.classList.add('not');
    }
  }

  function localFallback(){
    try {
      const g = k => localStorage.getItem('stamp_'+k) === 'true';
      return { spot1:g('spot1'), spot2:g('spot2'), spot3:g('spot3') };
    } catch { return { spot1:false, spot2:false, spot3:false }; }
  }

  async function readMergedStamps(){
    const fb = await ensureFirebaseReady(); if (!fb) return localFallback();

    const keys = [];
    const k1 = getUid();        if (k1) keys.push(k1);
    const k2 = getLoginName();  if (k2 && !keys.includes(k2)) keys.push(k2);
    const k3 = getQuery('uid'); if (k3 && !keys.includes(k3)) keys.push(k3);
    if (!keys.includes('guest')) keys.push('guest');

    const merged = localFallback();
    for (const k of keys){
      try{
        const snap = await firebase.database().ref('users/'+k+'/stamps').once('value');
        const v = snap.val() || {};
        merged.spot1 = merged.spot1 || !!v.spot1;
        merged.spot2 = merged.spot2 || !!v.spot2;
        merged.spot3 = merged.spot3 || !!v.spot3;
        if (merged.spot1 && merged.spot2 && merged.spot3) break;
      }catch(e){ /* skip */ }
    }
    return merged;
  }

  async function markCompletedIfAll(){
    const fb = await ensureFirebaseReady(); if (!fb) return;
    const uid = getUid(); if (!uid) return;
    const ref = firebase.database().ref('users/'+uid+'/complete');
    try {
      await ref.set(true);
      await firebase.database().ref('users/'+uid+'/completeAt')
        .set((typeof firebase.database.ServerValue !== 'undefined' && firebase.database.ServerValue.TIMESTAMP) || Date.now());
    } catch {}
  }

  // --- init ---
  async function init(){
    logEvent('complete_open').catch(()=>{});

    // 先にローカル値で即時描画
    const local = localFallback();
    setCellUI(1, !!local.spot1);
    setCellUI(2, !!local.spot2);
    setCellUI(3, !!local.spot3);

    // Firebase から上書き
    const stamps = await readMergedStamps();
    setCellUI(1, !!stamps.spot1);
    setCellUI(2, !!stamps.spot2);
    setCellUI(3, !!stamps.spot3);

    const allBadge = $('#allBadge');
    const lead = $('#lead');
    const card = $('#completeCard');
    const toPost = $('#toPost');

    const all = !!(stamps.spot1 && stamps.spot2 && stamps.spot3);
    if (all){
      allBadge.textContent = 'コンプリート！';
      allBadge.classList.remove('badgeng');
      lead.textContent = '🎉 おめでとうございます！すべてのスタンプを集めました。';
      card.style.display = 'block';
      toPost.disabled = false;

      markCompletedIfAll().catch(()=>{});
      logEvent('complete_all', {completed:true}).catch(()=>{});
    } else {
      allBadge.textContent = '未コンプリート';
      allBadge.classList.add('badgeng');
      lead.textContent = '3つのスポットをすべて集めるとコンプリートです。';
      card.style.display = 'none';
      toPost.disabled = true;
      logEvent('complete_all', {completed:false}).catch(()=>{});
    }

    // ボタン
    $('#toMap').addEventListener('click', () => {
      logEvent('back_map_from_complete').catch(()=>{});
      location.href = 'map.html';
    });
    toPost.addEventListener('click', () => {
      logEvent('go_post_survey').catch(()=>{});
      location.href = 'post-survey.html';
    });

    // 画面復帰で再評価（戻るキャッシュ対策）
    window.addEventListener('pageshow', async () => {
      const s2 = await readMergedStamps();
      setCellUI(1, !!s2.spot1);
      setCellUI(2, !!s2.spot2);
      setCellUI(3, !!s2.spot3);
      const all2 = !!(s2.spot1 && s2.spot2 && s2.spot3);
      if (all2 && toPost.disabled) {
        allBadge.textContent = 'コンプリート！';
        allBadge.classList.remove('badgeng');
        $('#completeCard').style.display = 'block';
        toPost.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
