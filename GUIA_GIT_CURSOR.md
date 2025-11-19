# Guia: Trabalhando com Git no Cursor

## ✅ Seu repositório já está configurado!

- **Remote Origin**: `https://github.com/gkdamaldade/forca_final_dev.git`
- **Branch**: `main`
- **Remote Upstream**: `https://github.com/Assolita/forca_asl_final2.git` (repositório original)

## 🚀 Como trabalhar no Cursor

### 1. **Usando a Interface do Cursor (Recomendado)**

O Cursor tem integração nativa com Git! Você pode:

#### **Ver mudanças:**
- Abra o painel de **Source Control** (ícone de ramificação no menu lateral esquerdo, ou `Ctrl+Shift+G`)
- Veja todos os arquivos modificados, adicionados ou removidos

#### **Fazer Commit:**
1. Clique no ícone **+** ao lado dos arquivos para adicionar ao stage (ou `Ctrl+K` depois `Ctrl+Enter`)
2. Digite sua mensagem de commit na caixa de texto no topo
3. Clique em **✓ Commit** (ou pressione `Ctrl+Enter`)

#### **Fazer Push para GitHub:**
1. Após fazer commit, clique no botão **Sync Changes** ou **Push**
2. Ou use o menu de três pontos (...) e selecione **Push**

#### **Fazer Pull do GitHub:**
- Use o botão **Pull** ou **Sync Changes** para baixar mudanças do GitHub

### 2. **Comandos Git no Terminal do Cursor**

Se você instalar o Git, pode usar estes comandos:

```bash
# Ver status dos arquivos
git status

# Adicionar todos os arquivos modificados
git add .

# Adicionar arquivo específico
git add nome-do-arquivo.js

# Fazer commit
git commit -m "Sua mensagem de commit aqui"

# Enviar para o GitHub
git push origin main

# Baixar mudanças do GitHub
git pull origin main

# Ver histórico de commits
git log

# Ver diferenças
git diff
```

### 3. **Instalar Git (Opcional)**

Se quiser usar Git pelo terminal:

1. **Baixe o Git**: https://git-scm.com/download/win
2. Durante a instalação, escolha:
   - ✅ "Git from the command line and also from 3rd-party software"
   - ✅ "Use bundled OpenSSH"
3. Reinicie o Cursor após instalar

### 4. **Fluxo de Trabalho Recomendado**

```bash
# 1. Antes de começar, atualize do GitHub
git pull origin main

# 2. Faça suas alterações nos arquivos

# 3. Veja o que mudou
git status

# 4. Adicione os arquivos
git add .

# 5. Faça commit
git commit -m "Descrição clara do que foi feito"

# 6. Envie para o GitHub
git push origin main
```

### 5. **Boas Práticas de Commit**

- ✅ Use mensagens claras e descritivas
- ✅ Commits pequenos e frequentes são melhores que commits grandes
- ✅ Exemplos de boas mensagens:
  - `feat: adiciona sistema de ranking`
  - `fix: corrige bug no cálculo de vidas`
  - `refactor: reorganiza estrutura de pastas`
  - `docs: atualiza README`

### 6. **Resolvendo Conflitos**

Se houver conflitos ao fazer pull:
1. O Cursor mostrará os arquivos com conflitos
2. Abra o arquivo e procure por marcadores `<<<<<<<`, `=======`, `>>>>>>>`
3. Escolha qual versão manter ou combine as mudanças
4. Salve o arquivo
5. Adicione ao stage: `git add arquivo.js`
6. Complete o merge: `git commit`

## 📝 Comandos Úteis

```bash
# Ver branch atual
git branch

# Criar nova branch
git checkout -b nova-feature

# Trocar de branch
git checkout main

# Ver diferenças antes de commitar
git diff

# Desfazer mudanças não commitadas
git checkout -- nome-do-arquivo.js

# Ver histórico
git log --oneline --graph
```

## ⚠️ Arquivos que NÃO devem ser commitados

O arquivo `.gitignore` já está configurado para ignorar:
- `node_modules/` (dependências do npm)

**Nunca commite:**
- Arquivos `.env` com senhas/chaves
- `node_modules/`
- Arquivos de build temporários
- Chaves privadas

## 🎯 Próximos Passos

1. Abra o painel **Source Control** no Cursor (`Ctrl+Shift+G`)
2. Veja o status atual do seu repositório
3. Faça suas alterações
4. Commit e Push quando estiver pronto!

---

**Dica**: O Cursor mostra um ícone ao lado dos arquivos modificados. Use isso para acompanhar suas mudanças!

