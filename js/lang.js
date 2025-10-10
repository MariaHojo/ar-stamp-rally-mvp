/*!
 * lang.js – JA/EN 切替（最小実装）
 * - 右上にグローブアイコンを注入 → タップで「日本語 / English」メニュー
 * - 選択言語は localStorage("app_lang") に保存し、全ページ共通で復元
 * - data-i18n 系属性があれば優先して反映
 * - 無い場合はページごとの主要要素をセレクタで置換（map/tutorial/terms/complete/post-survey/special）
 * ※プレーンJSのみ。テンプレ内の記号はすべて文字列で安全に記述。
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'app_lang';
  var DEFAULT_LANG = 'ja';

  // 画面右上に出すグローブアイコン（SVG）
  var ICON_SVG = (
    '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20m0 2a8 8 0 0 1 7.75 6H15.5a17.7 17.7 0 0 0-1.76-4.5A8.1 8.1 0 0 1 12 4m-2.74.5A15.8 15.8 0 0 1 9.5 8H4.25A8 8 0 0 1 9.26 4.5M4.05 10H9.5c.12 1.02.34 2 .65 2.95c-.45.96-.77 1.95-.96 3H4.05A8 8 0 0 1 4 12c0-.68.02-1.34.05-2m1.2 6.55h4.99c.29 1.4.76 2.76 1.4 3.95a8 8 0 0 1-6.39-3.95M12 20a15.7 15.7 0 0 1-1.7-4.5H13.7A15.7 15.7 0 0 1 12 20m2.75-.5c.64-1.19 1.11-2.55 1.4-3.95h4.99A8 8 0 0 1 14.75 19.5M19.95 16h-5.14c-.19-1.05-.51-2.04-.96-3c.31-.95.53-1.93.65-2.95h5.45c.03.66.05 1.32.05 1.95c0 1.05-.05 2.05-.05 3Z"/>' +
    '</svg>'
  );

  // 文言辞書（必要に応じて追加可）
  var DICT = {
    ja: {
      'lang.ja': '日本語',
      'lang.en': 'English',
      // 共通
      'btn.next': '次へ',
      'btn.back': '戻る',
      'btn.skip': 'skip',
      'btn.start': 'はじめる',
      'btn.close': '閉じる',
      'btn.toSurvey': 'アンケートへ（お答えいただいた方にはスペシャルコンテンツがあります！）',
      'btn.backToMap': 'マップに戻る',
      // map
      'map.title': 'マップ | ARスタンプラリー',
      'map.terms': 'プライバシーポリシー・ご利用上の注意',
      'map.tutorial': 'チュートリアル',
      'map.stampbook': 'スタンプ帳',
      'map.hint': '地図のピンをタップするとスタンプ配置場所までの案内が出ます！（別アプリへ移動）',
      'map.camera': 'カメラ起動',
      'map.completeInline': '🎉 コンプリートを確認する',
      'map.complete.title': '🎉 コンプリート！',
      'map.complete.lead': '全てのスタンプを集めました。ご参加ありがとうございます！',
      'chooser.title': 'スポットを選んでください',
      'chooser.desc': '写真をタップするとARが起動します。',
      // terms
      'terms.title': 'プライバシーポリシー・ご利用上の注意',
      // tutorial
      'tutorial.title': 'チュートリアル',
      // survey
      'survey.title': 'アンケート',
      'survey.submit': 'アンケート送信',
      // complete
      'complete.title': 'コンプリート',
      // special
      'special.title': 'スペシャルコンテンツ'
    },
    en: {
      'lang.ja': '日本語',
      'lang.en': 'English',
      // Common
      'btn.next': 'Next',
      'btn.back': 'Back',
      'btn.skip': 'Skip',
      'btn.start': 'Start',
      'btn.close': 'Close',
      'btn.toSurvey': 'Go to Survey (Special content after submitting!)',
      'btn.backToMap': 'Back to Map',
      // map
      'map.title': 'Map | AR Stamp Rally',
      'map.terms': 'Privacy Policy & Notes',
      'map.tutorial': 'Tutorial',
      'map.stampbook': 'Stamp Book',
      'map.hint': 'Tap a map pin to open directions to the stamp location (opens another app).',
      'map.camera': 'Open Camera',
      'map.completeInline': '🎉 View “Complete”',
      'map.complete.title': '🎉 Completed!',
      'map.complete.lead': 'You collected all the stamps. Thank you for participating!',
      'chooser.title': 'Choose a spot',
      'chooser.desc': 'Tap a photo to launch AR.',
      // terms
      'terms.title': 'Privacy Policy & Usage Notes',
      // tutorial
      'tutorial.title': 'Tutorial',
      // survey
      'survey.title': 'Survey',
      'survey.submit': 'Submit Survey',
      // complete
      'complete.title': 'Complete',
      // special
      'special.title': 'Special Content'
    }
  };

  function getLang() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'ja' || v === 'en') return v;
    } catch (e) {}
    // URLクエリ ?lang=en も受け付け
    try {
      var m = location.search.match(/[?&]lang=(ja|en)/);
      if (m) return m[1];
    } catch (e2) {}
    return DEFAULT_LANG;
  }
  function setLang(lang) {
    var v = (lang === 'en') ? 'en' : 'ja';
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    document.documentElement.setAttribute('lang', v === 'en' ? 'en' : 'ja');
    applyTranslations();
  }
  function t(key) {
    var lang = getLang();
    var d = DICT[lang] || DICT.ja;
    return (d[key] != null) ? d[key] : (DICT.ja[key] || key);
  }

  // data-i18n 系属性を反映
  function applyDataAttributes() {
    var els = document.querySelectorAll('[data-i18n]');
    els.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    htmlEls.forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
    var phEls = document.querySelectorAll('[data-i18n-placeholder]');
    phEls.forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    var ariaEls = document.querySelectorAll('[data-i18n-aria-label]');
    ariaEls.forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', t(key));
    });
    // ページタイトル
    var page = location.pathname.split('/').pop() || '';
    if (page === 'map.html') document.title = t('map.title');
    else if (page === 'terms.html') document.title = t('terms.title');
    else if (page === 'tutorial.html') document.title = t('tutorial.title');
    else if (page === 'post-survey.html') document.title = t('survey.title');
    else if (page === 'complete.html') document.title = t('complete.title');
    else if (page === 'special.html') document.title = t('special.title');
  }

  // data-i18n が無い既存DOMをセレクタで置換（既存HTMLを大きく変えないためのフォールバック）
  function applyPageSpecificFallbacks() {
    var page = location.pathname.split('/').pop() || '';

    if (page === 'map.html' || page === '' || page === 'index.html') {
      var aTerms = document.querySelector('.top-cell.left a');
      if (aTerms) aTerms.textContent = t('map.terms');

      var aTut = document.querySelector('.top-cell.right a');
      if (aTut) aTut.textContent = t('map.tutorial');

      var sbBtn = document.getElementById('stampToggle');
      if (sbBtn) {
        var spans = sbBtn.querySelectorAll('span');
        // [arrow][label][count] という構造を想定
        if (spans && spans[1]) spans[1].textContent = t('map.stampbook');
      }

      var hint = document.querySelector('.hint');
      if (hint) hint.textContent = t('map.hint');

      var camBtn = document.getElementById('cameraBtn');
      if (camBtn) camBtn.textContent = t('map.camera');

      var inline = document.querySelector('#completeInline a');
      if (inline) inline.textContent = t('map.completeInline');

      var chTitle = document.getElementById('cameraChooserTitle');
      if (chTitle) chTitle.textContent = t('chooser.title');

      var chDesc = document.getElementById('cameraChooserDesc');
      if (chDesc) chDesc.textContent = t('chooser.desc');

      var cTitle = document.getElementById('completeTitle');
      if (cTitle) cTitle.textContent = t('map.complete.title');

      var cLead = document.getElementById('completeLead');
      if (cLead) cLead.textContent = t('map.complete.lead');

      var closeComplete = document.getElementById('closeComplete');
      if (closeComplete) closeComplete.textContent = t('btn.backToMap');

      var toSurvey = document.getElementById('toSurvey');
      if (toSurvey) toSurvey.textContent = t('btn.toSurvey');
    }

    if (page === 'tutorial.html') {
      var h1 = document.querySelector('h1');
      if (h1) h1.textContent = t('tutorial.title');

      // 「次へ」「戻る」「skip」「はじめる」ボタン（IDベース）
      var prevBtn = document.getElementById('prevBtn');
      var nextBtn = document.getElementById('nextBtn');
      var skipBtn = document.getElementById('skipBtn');
      if (prevBtn) prevBtn.textContent = t('btn.back');
      if (skipBtn) skipBtn.textContent = t('btn.skip');
      // nextBtn の文言はスライドで変わるため、ここでは未固定
    }

    if (page === 'terms.html') {
      var tH1 = document.querySelector('h1');
      if (tH1) tH1.textContent = t('terms.title');
    }

    if (page === 'post-survey.html') {
      var sH1 = document.querySelector('h1');
      if (sH1) sH1.textContent = t('survey.title');
      var submit = document.getElementById('submitSurveyBtn');
      if (submit) submit.textContent = t('survey.submit');
    }

    if (page === 'complete.html') {
      var compH1 = document.querySelector('h1');
      if (compH1) compH1.textContent = t('complete.title');
      var backBtn = document.getElementById('backToMapBtn');
      if (backBtn) backBtn.textContent = t('btn.backToMap');
    }

    if (page === 'special.html') {
      var spH1 = document.querySelector('h1');
      if (spH1) spH1.textContent = t('special.title');
      var backBtn2 = document.getElementById('backToMapBtn');
      if (backBtn2) backBtn2.textContent = t('btn.backToMap');
    }
  }

  function applyTranslations() {
    applyDataAttributes();
    applyPageSpecificFallbacks();
  }

  // グローブアイコン＋言語メニューを注入
  function injectLanguageButton() {
    if (document.getElementById('langSwitchBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'langSwitchBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Language');
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '1200';
    btn.style.border = '1px solid #d7deea';
    btn.style.background = '#ffffff';
    btn.style.borderRadius = '999px';
    btn.style.padding = '6px 8px';
    btn.style.color = '#222';
    btn.style.boxShadow = '0 6px 18px rgba(0,0,0,.08)';
    btn.innerHTML = ICON_SVG;

    var menu = document.createElement('div');
    menu.id = 'langMenu';
    menu.style.position = 'fixed';
    menu.style.top = '44px';
    menu.style.right = '10px';
    menu.style.zIndex = '1201';
    menu.style.border = '1px solid #d7deea';
    menu.style.background = '#fff';
    menu.style.borderRadius = '12px';
    menu.style.boxShadow = '0 10px 28px rgba(0,0,0,.12)';
    menu.style.display = 'none';
    menu.style.overflow = 'hidden';

    function makeItem(code, labelKey) {
      var a = document.createElement('button');
      a.type = 'button';
      a.textContent = t(labelKey);
      a.style.display = 'block';
      a.style.padding = '10px 14px';
      a.style.width = '160px';
      a.style.textAlign = 'left';
      a.style.background = 'transparent';
      a.style.border = '0';
      a.style.cursor = 'pointer';
      a.addEventListener('click', function () {
        setLang(code);
        menu.style.display = 'none';
      });
      return a;
    }

    menu.appendChild(makeItem('ja', 'lang.ja'));
    menu.appendChild(makeItem('en', 'lang.en'));

    btn.addEventListener('click', function () {
      menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
    });

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target) return;
      var insideBtn = (target === btn || btn.contains(target));
      var insideMenu = (target === menu || menu.contains(target));
      if (!insideBtn && !insideMenu) menu.style.display = 'none';
    });

    document.body.appendChild(btn);
    document.body.appendChild(menu);
  }

  // 初期化
  function boot() {
    // lang 属性と保存言語の整合
    var lang = getLang();
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ja');
    injectLanguageButton();
    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 公開API（必要なら他JSから使用）
  window.AppLang = {
    get: getLang,
    set: setLang,
    t: t,
    refresh: applyTranslations
  };
})();
