// O console.log deve ficar aqui para indicar o carregamento do script externo
console.log("menu.js carregado!");

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Lógica de Segurança e Saudação (MANTIDA) ---
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const nomeUsuario = payload.nome;

        // Cria container da saudação com ícones
        const saudacaoContainer = document.createElement('div');
        saudacaoContainer.className = 'saudacao-container';
        
        // Ícone esquerdo (onda)
        const iconeEsquerdo = document.createElement('i');
        iconeEsquerdo.className = 'fas fa-water saudacao-icone icone-esquerdo';
        
        // Texto da saudação
        const saudacaoTexto = document.createElement('span');
        saudacaoTexto.className = 'saudacao-texto';
        saudacaoTexto.innerHTML = `<span class="saudacao-prefixo">Bem-vindo</span>, <span class="saudacao-nome">${nomeUsuario}</span>!`;
        
        // Ícone direito (estrela)
        const iconeDireito = document.createElement('i');
        iconeDireito.className = 'fas fa-star saudacao-icone icone-direito';
        
        // Monta a estrutura
        saudacaoContainer.appendChild(iconeEsquerdo);
        saudacaoContainer.appendChild(saudacaoTexto);
        saudacaoContainer.appendChild(iconeDireito);
        
        // Adiciona ao menu container
        const menuContainer = document.querySelector('.menu-container');
        if (menuContainer) {
            menuContainer.prepend(saudacaoContainer);
        }
    } catch (erro) {
        console.error('Token inválido ou expirado:', erro);
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }
    
    // ----------------------------------------------------
    // --- LÓGICA DE NAVEGAÇÃO UNIFICADA (Bloco B otimizado) ---
    
    // 1. Botão Principal: JOGAR
    const botaoJogar = document.querySelector('.menu-button');

    if (botaoJogar) {
        botaoJogar.addEventListener('click', () => {
            console.log("Clicou em JOGAR. Redirecionando para sessao_principal.html");
            window.location.href = 'sessao_principal.html'; 
        });
    } else {
        console.error("Erro: Botão .menu-button (JOGAR) não encontrado.");
    }
    
    // 2. Botões de Ícone (Círculo)
    const botoesCirculo = document.querySelectorAll('.circle-button');
    
    botoesCirculo.forEach(botao => {
        botao.addEventListener('click', () => {
            // Pega o ícone para saber qual botão foi clicado
            const icone = botao.querySelector('i');

            if (icone) {
                 if (icone.classList.contains('fa-medal')) {
                    console.log("Clicou em RANKING.");
                    window.location.href = 'ranking.html';

                } else if (icone.classList.contains('fa-shopping-cart')) {
                    console.log("Clicou em LOJA.");
                    window.location.href = 'loja.html';
                
                // NOTA: O terceiro botão (Configurações) NÃO existe no seu HTML atual, 
                // então este listener não vai funcionar para ele.
                } else if (icone.classList.contains('fa-cog')) {
                    console.log("Clicou em CONFIGURAÇÕES.");
                    window.location.href = 'configuracoes.html'; 
                }
            }
        });
    });
});
