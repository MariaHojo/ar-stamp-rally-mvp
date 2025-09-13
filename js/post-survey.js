const userName = localStorage.getItem('loginName');
document.getElementById('postSurveyForm').addEventListener('submit', e => {
  e.preventDefault();
  const feedback = e.target.feedback.value;
  if (!userName) return;

  firebase.database().ref('users/' + userName + '/postSurvey').set({ feedback })
    .then(() => {
      alert('送信ありがとうございました！');
      window.location.href = 'map.html';
    });
});
