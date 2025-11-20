/**
 * Arquivo: categorias.js
 * Descrição: Lógica para autenticação, exibição de saudação e criação de salas de jogo por categoria.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. Variáveis e Mapeamento
    // ----------------------------------------------------------------------
    const token = localStorage.getItem('token');
    
    // Mapeamento das categorias presentes no HTML para as categorias que a API espera.
    // O JS buscará o atributo 'aria-label' do botão e usará o nome correspondente.
    const categoriasValidas = [
        'Alimento', 'Animais', 'Esportes', 'Países', 'Profissões'
        // Adicione outras categorias do HTML aqui se houver mais botões na grade.
    ];
    
    // ----------------------------------------------------------------------
    // 2. Verificação de Autenticação
    // ----------------------------------------------------------------------
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let nomeUsuario = '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Tenta extrair o nome de diferentes chaves (boas práticas)
        nomeUsuario = payload.name || payload.nome || payload.username || 'Jogador(a)';
    } catch (erro) {
        console.error('Token inválido ou expirado:', erro);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }

    // ----------------------------------------------------------------------
    // 3. Exibição da Saudação
    // ----------------------------------------------------------------------
    const menuContainer = document.querySelector('.menu-container');
    if (menuContainer) {
        const saudacaoEl = document.createElement('p');
        saudacaoEl.className = 'saudacao';
        saudacaoEl.textContent = `Olá, ${nomeUsuario}! Escolha uma categoria:`;
        
        // Em vez de usar .prepend no .menu-container, você pode inseri-lo no .menu-title
        const menuTitle = document.querySelector('.menu-title');
        if (menuTitle) {
            menuTitle.appendChild(saudacaoEl);
        } else {
            // Caso .menu-title não exista, usa o container principal
            menuContainer.prepend(saudacaoEl);
        }
    }

    // ----------------------------------------------------------------------
    // 4. Configuração dos Botões da Grade
    // ----------------------------------------------------------------------
    
    // Seleciona todos os botões da grade
    const botoes = document.querySelectorAll('.grid-button');

    botoes.forEach(botao => {
        // Obter o nome da categoria a partir do atributo 'aria-label' do HTML
        const categoria = botao.getAttribute('aria-label');
        
        // Verifica se a categoria está mapeada e é válida antes de adicionar o listener
        if (!categoria || !categoriasValidas.includes(categoria)) {
            console.warn(`Categoria inválida ou não mapeada: ${categoria}. Botão ignorado.`);
            return; 
        }

        // Adiciona o event listener de clique para a criação da sala
        botao.addEventListener('click', async () => {
            try {
                // Remove o disabled do botão se ele estiver lá.
                botao.disabled = true;

                const resp = await fetch('/api/salas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ categoria })
                });

                const data = await resp.json().catch(() => ({}));
                
                if (!resp.ok) {
                    throw new Error(data?.message || `Erro ao criar sala (${resp.status})`);
                }

                // Redirecionamento após sucesso
                const params = new URLSearchParams({ sala: data.sala, categoria: data.categoria });
                window.location.href = `/public/pages/sessao_host.html?${params.toString()}`;

            } catch (e) {
                alert(`Falha ao criar sala para ${categoria}: ${e.message}`);
            } finally {
                // Reabilita o botão em caso de erro
                botao.disabled = false;
            }
        });
    });
});
