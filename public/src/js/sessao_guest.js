// import { conectarSocket, aoReceberEvento } from './socket.js';

// document.addEventListener('DOMContentLoaded', async () => {
//   const token = localStorage.getItem('token');
//   if (!token) {
//     window.location.href = 'login.html';
//     return;
//   }

//   let nome = '';
//   try {
//     const payload = JSON.parse(atob(token.split('.')[1]));
//     nome = payload.name;
//   } catch (erro) {
//     console.error('Token inválido:', erro);
//     localStorage.removeItem('token');
//     window.location.href = 'login.html';
//     return;
//   }

//   const inputCodigo = document.getElementById('codigo');
//   const botaoEntrar = document.querySelector('.login-button');

  
//   const teste = await fetch(`/salas/${encodeURIComponent(inputCodigo.value)}`);
//   const dados = await teste.json();
//   const categoria = dados.categoria;

//   botaoEntrar.addEventListener('click', () => {
//     const sala = (inputCodigo.value || '').trim().toUpperCase();
//     if (!sala) {
//       alert('Informe o código da sala.');
//       return;
//     }

//     conectarSocket(sala, nome, categoria);

//     aoReceberEvento((evento) => {
//       if (evento.tipo === 'preparacao') {
//         window.location.href = `/pages/sessao_preparacao.html?sala=${encodeURIComponent(sala)}&categoria=${encodeURIComponent(categoria)}`;
//       }
//     });
//   });
// });
import { conectarSocket, aoReceberEvento } from './socket.js';

document.addEventListener('DOMContentLoaded', () => {

  // --- Autenticação ---
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  let nome = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    nome = payload.name || payload.nome;
  } catch (erro) {
    console.error('Token inválido:', erro);
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    return;
  }

  const inputCodigo = document.getElementById('codigo');
  const botaoEntrar = document.querySelector('.login-button');

  if (!inputCodigo || !botaoEntrar) {
    console.error("Erro: Elementos #codigo ou .login-button não encontrados.");
    return;
  }

  // --- Clique no botão ENTRAR NA SALA ---
  botaoEntrar.addEventListener('click', async () => {
    const sala = (inputCodigo.value || '').trim().toUpperCase();

    if (!sala) {
      alert('Informe o código da sala.');
      return;
    }

    try {
      // 🔍 Buscar categoria da sala
      const resposta = await fetch(`/api/salas/${encodeURIComponent(sala)}`);

      if (!resposta.ok) {
        alert("Sala não encontrada.");
        return;
      }

      const dados = await resposta.json();
      const categoria = dados?.categoria || "Geral";

      // --- Conecta ao WebSocket ---
      conectarSocket(sala, nome, categoria);

      // --- Escuta eventos ---
      aoReceberEvento((evento) => {
        if (evento.tipo === 'preparacao') {
          window.location.href =
            `sessao_preparacao.html?sala=${encodeURIComponent(sala)}&categoria=${encodeURIComponent(categoria)}`;
        }
      });

    } catch (e) {
      console.error("Erro ao entrar na sala:", e);
      alert("Erro ao conectar à sala. Tente novamente.");
    }
  });
});


