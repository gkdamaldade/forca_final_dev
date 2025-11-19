const { getRandomWord } = require('./services/wordService.js');
const { Game } = require('./game.js');
const { models } = require('./models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// 1. DEFINA A VARIÁVEL AQUI
// Esta variável vai "segurar" o jogo entre as requisições
let jogoAtual = null;

async function iniciarNovoJogo(categoriaEscolhida) {
    console.log("Controller: Criando novo jogo...");
    console.log(`Categoria escolhida: ${categoriaEscolhida || 'Nenhuma (aleatória)'}`);

    // Busca palavra aleatória do banco filtrando por categoria
    const palavraDB = await getRandomWord({ categoria: categoriaEscolhida });

    const palavra = palavraDB.palavra;
    const categoria = palavraDB.categoria;

    jogoAtual = new Game(palavra, categoria);
    
    return jogoAtual.getEstado();
}

function lidarComChute(letra) {
    //if (!jogoAtual || jogoAtual.status !== "jogando") {
      //  throw new Error("Não há jogo em andamento ou o jogo já acabou.");
   // }

    //console.log(`Controller: Processando chute '${letra}'`);
    
    jogoAtual.chutarLetra(letra);

    return jogoAtual.getEstado();
}

function lidarComTempoEsgotado() {
    if (!jogoAtual || jogoAtual.status !== "jogando") {
        throw new Error("Jogo não iniciado.");
    }
    
    console.log("Tempo esgotado! Trocando turno...");
    // Apenas troca o turno, sem penalidade de erro (ou adicione erro se preferir)
    jogoAtual.trocarTurno();
    
    return jogoAtual.getEstado();
}
// --- NOVA FUNÇÃO DE PODER ---
/**
 * Lida com a ativação de um poder
 * Retorna um objeto com o resultado da ação
 */
function lidarComPoder(poderId, jogadorQueUsou) {
    if (!jogoAtual || jogoAtual.status !== 'jogando') {
        throw new Error("Não há jogo em andamento.");
    }

    console.log(`Controller: Jogador ${jogadorQueUsou} usou o poder '${poderId}'`);

    switch (poderId) {
        case 'mago-negro':
            // O jogo é atualizado DENTRO do método
            const novoEstado = jogoAtual.revelarLetraMaisRepetida();
            // Retorna o novo estado do jogo
            return { tipo: 'gameState', estado: novoEstado };
        
        case 'etanol':
            // 50% de chance
            if (Math.random() < 0.5) {
                console.log("Poder (Etanol): Sucesso! Oponente perde 1 vida.");
                // Retorna uma instrução para o frontend
                return { tipo: 'ataqueVida', sucesso: true, alvo: (jogadorQueUsou === 1 ? 2 : 1) };
            } else {
                console.log("Poder (Etanol): Falhou.");
                return { tipo: 'ataqueVida', sucesso: false };
            }

        case 'ocultar-dica':
            const oponente = (jogadorQueUsou === 1 ? 2 : 1);
            jogoAtual.bloquearDica(oponente);
            console.log(`Poder (Ocultar Dica): Jogador ${oponente} não pode mais usar dica.`);
            
            // Retorna instrução pro front atualizar interface
            return { 
                tipo: 'ocultarDica', 
                sucesso: true, 
                alvo: oponente, 
                estado: jogoAtual.getEstado() 
            };
        
        case 'ocultar-letra':
        // 1. Chama o método que executa a lógica:
        //    - Ele deve encontrar, remover o caractere do jogo e atualizar jogoAtual.
        //    - Ele deve retornar o caractere que foi removido.
        const caractereDeletado = jogoAtual.removerCaractereAleatorio();
        
        console.log(`Poder (Ocultar Letra): Caractere '${caractereDeletado}' removido da frase.`);

        // 2. Retorna instrução pro front-end:
        return { 
            tipo: 'ocultarLetra', // Novo tipo para o front-end reconhecer
            sucesso: true, 
            caractere: caractereDeletado,
            estado: jogoAtual.getEstado() // Envia o estado atualizado (com a frase alterada)
        };

        case 'roleta-russa':
            const azar = Math.random() < 0.5; // 50% de chance de azar

            if (azar) {
                // Penalidade: Perde uma vida
                console.log("[Palpite Adversario] Azar! Usuário perde uma vida.");
                return { 
                    tipo: 'ataqueVida', 
                    sucesso: true, 
                    alvo: jogadorQueUsou // A vida perdida é a do jogador que usou
                };
            } else {
                // Sorte: Tenta ocultar uma dica revelada do oponente
                console.log("[Palpite Adversario] Sorte! Tentando ocultar letra do oponente.");
                
                // Tenta ocultar a última letra revelada:
                const estadoAtualizado = jogoAtual.ocultarUltimaLetraRevelada();
                return{
                    tipo: 'ocultarLetraOponente',
                    sucesso: true,
                    estado: estadoAtualizado  
                }
            }

        default:
            throw new Error("Poder desconhecido.");
    }
}

async function lidarCadastro(dados) {
    // 'username' vem do formulário
    const { username, email, password } = dados; 

    if (!username || !email || !password) {
        throw new Error("Dados de cadastro incompletos.");
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. Cria o novo jogador no banco
    const novoPlayer = await models.Player.create({
        nome: username, 
        email: email,
        senha_hash: hashedPassword
    });

    console.log(`Controller: Novo jogador cadastrado - ${novoPlayer.name}`);
    
    // 3. Retorna o novo jogador
    return {
        id: novoPlayer.id,
        username: novoPlayer.name, // Pode retornar como 'username' se quiser
        email: novoPlayer.email
    };
}


async function lidarLogin(dados) {
    const { email, password } = dados;

    if (!email || !password) {
        throw new Error("Email e senha são obrigatórios.");
    }

    // 1. Encontra o jogador pelo email no Supabase
    const player = await models.Player.findOne({ where: { email: email } });
    if (!player) {
        // (Erro genérico por segurança - não diga ao usuário se foi o email ou a senha)
        throw new Error("Credenciais inválidas."); 
    }

    // 2. Compara a senha enviada com a senha "hasheada" no banco
    const match = await bcrypt.compare(password, player.senha_hash);
    if (!match) {
        // Senha errada
        throw new Error("Credenciais inválidas.");
    }

    // 3. SUCESSO! Crie o Token
    console.log(`Controller: Jogador '${player.nome}' logado com sucesso.`);
    
    // O 'payload' é o que guardamos dentro do token
    const payload = {
        id: player.id,
        nome: player.nome
    };

    // Assina o token usando a chave secreta do .env
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '8h' // O token expira em 8 horas
    });

    // 4. Retorna o token e os dados do usuário
    return {
        user: payload,
        token: token
    };
}

async function listarRanking() {
    const ranking = await models.Player.findAll({
        attributes: ['nome', 'vitorias'], // Busca 'vitorias' em vez de 'pontos'
        order: [
            ['vitorias', 'DESC'] // Ordena por quem tem mais vitórias
        ],
        limit: 10
    });
    return ranking;
}

async function registrarVitoria(dados) {
    const { email } = dados; // Vamos identificar quem ganhou pelo email

    if (!email) throw new Error("Email necessário para registrar vitória.");

    const player = await models.Player.findOne({ where: { email: email } });
    
    if (player) {
        // Incrementa 1 na coluna vitorias
        await player.increment('vitorias');
        return { mensagem: "Vitória registrada!", novasVitorias: player.vitorias + 1 };
    } else {
        throw new Error("Jogador não encontrado.");
    }
}


module.exports = { 
    iniciarNovoJogo,
    lidarComChute,
    lidarComPoder,
    lidarCadastro,
    lidarLogin,
    listarRanking,
    registrarVitoria,
    lidarComTempoEsgotado
};
