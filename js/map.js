// === map.js ===
// 既存コードの下でもOK。重複しないように addEventListener は1回だけに。

document.addEventListener('DOMContentLoaded', () => {
  const cameraBtn = document.getElementById('cameraBtn');
  if (cameraBtn) cameraBtn.addEventListener('click', openArPermissionFlow);
});

// ---- 1) モーダル表示 → 許可リクエスト → 8th Wallへ遷移 ----
async function openArPermissionFlow() {
  const modal = createArPermissionModal();
  document.body.appendChild(modal);

  // ボタンハンドラ
  modal.querySelector('#arCancelBtn').onclick = () => modal.remove();
  modal.querySelector('#arOkBtn').onclick = async () => {
    try {
      // A) カメラ許可（ユーザー操作の直後に呼ぶ）
      await ensureCameraPermission();

      // B) iOS向け DeviceMotion 許可（可能な端末のみ）
      await tryRequestDeviceMotion();

      // C) 8th Wallの公開URLへ遷移（必要に応じて書き換え）
      const userId = getCurrentUserIdSafely();
      const spotId = getSelectedSpotId() || 'spot1'; // MVPは固定でもOK
      const arUrl = buildArUrl({ spotId, userId });
      window.location.href = arUrl;
    } catch (err) {
      console.error('[AR Permission Flow] error:', err);
      alert('カメラの許可が得られませんでした。端末の設定を確認の上、もう一度お試しください。');
    } finally {
      modal.remove();
    }
  };
}

// ---- 2) モーダルDOMを作るだけ（CSSは下の「style.css追記例」参照）----
function createArPermissionModal() {
  const wrap = document.createElement('div');
  wrap.id = 'ar-permission-modal';
  wrap.innerHTML = `
    <div class="modal-backdrop" role="presentation"></div>
    <div class="modal" role="dialog" aria-labelledby="arModalTitle" aria-modal="true">
      <h2 id="arModalTitle">周囲を確認してください</h2>
      <p>AR開始前に、歩行者や段差など周囲の安全を確認してください。</p>
      <p>次へ進むとカメラ・モーションの許可を求めます。</p>
      <div class="modal-actions">
        <button id="arCancelBtn" class="btn-secondary" type="button">キャンセル</button>
        <button id="arOkBtn" class="btn-primary" type="button">OK</button>
      </div>
    </div>
  `;
  return wrap;
}

// ---- 3) カメラ許可（HTTPS必須・実機推奨）----
async function ensureCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('getUserMediaがサポートされていません');
  }
  // 端末に任せる（リア/フロントは指定しない）
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  // 取得したらすぐ停止してOK（8th Wall側で再度使うため）
  stream.getTracks().forEach(t => t.stop());
}

// ---- 4) iOS向け DeviceMotion 許可（対応端末のみ、拒否でも致命傷ではない）----
async function tryRequestDeviceMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      console.log('DeviceMotion permission:', res);
      // res が 'granted' ならベスト。'denied' でも続行は可能。
    } catch (e) {
      console.warn('DeviceMotion request failed:', e);
    }
  }
}

// ---- 5) 遷移先URLの生成（必要に応じて編集）----
function buildArUrl({ spotId, userId }) {
  // あなたの8th Wall公開URLに置き換え
  const base = 'https://maria261081.8thwall.app/test-3/';
  const q = new URLSearchParams({ spotId, uid: userId });
  return `${base}?${q.toString()}`;
}

// ---- 6) ユーザーIDとスポットIDの取得（MVP用の簡易版）----
function getCurrentUserIdSafely() {
  try {
    // ログイン時に localStorage へ保存している想定（login.js側で保存しておく）
    return localStorage.getItem('userId') || localStorage.getItem('loginName') || 'guest';
  } catch {
    return 'guest';
  }
}
function getSelectedSpotId() {
  // 将来：マーカー選択や地図の選択状態から取得
  return null; // いまは固定で 'spot1'
}

// js/map.js の追記（重複しないようにファイル末尾などに入れてください）
(function () {
  function buildGmapsUrl(lat, lng) {
    // どの端末でも無難に動く検索リンク
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    // 経路案内を強制したいときは下（挙動差あり）
    // return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
  }

  function onPinClick(ev) {
    const btn = ev.currentTarget;
    const lat = btn.getAttribute('data-lat');
    const lng = btn.getAttribute('data-lng');
    const spotId = btn.getAttribute('data-spot-id');
    if (!lat || !lng) return;

    const url = buildGmapsUrl(lat, lng);

    // 解析やログ送信をしたい場合はここで（任意）
    // sendNavigateLog({ spotId, lat, lng });

    // 新しいタブで開く（iOS/Safariのポップアップ制限を避けるため同期で実行）
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function initPins() {
    document.querySelectorAll('.pin').forEach(pin => {
      // click だけでOK。端末によっては touchend を追加してもよいです。
      pin.addEventListener('click', onPinClick, { passive: true });
    });
  }

  // 他の初期化がある場合は干渉しないよう DOMContentLoaded で後からフック
  window.addEventListener('DOMContentLoaded', initPins);
})();
