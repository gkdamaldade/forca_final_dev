// 1. Defina a URL no topo do arquivo para não ter erro de escopo
// ATENÇÃO: Verifique na aba 'PORTAS' se este é o endereço atual da porta 3000!
const BACKEND_URL = 'https://forcateste-production.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
    carregarRanking();
});

async function carregarRanking() {
    const listaContainer = document.querySelector('.ranking-lista');
    
    if (!listaContainer) {
        console.error("Erro: Elemento .ranking-lista não encontrado no HTML.");
        return;
    }

    // Mostra loading
    listaContainer.innerHTML = '<p style="color: white; text-align: center;">Carregando ranking...</p>';

    try {
        // Usa a variável que definimos no topo
        // const response = await fetch(`${BACKEND_URL}/api/ranking`);
        const response = await fetch(`/api/players/ranking`);

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }

        const rankingData = await response.json();

        // Limpa o container
        listaContainer.innerHTML = '';

        if (rankingData.length === 0) {
            listaContainer.innerHTML = '<p style="color: white; text-align: center;">Nenhum jogador encontrado.</p>';
            return;
        }

        // Gera a lista
        rankingData.forEach((jogador, index) => {
            const item = document.createElement('div');
            item.classList.add('ranking-item');

            if (index === 0) item.classList.add('primeiro-lugar');
            if (index === 1) item.classList.add('segundo-lugar');
            if (index === 2) item.classList.add('terceiro-lugar');

            item.innerHTML = `
                <div class="rank-posicao">${index + 1}º</div>
                <div class="rank-info">
                    <span class="rank-nome">${jogador.nome}</span>
                </div>
                <div class="rank-vitorias">${jogador.vitorias} vitórias</div>
            `;

            listaContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
        // Mostra o erro na tela (opcional, ajuda a debugar)
        listaContainer.innerHTML = `<p style="color: #ff5555; text-align: center;">Erro ao carregar: ${error.message}</p>`;
    }
}
