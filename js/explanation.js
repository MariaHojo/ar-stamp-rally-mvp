/* js/explanation.js（差し替え）
 * - ?spotId=spot1..spot6 を判定し、写真・クイズ・解説を表示
 * - 表示時に users/{uid}/stamps/{spotId} = true を保存（匿名UID）
 * - スタンプ画像: assets/images/stamps/stampXX.png（XX=01..06）
 * - 写真: assets/images/Photo_thesis/…（ご提供ファイル名）
 */

(function () {
  const $  = (s) => document.querySelector(s);

  // --------- 基本ユーティリティ ---------
  function getQuery(key){
    try { return new URLSearchParams(location.search).get(key) } catch { return null }
  }
  function normalizeSpotId(v){
    const id = String(v || '').trim().toLowerCase();
    return /^spot[1-6]$/.test(id) ? id : 'spot1';
  }
  function getSpotId(){
    const urlId = getQuery('spotId');
    const bodyId= document.body ? document.body.dataset.spot : null;
    return normalizeSpotId(urlId || bodyId || 'spot1');
  }
  function getUidSync(){
    try { return (firebase?.auth?.().currentUser?.uid) || localStorage.getItem('uid'); } catch { return null; }
  }
  function lsKey(spot){ const uid = getUidSync() || 'nouid'; return `stamp_${uid}_${spot}` }
  function toNN(spotId){ return String(spotId.replace('spot','')).padStart(2,'0') }
  function stampSrc(spotId){ return `assets/images/stamps/stamp${toNN(spotId)}.png` }

  // --------- コンテンツ定義 ---------
  const LABELS = {
    spot1: '本館173前',
    spot2: 'トロイヤー記念館（T館）前',
    spot3: '学生食堂（ガッキ）前',
    spot4: 'チャペル前',
    spot5: '体育館（Pec-A）前',
    spot6: '本館307前',
  };

  // 各スポットのデータ
  const CONTENT = {
    spot1: {
      mainPhoto: 'assets/images/Photos_thesis/spot1_main.jpg',
      quiz: {
        q: '本館は昔何に使われていたでしょうか？',
        choices: { A:'図書館', B:'畑', C:'飛行機の制作' },
        answer: 'C'
      },
      explainHTML: `
        <p>ICUがある所には昔、「中島飛行機」という名前の会社があったんだ。戦争のころには軍用機も多く作られていたんだよ。後に「富士重工業（現社名：SUBARU）」という会社になるよ。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot1_detail_1.jpg" alt="キャンパス内部 本館風景">
          <figcaption>キャンパス内部 本館風景</figcaption>
        </figure>
        <p>これは改装前の写真だよ。<b>本館はもともと中島飛行機が使っていたもの</b>を1953年に改築したんだ。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot1_main.jpg" alt="本館正面 1950年代">
          <figcaption>本館正面（1950年代）</figcaption>
        </figure>
        <p>この写真は1950年代のもので、改築はしてるけど<b>バカ山・アホ山がまだ無い</b>よね？ バカ山・アホ山は図書館の地下階を掘った時にできた土を盛って作られたんだよ！</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot1_detail_2.jpg" alt="1957_第一期生卒業式">
          <figcaption>1957_第一期生卒業式</figcaption>
        </figure>
        <p>この写真は1957年に一期生の卒業式のときに撮られたものだよ。見慣れた玄関が昔の写真にも出てくるなんて不思議な気持ちだね。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot1_detail_3.jpg" alt="1952 献学時 - 小田急バスでの通学">
          <figcaption>1952 献学時 - 小田急バスでの通学</figcaption>
          <p>この写真は小田急バスで通学する、1952年の学生の写真だ。なんと、本館東側（今は駐輪場になっている方）の入り口近くまでバスが来ていたんだよ！</p>
        </figure>
        
      `
    },
    spot2: {
      mainPhoto: 'assets/images/Photos_thesis/spot2_main.jpg',
      quiz: {
        q: 'T館がある所には、昔何があったでしょうか？',
        choices: { A:'教会', B:'道', C:'教室棟' },
        answer: 'B'
      },
      explainHTML: `
        <p>写真を見ると、横から見たら「E」みたいになっている本館と、十字の形の理学館があって、奥に三角のシーベリーチャペルがあるよね。でも、<b>T館はどこにもない</b>のはわかるかな？ これは1970年の写真だよ。本当に何もなかったんだ！</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot2_detail_1.jpg" alt="キャンパス全景 1956 航空写真">
          <figcaption>キャンパス全景（1956年・航空写真）</figcaption>
        </figure>
        <p>理学館もないけど、本館だけは変わらないね。他には何が見えるか、探してみてね！</p>
      `
    },
    spot3: {
      mainPhoto: 'assets/images/Photos_thesis/spot3_main.jpg',
      quiz: {
        q: 'ガッキで行われていたことは何でしょう？',
        choices: { A:'結婚式', B:'オーケストラコンクール', C:'ダンスバトル' },
        answer: 'A'
      },
      explainHTML: `
        <p><b>結婚式も、結婚式の披露宴も</b>行われていたよ。写真は1955年ごろのガッキ（学生キッチンの略）。昔はICUのガッキでは、中富商事の提供するフレンチ料理を食べることが出来たんだ。結婚式のときは、豪華な本格フレンチがふるまわれたとか。</p>
        <p>中富商事は今でも本格フレンチのレストランを営んでいるよ。今目の前にあるガッキの中にある暖炉は、今は使われていないけど、現役で使われていた時代もあったんだ。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot3_main.jpg" alt="1955_学生食堂全景">
          <figcaption>1955_学生食堂全景</figcaption>
        </figure>
        <p>このころのガッキからさらに改築されて、2010年に今のガッキに建て替えられる前は、こんな感じだったよ。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot3_detail_2.JPG" alt="食堂 外観（改築前）">
          <figcaption>食堂・外観（改築前）</figcaption>
        </figure>
        <p>今はもっと大きくなったね！</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot3_detail_1.JPG" alt="ICUフェスティバルの日の食堂">
          <figcaption>ICUフェスティバルの日の食堂</figcaption>
        </figure>
        <p>これは何の日のガッキかわかるかな？いろんな人がいて楽しそうだね！1950-1960年代の写真だよ。</p>
        <p>答えは、<b>ICUフェスティバルの日！</b>学祭の日ってことだね。</p>
      `
    },
    spot4: {
      mainPhoto: 'assets/images/Photos_thesis/spot4_main.jpg',
      quiz: {
        q: 'この写真と今のチャペルの形が違うのはなぜでしょうか？',
        choices: { A:'建築士が喧嘩して建て直したから', B:'すぐに壊れて建て直したから', C:'音響が悪くて建て直したから' },
        answer: 'C'
      },
      explainHTML: `
        <p>ロマネスク様式の<b>バラ窓</b>が見事なチャペルだね。これは1954年にヴォーリズ建築事務所によって建てられたけど、ヴォーリズが引退した後、<b>1959年にレーモンド</b>というモダニズム建築士によって建て替えられたんだ。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot4_detail_1.jpg" alt="教会学校 1970">
          <figcaption>建て替え後の礼拝堂（1970）</figcaption>
        </figure>
        <p>一説にはモダニズム建築のレーモンドがロマネスク様式を嫌って建て替えた…という話もあるみたいだけど、さすがに喧嘩したぐらいで、募金を募って建てられたICUのチャペル建て直しはできないよね…。</p>
        <p><b>第二次世界大戦後の日米で、和解を願って集められた寄付によって購入されたのが、このICUが建つ三鷹の土地なんだ。</b>人々の善意によって建てられた大学に居るっていうのは、キュッと身を引き締めさせてくれるね。</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot4_detail_2.jpg" alt="礼拝堂玄関前ゲスト_1955">
          <figcaption>礼拝堂玄関前ゲスト_1955</figcaption>
        </figure>
        <p>これは何の日の礼拝堂かな？皆きれいな格好だね！答えは結婚式の日だよ！ICUに勤められていた都留春夫（つる はるお）先生の結婚祝いに作られたアルバムに入っていた写真なんだ。</p>
        <p>都留先生は1955年にICUチャペルでヘルスセンター勤務の篠原氏と挙式されたんだよ。カウンセリングの父と呼ばれる先生で、ICUに初期からカウンセリングセンターがあるのもこの先生のおかげなんだ。この写真には写っていないけど...。</p>

      `
    },
    spot5: {
      mainPhoto: 'assets/images/Photos_thesis/spot5_main.jpg',
      quiz: {
        q: '体育館にはA館とB館がありますが、B館はいつごろ建てられたでしょうか？',
        choices: { A:'1990年代', B:'1970年代', C:'1950年代' },
        answer: 'B'
      },
      explainHTML: `
        <p><b>1973年の写真</b>だよ。B館に入ったことがある人は、このころから内装が変わっていないことが分かるね！50年も昔から、ここでいろんな学生が運動を楽しんでいるんだよ。もちろんジムで体を鍛える学生もね！</p>
        <figure>
          <img src="assets/images/Photos_thesis/spot5_detail_1.jpg" alt="プール棟（1973）">
          <figcaption>当時はプール棟もありました（1973）</figcaption>
        </figure>
        <p>2018年に新しくA館が出来たよ！ 木がきれいだね。この建築には建築士の隈研吾さんが関わっているよ。その時にプール棟は無くなって、新しくなったんだ。</p>
      `
    },
    spot6: {
      mainPhoto: 'assets/images/Photos_thesis/spot6_main.jpg', // 未定なら空のまま
      quiz: null,    // クイズなし
      explainHTML: `
        <p>ここまで見てくれてありがとう！最後はクイズ無しでごほうびを楽しんでね！</p>
        <p>今、本館の東側にいるよね？そこから下を見ると、階段を下りた真下に入り口があるんだ。そこから農場にトラクターで向かっている写真だよ。</p>
        <p>下に降りたらぜひ振り返って見てみてね！</p>
      `,
      message: `
        <p>マップに戻ったらアンケートにぜひ答えてね！</p>
        <p>スペシャルコンテンツも待ってるよ〜！</p>
      `
    }
  };

  // --------- 描画処理 ---------
  function render(spotId){
    const title = LABELS[spotId] || 'スポット';
    const conf  = CONTENT[spotId] || CONTENT.spot1;

    // タイトル
    $('#spotTitle').textContent = title;

    // スタンプ画像
    const sImg = $('#gotStampImage');
    if (sImg) { sImg.src = stampSrc(spotId); sImg.alt = `${title} のスタンプ`; }

    // メイン写真
    const photo = $('#spotPhoto');
    if (photo) {
      if (conf.mainPhoto) {
        photo.src = conf.mainPhoto;
        photo.alt = `${title} の写真`;
      } else {
        photo.src = '';
        photo.alt = '';
      }
    }

    // クイズ（spot6は非表示）
    const quizSection = $('#quizSection');
    const quizBody    = $('#quizBody');
    const quizChoices = $('#quizChoices');
    const answerBlock = $('#answerBlock');
    const answerText  = $('#answerText');
    const showBtn     = $('#showAnswerBtn');
    const special     = $('#specialMessage');

    if (conf.quiz){
      quizSection.style.display = 'block';
      special.style.display     = 'none';

      quizBody.innerHTML = `<p>${conf.quiz.q}</p>`;
      quizChoices.innerHTML = `
        <p>A. ${conf.quiz.choices.A}</p>
        <p>B. ${conf.quiz.choices.B}</p>
        <p>C. ${conf.quiz.choices.C}</p>
      `;
      answerBlock.style.display = 'none';
      showBtn.disabled = false;
      showBtn.onclick = () => {
        answerText.innerHTML = `<b>答え：${conf.quiz.answer}</b>（${conf.quiz.choices[conf.quiz.answer]}）`;
        answerBlock.style.display = 'block';
        showBtn.disabled = true;
      };
    } else {
      // クイズ無し（spot6）
      quizSection.style.display = 'none';
      special.style.display = 'block';
      special.innerHTML = conf.message || '';
    }

    // 解説
    const explain = $('#explainBlock');
    explain.innerHTML = conf.explainHTML || '';

    // 画面タイトル（ブラウザ）
    try { document.title = `${title} | 解説`; } catch {}
  }

  // --------- 保存処理 ---------
  async function ensureAnon() {
    if (typeof window.ensureAnon === 'function') {
      try { const uid = await window.ensureAnon(); if (uid) return uid; } catch(e){}
    }
    try {
      if (!firebase?.apps?.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
      }
      const auth = firebase.auth();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await auth.signInAnonymously();
      return cred.user && cred.user.uid;
    } catch(e) {
      console.warn('[explanation] ensureAnon fallback failed:', e?.message||e);
      return getUidSync();
    }
  }

  async function saveStamp(spotId){
    let uid = null;
    try { uid = await ensureAnon(); } catch(e){ console.warn('[explanation] ensureAnon failed:', e) }

    // ローカル先行
    try { localStorage.setItem(lsKey(spotId), 'true'); } catch {}

    if (!uid) return;
    try {
      const db = firebase.database();
      const updates = {};
      updates[`users/${uid}/stamps/${spotId}`] = true;
      updates[`users/${uid}/meta/updatedAt`]   = Date.now();
      await db.ref().update(updates);
      console.log('[explanation] stamp saved:', uid, spotId);
    } catch(e){
      console.warn('[explanation] Firebase write failed:', e?.message || e);
    }
  }

  // --------- 起動 ---------
  async function boot(){
    const spotId = getSpotId();
    render(spotId);
    await saveStamp(spotId);
  }

  document.addEventListener('DOMContentLoaded', boot);
}());
