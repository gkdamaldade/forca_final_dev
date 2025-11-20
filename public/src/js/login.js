
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  const mensagemErro = document.getElementById('mensagem-erro');

  if (!formLogin) {
    console.error("Erro: <form id='form-login'> não foi encontrado.");
    return;
  }

  formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = event.target.email.value.trim();
    const password = event.target.password.value;
    if (mensagemErro) mensagemErro.textContent = '';

    if (!email || !password) {
      const msg = 'Preencha e-mail e senha.';
      mensagemErro ? mensagemErro.textContent = msg : alert(msg);
      return;
    }

    try {
      // SAME-ORIGIN: sem BACKEND_URL
      const response = await fetch('api/players/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se a sua API usar cookie HttpOnly, descomente:
        // credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      // Tenta extrair JSON mesmo quando não-ok
      let payload = null;
      try { payload = await response.json(); } catch {}

      if (!response.ok) {
        const msg = payload?.message || `Erro ${response.status}`;
        throw new Error(msg);
      }

      // Sucesso
      console.log('Login bem-sucedido:', payload);

      // Se a API devolve token no corpo (padrão atual do seu cadastro/login)
      if (payload?.token) {
        localStorage.setItem('token', payload.token);
      }
      if (payload?.user) {
        localStorage.setItem('user', JSON.stringify(payload.user));
      }

      // Transição suave para a próxima tela
      const body = document.body;
      body.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
      body.style.opacity = '0';
      body.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        window.location.href = 'menu.html';
      }, 500);

    } catch (error) {
      const hint = error instanceof TypeError
        ? ' (verifique conexão e se /api/login está acessível no mesmo domínio)'
        : '';
      const msg = `Falha no login: ${error.message}${hint}`;
      console.error(msg);
      mensagemErro ? (mensagemErro.textContent = msg) : alert(msg);
    }
  });
});
