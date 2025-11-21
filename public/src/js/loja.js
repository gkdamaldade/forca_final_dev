/**
 * Arquivo: loja.js
 * Descrição: Lógica para o carrossel de habilidades da loja,
 * exibição de moedas e simulação de compra.
 */

// Array de habilidades (será carregado do banco)
let habilidades = [];
let indiceAtual = 0;
let moedasAtuais = 0; // Variável para rastrear o saldo atual.
let atualizarCardRef = null; // Referência global para a função atualizarCard

// Função auxiliar para formatar e exibir moedas
function setSaldoMoedas(saldo) {
    moedasAtuais = saldo;
    const moedasEl = document.getElementById('moedas-atual');
    if (moedasEl) {
        moedasEl.textContent = saldo.toLocaleString('pt-BR');
    }
}

/**
 * 1. Carrega os itens da loja do banco de dados.
 */
async function carregarItensLoja() {
    try {
        const response = await fetch('/api/players/loja/itens', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao carregar itens da loja: ${response.status}`);
        }

        const itens = await response.json();
        
        // Converte os itens do banco para o formato esperado pelo frontend
        habilidades = itens.map(item => ({
            id: item.id, // ID do banco
            nome: item.nome,
            descricao: item.descricao,
            preco: item.custo_moedas,
            tipo_poder: item.tipo_poder,
            imagem: item.imagem || `/public/assets/images/${item.tipo_poder}.png`
        }));
        
        console.log('Itens da loja carregados:', habilidades.length);
        
        return habilidades;
    } catch (error) {
        console.error('Erro ao carregar itens da loja:', error);
        // Em caso de erro, retorna array vazio
        return [];
    }
}

/**
 * 2. Carrega e exibe o saldo de moedas do usuário do banco de dados.
 */
async function carregarMoedasUsuario() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('Token não encontrado. Redirecionando para login...');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('/api/players/moedas', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token inválido ou expirado
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`Erro ao carregar moedas: ${response.status}`);
        }

        const data = await response.json();
        setSaldoMoedas(data.moedas || 0);
    } catch (error) {
        console.error('Erro ao carregar moedas do usuário:', error);
        // Em caso de erro, mantém o valor padrão de 0
        setSaldoMoedas(0);
    }
}

/**
 * 3. Lógica de Compra de Habilidade
 */
async function comprarHabilidade(item) {
    const moedasNecessarias = item.preco;
    
    if (moedasAtuais < moedasNecessarias) {
        alert(`Você precisa de mais moedas para comprar ${item.nome}. Saldo atual: ${moedasAtuais.toLocaleString('pt-BR')}.`);
        return;
    }
    
    if (!confirm(`Deseja realmente comprar ${item.nome} por ${item.preco.toLocaleString('pt-BR')} moedas?`)) {
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/players/comprar-poder', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemlojaId: item.id // Agora usa o ID do banco (itemloja)
            })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                alert('Sessão expirada. Por favor, faça login novamente.');
                window.location.href = 'login.html';
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro ao processar compra: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Atualiza o saldo com o novo valor retornado pela API
        setSaldoMoedas(data.novoSaldo);
        
        // Re-atualiza o estado do botão 'Comprar' no card
        if (atualizarCardRef) {
            atualizarCardRef();
        }
        
        alert(`Parabéns! Você comprou ${item.nome}. Novo saldo: ${data.novoSaldo.toLocaleString('pt-BR')} moedas.`);
    } catch (error) {
        console.error('Erro ao comprar poder:', error);
        alert(`Erro ao processar a compra: ${error.message}`);
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
    
    // Armazena a referência da função globalmente para uso em comprarHabilidade
    atualizarCardRef = atualizarCard;

    // --- 3. Listeners de Evento do Carrossel ---
    
    // Botão de Compra de Habilidade
    btnComprar.addEventListener("click", async () => {
        const index = parseInt(btnComprar.dataset.index);
        if (!isNaN(index)) {
            await comprarHabilidade(habilidades[index]);
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
    if (!modalBtnConfirmar) {
        console.error("ERRO: Botão de confirmar compra não encontrado.");
    } else {
    modalBtnConfirmar.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const pacoteInputChecked = document.querySelector('input[name="pacote"]:checked');
        
        if (!pacoteInputChecked) {
            alert('Por favor, selecione um pacote de moedas.');
            return;
        }
        
        // Encontra o pacote-box dentro do label que contém o input checked
        const pacoteLabel = pacoteInputChecked.closest('.pacote');
        const pacoteSelecionadoEl = pacoteLabel?.querySelector('.pacote-box');
        
        if (!pacoteSelecionadoEl) {
            alert('Erro ao processar o pacote selecionado. Tente novamente.');
            return;
        }

        const metodoPagamentoEl = document.querySelector('input[name="metodo"]:checked');
        if (!metodoPagamentoEl) {
            alert('Por favor, selecione um método de pagamento.');
            return;
        }

        const moedasGanhaStr = pacoteSelecionadoEl.querySelector('.pacote-moedas').textContent.replace(/[^\d]/g, '').trim();
        const moedasGanha = parseInt(moedasGanhaStr);
        const precoReal = pacoteSelecionadoEl.querySelector('.pacote-preco').textContent;
        
        if (isNaN(moedasGanha) || moedasGanha <= 0) {
            alert('Erro ao processar a quantidade de moedas. Tente novamente.');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Sessão expirada. Por favor, faça login novamente.');
            window.location.href = 'login.html';
            return;
        }

        // Desabilita o botão durante o processamento
        const textoOriginal = modalBtnConfirmar.textContent;
        modalBtnConfirmar.style.pointerEvents = 'none';
        modalBtnConfirmar.style.opacity = '0.6';
        modalBtnConfirmar.textContent = 'Processando...';

        try {
            const response = await fetch('/api/players/comprar-moedas', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quantidade: moedasGanha
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    alert('Sessão expirada. Por favor, faça login novamente.');
                    window.location.href = 'login.html';
                    return;
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Erro ao processar compra: ${response.status}`);
            }

            const data = await response.json();
            
            // Atualiza o saldo com o novo valor retornado pela API
            setSaldoMoedas(data.novoSaldo);
            
            // Re-atualiza o estado do botão 'Comprar' no card
            atualizarCard(); 

            alert(`Compra concluída! Você comprou ${moedasGanha.toLocaleString('pt-BR')} moedas por ${precoReal}. Novo saldo: ${data.novoSaldo.toLocaleString('pt-BR')} moedas.`);
            
            // Fecha o modal após a compra
            window.location.hash = '';
        } catch (error) {
            console.error('Erro ao comprar moedas:', error);
            alert(`Erro ao processar a compra: ${error.message}`);
        } finally {
            // Reabilita o botão
            modalBtnConfirmar.style.pointerEvents = '';
            modalBtnConfirmar.style.opacity = '';
            modalBtnConfirmar.textContent = textoOriginal;
        }
    });
    }

    // Ação do botão "Cancelar" no modal
    if (modalBtnCancelar) {
        modalBtnCancelar.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = ''; // Remove a âncora para fechar o modal
        });
    }
    
    // Atualiza o destaque dos pacotes quando um é selecionado
    const pacoteInputs = document.querySelectorAll('input[name="pacote"]');
    pacoteInputs.forEach(input => {
        // Adiciona destaque ao pacote inicialmente selecionado
        if (input.checked) {
            const selectedBox = input.closest('.pacote')?.querySelector('.pacote-box');
            if (selectedBox) {
                selectedBox.classList.add('destaque');
            }
        }
        
        input.addEventListener('change', () => {
            // Remove a classe destaque de todos os pacotes
            document.querySelectorAll('.pacote-box').forEach(box => {
                box.classList.remove('destaque');
            });
            // Adiciona destaque ao pacote selecionado
            const selectedBox = input.closest('.pacote')?.querySelector('.pacote-box');
            if (selectedBox) {
                selectedBox.classList.add('destaque');
            }
        });
    });
    
    // Configura o botão para abrir o modal via âncora (se necessário, o HTML já deve fazer isso)
    if (modalBtnComprarMoedas) {
        modalBtnComprarMoedas.addEventListener('click', (e) => {
            // Se o href for '#comprar-moedas', o browser já vai abrir o modal
        });
    }

    // --- 5. Inicialização ---
    // Carrega os itens da loja primeiro, depois as moedas e atualiza o card
    carregarItensLoja().then(() => {
        if (habilidades.length > 0) {
            carregarMoedasUsuario(); // Carrega o saldo e define moedasAtuais
            atualizarCard();        // Exibe o primeiro card e atualiza os indicadores
        } else {
            console.error('Nenhum item encontrado na loja.');
            alert('Erro ao carregar itens da loja. Por favor, recarregue a página.');
        }
    });
});
