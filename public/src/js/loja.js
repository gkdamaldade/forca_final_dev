/**
 * Arquivo: loja.js
 * Descrição: Lógica para o carrossel de habilidades da loja,
 * exibição de moedas e simulação de compra.
 */

// Array de habilidades (dados brutos)
const habilidades = [
    {
        nome: "Vida extra",
        descricao: "Ganha uma vida adicional.",
        preco: 2500,
        id: "vida_extra",
        imagem: "public/assets/images/vida_extra.png"
    },
    {
        nome: "Tirar vida",
        descricao: "Remove uma vida do adversário.",
        preco: 2500,
        id: "tirar_vida",
        imagem: "public/assets/images/Tirar_vida.png"
    },
    {
        nome: "Ocultar letra",
        descricao: "Oculta uma letra correta da palavra.",
        preco: 2500,
        id: "ocultar_letra",
        imagem: "public/assets/images/ocultar_letra.png"
    },
    {
        nome: "Ocultar dica",
        descricao: "Remove a dica da rodada.",
        preco: 2500,
        id: "ocultar_dica",
        imagem: "public/assets/images/ocultar_dica.png"
    },
    {
        nome: "Liberar letra",
        descricao: "Revela uma letra correta da palavra.",
        preco: 2500,
        id: "liberar_letra",
        imagem: "public/assets/images/liberar_letra.png"
    },
    {
        nome: "Palpite",
        descricao: "Habilidade especial para virar o jogo.",
        preco: 2500,
        id: "palpite",
        imagem: "public/assets/images/palpite.png"
    }
];

let indiceAtual = 0;
let moedasAtuais = 0; // Variável para rastrear o saldo atual.

// Função auxiliar para obter/converter moedas do DOM
function carregarMoedasUsuario() {
    // SIMULAÇÃO: 
    // Garante que o valor inicial seja alto (e sem formatação de milhar) para o teste.
    const saldoSimulado = localStorage.getItem('saldo_moedas') ? 
                          parseInt(localStorage.getItem('saldo_moedas')) : 
                          15000; // MUDANÇA: Coloque aqui o valor COMPLETO.
    setSaldoMoedas(saldoSimulado);
}
// Função auxiliar para formatar e exibir moedas
function setSaldoMoedas(saldo) {
    moedasAtuais = saldo;
    document.getElementById('moedas-atual').textContent = saldo.toLocaleString('pt-BR');
    localStorage.setItem('saldo_moedas', saldo); 
}

/**
 * 1. Carrega e exibe o saldo de moedas do usuário.
 * ⚠️ Em um projeto real, aqui você faria uma chamada API para o backend.
 */
function carregarMoedasUsuario() {
    // SIMULAÇÃO: Carrega um saldo inicial (ex: do localStorage ou um valor padrão)
    const saldoSimulado = localStorage.getItem('saldo_moedas') ? 
                          parseInt(localStorage.getItem('saldo_moedas')) : 
                          1500; 

    setSaldoMoedas(saldoSimulado);
}

/**
 * 2. Lógica de Compra de Habilidade
 */
function comprarHabilidade(item) {
    const moedasNecessarias = item.preco;
    
    if (moedasAtuais >= moedasNecessarias) {
        if (confirm(`Deseja realmente comprar ${item.nome} por ${item.preco.toLocaleString('pt-BR')} moedas?`)) {
            
            // ⚠️ SIMULAÇÃO: Chamar API para registrar compra e deduzir saldo.
            // Ex: fetch('/api/comprar', { method: 'POST', body: JSON.stringify({ userId, itemId: item.id }) });
            
            const novoSaldo = moedasAtuais - moedasNecessarias;
            setSaldoMoedas(novoSaldo);
            localStorage.setItem('saldo_moedas', novoSaldo); // Salva a simulação
            
            alert(`Parabéns! Você comprou ${item.nome}. Novo saldo: ${novoSaldo.toLocaleString('pt-BR')} moedas.`);
        }
    } else {
        alert(`Você precisa de mais moedas para comprar ${item.nome}. Saldo atual: ${moedasAtuais.toLocaleString('pt-BR')}.`);
    }
}


