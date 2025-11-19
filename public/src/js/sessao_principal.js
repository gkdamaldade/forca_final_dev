function gerarCodigoSala(tamanho = 6) {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = '';
  for (let i = 0; i < tamanho; i++) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length));
  }
  return codigo;
}

document.addEventListener('DOMContentLoaded', () => {
  const btnCriar   = document.getElementById('btnCriar');
  const btnEntrar  = document.getElementById('btnEntrar');


  if (btnCriar) {
    btnCriar.addEventListener('click', () => {
      // NAO LER .VALUE AQUI. DEVE SÓ REDIRECIONAR
      window.location.href = 'categorias.html';
    });
  } else {
    console.warn("Botão #btnCriar não encontrado na página.");
  }

  if (btnEntrar) {
    btnEntrar.addEventListener('click', () => {
      window.location.href = 'sessao_guest.html';
    });
  } else {
    console.warn("Botão #btnEntrar não encontrado na página.");
  }
});

  // somos todos cabaços
/*  if (btnEntrar) {
    btnEntrar.addEventListener('click', () => {
      const inputCodigo  = document.getElementById('codigoSala');
      const selectCateg  = document.getElementById('categoria');

      if (!inputCodigo) {
        console.error("Campo #codigoSala não encontrado.");
        alert('Campo de código da sala não foi encontrado na página.');
        return;
      }
      if (!selectCateg) {
        console.error("Campo #categoria não encontrado.");
        alert('Campo de categoria não foi encontrado na página.');
        return;
      }

      const sala = (inputCodigo.value || '').trim().toUpperCase();
      const categoria = selectCateg.value; // se for <select>, .value funciona

      if (!sala) {
        alert('Digite o código da sala para entrar.');
        return;
      }

      // teste aprovado?
      const params = new URLSearchParams({ sala, categoria });
      window.location.href = `/pages/game.html?${params.toString()}`;
    });
  } else {
    console.warn("Botão #btnEntrar não encontrado na página.");
  }
});*/
