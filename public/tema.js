// Aplica a preferência antes de desenhar a página para evitar um clarão ao abrir.
(() => {
  const chave = 'conversor-tema';
  let tema = 'claro';
  try { if (localStorage.getItem(chave) === 'escuro') tema = 'escuro'; } catch { /* Armazenamento pode estar desativado. */ }

  function aplicar(novoTema) {
    tema = novoTema;
    document.documentElement.dataset.theme = tema;
    const corNavegador = document.querySelector('meta[name="theme-color"]');
    if (corNavegador) corNavegador.content = tema === 'escuro' ? '#111b27' : '#152c40';
    const botao = document.querySelector('#alternar-tema');
    if (botao) {
      botao.textContent = tema === 'escuro' ? '☀ Modo claro' : '☾ Modo noturno';
      botao.setAttribute('aria-pressed', String(tema === 'escuro'));
      botao.setAttribute('aria-label', tema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo noturno');
    }
  }

  aplicar(tema);
  document.addEventListener('DOMContentLoaded', () => {
    aplicar(tema);
    document.querySelector('#alternar-tema')?.addEventListener('click', () => {
      aplicar(tema === 'escuro' ? 'claro' : 'escuro');
      try { localStorage.setItem(chave, tema); } catch { /* A escolha vale nesta aba. */ }
    });
  });
})();