// O evento DOMContentLoaded garante que este código só será executado depois
// que toda a estrutura HTML da página for carregada e construída.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Seleção dos Elementos HTML ---
    const nomeEl = document.querySelector(".habilidade-nome");
    const descEl = document.querySelector(".habilidade-desc");
    const precoEl = document.querySelector(".preco");
    const imgEl = document.querySelector(".card-header img");
    const btnComprar = document.querySelector(".btn-comprar");
    const indicadoresEl = document.querySelector(".indicadores");
    const leftArrow = document.querySelector(".arrow-btn.left");
    const rightArrow = document.querySelector(".arrow-btn.right");

    const modalBtnComprarMoedas = document.querySelector(".btn-comprar-moedas");
    const modalBtnConfirmar = document.querySelector(".modal-actions .btn-confirmar");
    const modalBtnCancelar = document.querySelector(".modal-actions .btn-cancelar");
    const modal = document.getElementById('comprar-moedas');

    if (!nomeEl || !imgEl || !indicadoresEl || !leftArrow || !rightArrow || !btnComprar) {
        console.error("ERRO: Elementos essenciais do DOM para o carrossel não encontrados.");
        return; 
    }

    // --- 2. Funções de Atualização do Carrossel ---
    function atualizarIndicadores() {
        indicadoresEl.innerHTML = "";
        habilidades.forEach((_, i) => {
            const dot = document.createElement("span");
            dot.classList.add("dot");
            if (i === indiceAtual) dot.classList.add("active");
            indicadoresEl.appendChild(dot);
        });
    }

    function atualizarCard() {
        const habilidade = habilidades[indiceAtual];
        nomeEl.textContent = habilidade.nome;
        descEl.textContent = habilidade.descricao;
        
        // Formata o preço com separador de milhar
        const precoFormatado = habilidade.preco.toLocaleString('pt-BR');

        precoEl.innerHTML = `Preço: <strong>${precoFormatado}</strong> <i class="fa-solid fa-coins" aria-hidden="true"></i>`;
        imgEl.src = habilidade.imagem;
        
        // Armazena o índice atual no botão para facilitar a compra
        btnComprar.dataset.index = indiceAtual; 

        // Adiciona classe de aviso se o jogador não tiver moedas suficientes
        if (moedasAtuais < habilidade.preco) {
            btnComprar.classList.add('sem-saldo');
            btnComprar.textContent = "Sem saldo";
        } else {
            btnComprar.classList.remove('sem-saldo');
            btnComprar.textContent = "Comprar";
        }

        atualizarIndicadores();
    }

    // --- 3. Listeners de Evento do Carrossel ---
    
    // Botão de Compra de Habilidade
    btnComprar.addEventListener("click", () => {
        const index = parseInt(btnComprar.dataset.index);
        if (!isNaN(index)) {
            comprarHabilidade(habilidades[index]);
            // Re-atualiza o card e o estado do botão "Comprar" após a tentativa
            atualizarCard(); 
        }
    });

    // Seta Esquerda
    leftArrow.addEventListener("click", () => {
        indiceAtual = (indiceAtual - 1 + habilidades.length) % habilidades.length;
        atualizarCard();
    });

    // Seta Direita
    rightArrow.addEventListener("click", () => {
        indiceAtual = (indiceAtual + 1) % habilidades.length;
        atualizarCard();
    });

    // --- 4. Listeners de Evento do Modal de Compra de Moedas ---

    // Ação do Botão "Confirmar compra"
    modalBtnConfirmar.addEventListener('click', (e) => {
        e.preventDefault();
        
        const pacoteSelecionadoEl = document.querySelector('input[name="pacote"]:checked').closest('.pacote-box');
        
        if (!pacoteSelecionadoEl) {
            alert('Por favor, selecione um pacote de moedas.');
            return;
        }

        const moedasGanhaStr = pacoteSelecionadoEl.querySelector('.pacote-moedas').textContent.replace('.', '').trim();
        const moedasGanha = parseInt(moedasGanhaStr);
        const precoReal = pacoteSelecionadoEl.querySelector('.pacote-preco').textContent;
        
        // SIMULAÇÃO: Sucesso na compra (ignorando o método de pagamento real)
        const novoSaldo = moedasAtuais + moedasGanha;
        setSaldoMoedas(novoSaldo);
        localStorage.setItem('saldo_moedas', novoSaldo); // Salva a simulação
        
        // Re-atualiza o estado do botão 'Comprar' no card
        atualizarCard(); 

        alert(`COMPRA SIMULADA CONCLUÍDA: Você comprou ${moedasGanha.toLocaleString('pt-BR')} moedas por ${precoReal}. Novo saldo: ${novoSaldo.toLocaleString('pt-BR')} moedas.`);
        
        // Fecha o modal após a simulação de compra
        window.location.hash = '';
    });

    // Ação do botão "Cancelar" no modal
    modalBtnCancelar.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = ''; // Remove a âncora para fechar o modal
    });
    
    // Configura o botão para abrir o modal via âncora (se necessário, o HTML já deve fazer isso)
    if (modalBtnComprarMoedas) {
        modalBtnComprarMoedas.addEventListener('click', (e) => {
            // Se o href for '#comprar-moedas', o browser já vai abrir o modal
        });
    }

    // --- 5. Inicialização ---
    carregarMoedasUsuario(); // Carrega o saldo e define moedasAtuais
    atualizarCard();        // Exibe o primeiro card e atualiza os indicadores
});
