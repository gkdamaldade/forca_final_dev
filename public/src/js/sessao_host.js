// Importações necessárias
// NOTA: Certifique-se de que o caminho './socket.js' é válido
// em relação a onde 'sessao_host.js' está localizado.
import { conectarSocket, aoReceberEvento } from './socket.js';

// O código é executado imediatamente porque é um módulo, mas a manipulação
// de elementos do DOM deve ser segura. Como é um módulo e está no final do body,
// geralmente funciona. Usaremos DOMContentLoaded para segurança extra.
document.addEventListener('DOMContentLoaded', () => {

    // 1. Obtenção de Parâmetros e Token
    const urlParams = new URLSearchParams(window.location.search);
    const sala = urlParams.get('sala');
    const categoria = urlParams.get('categoria') || 'Geral';
    const token = localStorage.getItem('token');

    let nome;
    
    // Decodifica o token para obter o nome e ID (necessário para o socket)
    let playerId = null;
    try {
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) throw new Error('Token mal formatado.');
        
        // O token é decodificado dentro de um bloco try/catch para evitar crash
        const payload = JSON.parse(atob(tokenParts[1]));
        nome = payload.name || payload.nome; // Tenta pegar o nome por 'name' ou 'nome'
        playerId = payload.id || null; // Pega o ID do jogador

        if (!nome) {
            console.error('Nome do usuário não encontrado no payload do token.');
            // Se o nome não for encontrado, redireciona, ou usa um nome padrão
            // window.location.href = 'login.html'; return;
            nome = 'Host'; 
        }

    } catch (e) {
        console.error('Erro ao decodificar token:', e);
        // Redireciona para login se o token for inválido/inexistente
        window.location.href = 'login.html';
        return;
    }

    // 2. Exibição da Sala
    const salaIdElement = document.getElementById('sala-id');
    if (salaIdElement) {
        salaIdElement.textContent = sala;
    } else {
        console.error("Elemento 'sala-id' não encontrado no HTML.");
    }

    // 3. Conexão ao Socket
    // Conecta ao socket e entra na sala com os dados do usuário e categoria
    conectarSocket(sala, nome, playerId, categoria);

    // 4. Escuta Eventos de Preparação
    // Escuta o evento de preparação (quando o segundo jogador entra)
    aoReceberEvento((evento) => {
        if (evento.tipo === 'preparacao') {
            console.log('Oponente entrou. Redirecionando para tela unificada do jogo...');
            // Redireciona para a próxima tela, passando os parâmetros da sala
            window.location.href = `game.html?sala=${sala}&categoria=${categoria}`;
        }
        // Você pode adicionar mais listeners aqui (ex: 'erro', 'oponenteDesconectou', etc.)
    });
});
