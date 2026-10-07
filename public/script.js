(function () {
  const form = document.getElementById('create-form');
  const urlInput = document.getElementById('url-input');
  const resultBox = document.getElementById('result');
  const resultInput = document.getElementById('result-input');
  const copyBtn = document.getElementById('copy-btn');
  const errorEl = document.getElementById('error');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    resultBox.classList.add('hidden');
  }

  function showResult(shortUrl) {
    errorEl.classList.add('hidden');
    resultInput.value = shortUrl;
    resultBox.classList.remove('hidden');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const url = urlInput.value.trim();
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Something went wrong.');
        return;
      }
      showResult(data.shortUrl);
    } catch (err) {
      showError('Network error. Please try again.');
    }
  });

  copyBtn.addEventListener('click', function () {
    resultInput.select();
    navigator.clipboard?.writeText(resultInput.value).catch(() => {});
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 1500);
  });
})();
