// js/explanation.js
(function(){
  var CONTENT = {
    spot1: {
      title: 'スポット1：史料館前',
      subtitle: '大学の歴史に触れよう',
      image: 'assets/images/stamp01.png',
      body: [
        'ここは創立当初からある記念碑の前です。',
        'ARオブジェクトと重ねて撮影してみましょう。'
      ]
    },
    spot2: {
      title: 'スポット2：時計台',
      subtitle: 'シンボルの前で位置合わせ',
      image: 'assets/images/stamp02.png',
      body: [
        '時計台は1920年代に建てられました。',
        'ARの方向ガイドに従って観察してみましょう。'
      ]
    },
    spot3: {
      title: 'スポット3：中庭',
      subtitle: '緑の中の憩いスペース',
      image: 'assets/images/stamp03.png',
      body: [
        '季節で表情が変わるスポットです。',
        'ARスタンプを集めたら記念撮影もどうぞ。'
      ]
    }
  };

  function qs(k){ try{ return new URLSearchParams(location.search).get(k) }catch(e){ return null; } }

  function render() {
    var sid = qs('spotId') || 'spot1';
    var data = CONTENT[sid] || CONTENT.spot1;

    var img = document.getElementById('spotImage');
    var title = document.getElementById('spotTitle');
    var subtitle = document.getElementById('spotSubtitle');
    var body = document.getElementById('spotBody');

    if (img) img.src = data.image;
    if (title) title.textContent = data.title;
    if (subtitle) subtitle.textContent = data.subtitle;

    if (body) {
      body.innerHTML = '';
      data.body.forEach(function(p){
        var el = document.createElement('p');
        el.textContent = p;
        body.appendChild(el);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', render);
})();