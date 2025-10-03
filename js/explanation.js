// explanation.js — スマホ最適・スタンプ保存・クイズ表示・可変データ対応（全置換）

(function(){
  // ------- ユーティリティ -------
  const $ = (s) => document.querySelector(s);

  function qp(key){
    try { return new URLSearchParams(location.search).get(key) } catch { return null }
  }
  function normSpotId(v){
    const id = String(v||'').trim().toLowerCase();
    return /^spot[1-6]$/.test(id) ? id : 'spot1';
  }
  function stampSrcFor(spotId){
    // spot1 -> 01, spot2 -> 02...
    const n = spotId.replace('spot','').padStart(2,'0');
    return `assets/images/stamp${n}.png`;
  }

  // ------- スポット別データ（ここを編集すればOK） -------
  // 15〜18歳向け：短く・ややカジュアル・“へえ”がある・調べ方に触れる
  const DATA = {
    spot1: {
      name: 'スポット1（XX：本館 など）',     // ←編集
      lead: '（一言リード：ここに驚きのフックを一文で）', // ←編集（任意）
      photo: "assets/images/Photos_thesis/本館正面_1950年代.jpg", // ←編集
      quiz: {
        text: '（例）この建物が今の形になったのはいつごろ？ヒントは戦後の復興と関係があります。', // 60〜100文字
        choices: {
          A: 'A：XX年ごろ',
          B: 'B：XX年ごろ',
          C: 'C：XX年ごろ'
        },
        answer: 'A', // 'A' | 'B' | 'C'
        explain: '（例）実はXX年ごろに大きな改修がありました。資料は図書館の◯◯コーナーやICUアーカイブズのWebで確認できます。'
      }
    },
    // spot2 以降は必要になったら複製して編集
    spot2: {
      name: 'スポット2（XX）',
      lead: '（リード）',
      photo: "assets/images/Photos_thesis/XX.jpg",
      quiz: {
        text: '（XXのクイズ本文）',
        choices: { A:'A：XX', B:'B：XX', C:'C：XX' },
        answer: 'B',
        explain: '（XXの解説）'
      }
    },
    spot3: {
      name: 'スポット3（XX）',
      lead: '（リード）',
      photo: "assets/images/Photos_thesis/XX.jpg",
      quiz: {
        text: '（XXのクイズ本文）',
        choices: { A:'A：XX', B:'B：XX', C:'C：XX' },
        answer: 'C',
        explain: '（XXの解説）'
      }
    },
    spot4: {
      name: 'スポット4（XX）',
      lead: '（リード）',
      photo: "assets/images/Photos_thesis/XX.jpg",
      quiz: {
        text: '（XXのクイズ本文）',
        choices: { A:'A：XX', B:'B：XX', C:'C：XX' },
        answer: 'A',
        explain: '（XXの解説）'
      }
    },
    spot5: {
      name: 'スポット5（XX）',
      lead: '（リード）',
      photo: "assets/images/Photos_thesis/XX.jpg",
      quiz: {
        text: '（XXのクイズ本文）',
        choices: { A:'A：XX', B:'B：XX', C:'C：XX' },
        answer: 'B',
        explain: '（XXの解説）'
      }
    },
    spot6: {
      name: 'スポット6（XX）',
      lead: '（リード）',
      photo: "assets/images/Photos_thesis/XX.jpg",
      quiz: {
        text: '（XXのクイズ本文）',
        choices: { A:'A：XX', B:'B：XX', C:'C：XX' },
        answer: 'C',
        explain: '（XXの解説）'
      }
    }
  };

  // ------- スタンプ保存（Firebase / ローカル） -------
  async function ensureAnon(){
    if (typeof window.ensureAnon === 'function') {
      try { const uid = await window.ensureAnon(); if (uid) return uid } catch(e){}
    }
    // fallback: v8
    try{
      if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await auth.signInAnonymously();
      return cred.user && cred.user.uid;
    }catch(e){
      console.warn('[explanation] ensureAnon fallback failed:', e?.message||e);
      try { return localStorage.getItem('uid') } catch { return null }
    }
  }
  function lsKey(uid, spot){ return `stamp_${uid||'nouid'}_${spot}` }

  async function saveStamp(spotId){
    // ローカル先行
    let uid = null;
    try {
      uid = await ensureAnon();
      localStorage.setItem(lsKey(uid, spotId), 'true');
    } catch {}
    // Firebase
    if (!uid) return;
    try{
      const db = firebase.database();
      const updates = {};
      updates[`users/${uid}/stamps/${spotId}`] = true;
      updates[`users/${uid}/meta/updatedAt`]   = Date.now();
      await db.ref().update(updates);
      // console.log('[explanation] saved', spotId, 'for', uid);
    }catch(e){
      console.warn('[explanation] fb update failed:', e?.message||e);
    }
  }

  // ------- 画面描画 -------
  function render(spotId){
    const d = DATA[spotId] || DATA.spot1;

    $('#spotName').textContent = d.name || 'スポット（XX）';
    $('#spotLead').textContent = d.lead || '';

    const stampSrc = stampSrcFor(spotId);
    $('#stampImg').src = stampSrc;
    $('#stampImg').alt = '獲得スタンプ';

    $('#spotPhoto').src = d.photo || '';
    $('#spotPhoto').alt = d.name || 'スポット写真';

    // クイズ
    $('#quizText').textContent = d.quiz?.text || '（クイズ本文が未設定です）';

    const ul = $('#choices');
    ul.innerHTML = '';
    const choices = d.quiz?.choices || {};
    ['A','B','C'].forEach((key)=>{
      const li = document.createElement('li');
      li.className = 'choice';
      li.innerHTML = `<span class="label">${key}</span><span class="text">${choices[key] || `${key}：XX`}</span>`;
      ul.appendChild(li);
    });

    // 答え表示
    $('#showAnswerBtn').addEventListener('click', ()=>{
      const ans = (d.quiz?.answer || 'A').toUpperCase();
      const txt = (d.quiz?.choices?.[ans] || 'XX');
      $('#answerLine').textContent = `答え：${ans}（${txt.replace(/^[ABC]：?/, '')}）`;
      $('#answerExplain').textContent = d.quiz?.explain || '（解説本文が未設定です）';
      $('#answerBox').style.display = 'block';
      // 画面内にスクロール
      $('#answerBox').scrollIntoView({behavior:'smooth', block:'start'});
    }, {once:true});
  }

  // ------- 起動 -------
  async function boot(){
    const spotId = normSpotId(qp('spotId') || document.body.dataset.spot || 'spot1');
    render(spotId);
    await saveStamp(spotId);

    // 戻るリンク：キャッシュ回避したい場合は withV を使う
    const a = $('#backToMap');
    if (a && typeof window.withV === 'function') {
      a.href = window.withV('map.html');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
