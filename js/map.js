// === map.js（方法B用：ピンのクリック処理は削除済み）===

// 1) DOM読み込み後にカメラ起動ボタンだけセット
document.addEventListener('DOMContentLoaded', () => {
  const cameraBtn = document.getElementById('cameraBtn');
  if (cameraBtn) cameraBtn.addEventListener('click', openArPermissionFlow);
});

// ---- カメラ起動フロー ----
async function openArPermissionFlow() {
  const modal = createArPermissionModal();
  document.body.appendChild(modal);

  modal.querySelector('#arCancelBtn').onclick = () => modal.remove();
  modal.querySelector('#arOkBtn').onclick = async () => {
    try {
      await ensureCameraPermission();
      await tryRequestDeviceMotion();

      const userId = getCurrentUserIdSafely();
      const spotId = 'spot1'; // 必要なら map.html の状態から取得して切り替え
      const arUrl = buildArUrl({ spotId, userId });

      window.location.href = arUrl;
    } catch (err) {
      console.error('[AR Permission Flow] error:', err);
      alert('カメラの許可が得られませんでした。設定を確認してください。');
    } finally {
      modal.remove();
    }
  };
}

// ---- モーダルDOM ----
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

// ---- カメラ許可 ----
async function ensureCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('getUserMediaがサポートされていません');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  stream.getTracks().forEach(t => t.stop());
}

// ---- DeviceMotion 許可（iOS向け）----
async function tryRequestDeviceMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      console.log('DeviceMotion permission:', res);
    } catch (e) {
      console.warn('DeviceMotion request failed:', e);
    }
  }
}

// ---- 遷移先URL ----
function buildArUrl({ spotId, userId }) {
  const base = 'https://maria261081.8thwall.app/test-3/';
  const q = new URLSearchParams({ spotId, uid: userId });
  return `${base}?${q.toString()}`;
}

// ---- ユーザーID取得 ----
function getCurrentUserIdSafely() {
  try {
    return localStorage.getItem('userId') || localStorage.getItem('loginName') || 'guest';
  } catch {
    return 'guest';
  }
}
