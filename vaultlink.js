(function () {
  var VAULT = 'https://artscriptvault.netlify.app';
  function add() {
    var v = document.querySelector('.vault.open');
    if (!v || v.querySelector('.vault-go')) return;
    var a = document.createElement('a');
    a.className = 'cta vault-go';
    a.href = VAULT;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Go to Art Scripters Vault';
    v.appendChild(a);
  }
  new MutationObserver(add).observe(document.documentElement, { childList: true, subtree: true });
  add();
})();
