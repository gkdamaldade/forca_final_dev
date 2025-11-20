class Game {
    static MAX_ERROS_BONECO = 6; 

    constructor(palavraSecreta, categoria) {
        this.palavraSecreta = palavraSecreta.toUpperCase();
        this.categoria = categoria;
        this.letrasChutadas = new Set();
        this.erros = 0;
        this.status = "jogando";
        this.turn = 1;// "jogando", "vitoria", "derrota"
    }

    getPalavraParaExibir() {
        let exibicao = "";
        for (const letra of this.palavraSecreta) {
            if (letra === ' ') {
                exibicao += "  ";
            } else if (this.letrasChutadas.has(letra)) {
                exibicao += letra + " ";
            } else {
                exibicao += "_ ";
            }
        }
        return exibicao.trim();
    }

    chutarLetra(letra) {
        if (this.status !== "jogando") return this.status;
        letra = letra.toUpperCase();

        // Aceita letras A-Z, hífen (-) e cedilha (Ç)
        if (!letra.match(/^[A-Z\-Ç]$/) || this.letrasChutadas.has(letra)) {
            return "repetida";
        }
        this.letrasChutadas.add(letra);

        if (this.palavraSecreta.includes(letra)) {
            if (this.checarVitoria()) {
                this.status = "vitoria";
                return "vitoria";
            }
            return "acerto";
        } else {
            this.erros++;
            if (this.checarDerrota()) {
                this.status = "derrota";
                return "derrota";
            }
            return "erro";
        }
        if (this.status === "jogando"){
            this.trocarTurno();
        }
        return resultado;
    }

    /**
     * Aplica uma letra ao jogo sem penalizar por erro.
     * Usado pelo poder "palpite" quando o adversário chuta uma letra que o jogador não chutou.
     * Retorna um objeto com informações sobre o resultado.
     */
    aplicarLetraPalpite(letra) {
        letra = letra.toUpperCase();

        if (this.status !== "jogando") {
            return {
                estado: this.getEstado(),
                acertou: false,
                vitoria: this.status === "vitoria"
            };
        }

        const letraJaChutada = this.letrasChutadas.has(letra);
        if (!letraJaChutada) {
            this.letrasChutadas.add(letra);
        }

        const acertou = this.palavraSecreta.includes(letra);

        if (acertou) {
            if (this.checarVitoria()) {
                this.status = "vitoria";
            }
        }

        return {
            estado: this.getEstado(),
            acertou,
            vitoria: this.status === "vitoria",
            letraJaChutada
        };
    }

    trocarTurno() {
        this.turn = (this.turn === 1) ? 2 : 1;
        console.log(`Turno trocado para Jogador ${this.turn}`);
        return this.getEstado();
    }

    getEstado() {
        return {
            palavra: this.getPalavraParaExibir(),
            erros: this.erros,
            letrasChutadas: Array.from(this.letrasChutadas),
            status: this.status,
            categoria: this.categoria,
            turn: this.turn // <--- Envia o turno atual para o frontend
        };
    }

    checarVitoria() {
        for (const letra of this.palavraSecreta) {
            if (letra !== ' ' && !this.letrasChutadas.has(letra)) {
                return false;
            }
        }
        return true;
    }

    checarDerrota() {
        return this.erros >= Game.MAX_ERROS_BONECO;
    }

     //* NOVO MÉTODO: Poder "Mago Negro"
     //* Encontra a letra mais comum na palavra que AINDA não foi chutada.
     //*/
    revelarLetraMaisRepetida() {
        if (this.status !== 'jogando') return this.getEstado();

        const contagem = {};
        let letraMaisRepetida = '';
        let maxContagem = 0;

        // 1. Conta todas as letras da palavra
        for (const letra of this.palavraSecreta) {
            if (letra === ' ' || this.letrasChutadas.has(letra)) {
                continue; // Ignora espaços e letras já chutadas
            }
            contagem[letra] = (contagem[letra] || 0) + 1;
        }

        // 2. Encontra a mais comum
        for (const letra in contagem) {
            if (contagem[letra] > maxContagem) {
                maxContagem = contagem[letra];
                letraMaisRepetida = letra;
            }
        }
        
        // 3. Se achou uma letra, chuta ela
        if (letraMaisRepetida) {
            console.log(`Poder: Revelando a letra '${letraMaisRepetida}'`);
            this.chutarLetra(letraMaisRepetida); // Usa a lógica de chute normal
        }

        return this.getEstado(); // Retorna o novo estado do jogo
    }

    // Poder ocultar a dica
    ocultarDica(jogadorQueUsou, duracaoMs = null) {
        if (this.status !== 'jogando') return this.getEstado();

        const oponente = jogadorQueUsou === 1 ? 2 : 1;
        this.dicasBloqueadas[oponente] = true;
        console.log(`Poder: Jogador ${jogadorQueUsou} bloqueou dicas do jogador ${oponente}`);

        // Se for temporário, agenda desbloqueio
        if (duracaoMs) {
            setTimeout(() => {
                this.dicasBloqueadas[oponente] = false;
                console.log(`Poder (Ocultar Dica): Dicas desbloqueadas para jogador ${oponente}`);
            }, duracaoMs);
        }

        return this.getEstado();
    }

    ocultarLetra(duracaoMs = null) {
        if (this.status !== 'jogando') return this.getEstado();

        const contagemRevelada = {};
        let letraParaOcultar = '';
        let maxContagem = 0;

        // 1. Conta a frequência das letras JÁ REVELADAS (chutadas e corretas)
        for (const letra of this.palavraSecreta) {
            if (letra !== ' ' && this.letrasChutadas.has(letra) && !this.letrasOcultas.has(letra)) {
                // Ignora letras já ocultas para focar nas que estão visíveis
                contagemRevelada[letra] = (contagemRevelada[letra] || 0) + 1;
            }
        }

        // 2. Encontra a letra revelada mais comum
        for (const letra in contagemRevelada) {
            if (contagemRevelada[letra] > maxContagem) {
                maxContagem = contagemRevelada[letra];
                letraParaOcultar = letra;
            }
        }

        // 3. Se encontrou uma letra, a oculta
        if (letraParaOcultar) {
            this.letrasOcultas.add(letraParaOcultar);
            console.log(`Poder (Efeito Fantasma): Ocultando a letra '${letraParaOcultar}'.`);
            
            // Torna o efeito temporário
            if (duracaoMs && duracaoMs > 0) {
                setTimeout(() => {
                    this.letrasOcultas.delete(letraParaOcultar);
                    console.log(`Poder (Efeito Fantasma): Letra '${letraParaOcultar}' revelada novamente.`);
                }, duracaoMs);
            }
        } else {
            console.log("Poder (Efeito Fantasma): Nenhuma letra revelada para ocultar.");
        }

        return this.getEstado();
    }
}

// Use CommonJS (module.exports)
module.exports = { Game };
