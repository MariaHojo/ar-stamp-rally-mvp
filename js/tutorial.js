// js/tutorial.js
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.tutorial-container');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const prevBtn = document.getElementById('navPrev');
  const nextBtn = document.getElementById('navNext');
  const doneBtn = document.getElementById('tutorialDoneBtn');

  if (!container || slides.length === 0) return;

  const pageCount = slides.length;

  const getCurrentPage = () => {
    const pageWidth = container.clientWidth;
    // 端末によっては sub-pixel が出るため四捨五入
    return Math.round(container.scrollLeft / pageWidth);
  };

  const scrollToPage = (index) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, index));
    container.scrollTo({
      left: clamped * container.clientWidth,
      top: 0,
      behavior: 'smooth'
    });
  };

  const updateNav = () => {
    const idx = getCurrentPage();

    // ページごとの表示仕様：
    // p1: 右下「→」のみ
    // p2: 左下「←」・右下「→」
    // p3: 左下「←」・右下「完了」
    prevBtn.style.display = (idx >= 1) ? 'inline-block' : 'none';
    nextBtn.style.display = (idx <= pageCount - 2) ? 'inline-block' : 'none';
    doneBtn.style.display = (idx === pageCount - 1) ? 'inline-block' : 'none';
  };

  // 初期状態
  updateNav();

  // スクロールでページ判定
  let ticking = false;
  container.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateNav();
        ticking = false;
      });
      ticking = true;
    }
  });

  // クリック操作
  prevBtn.addEventListener('click', () => scrollToPage(getCurrentPage() - 1));
  nextBtn.addEventListener('click', () => scrollToPage(getCurrentPage() + 1));
  doneBtn.addEventListener('click', () => {
    // チュートリアル完了 → マップへ
    window.location.href = 'map.html';
  });

  // スワイプでのページ送りも scroll-snap で有効です（追加のJS不要）
});
