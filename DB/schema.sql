-- Tabela de itens da loja (poderes disponíveis para compra)
CREATE TABLE IF NOT EXISTS itemloja (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  tipo_poder VARCHAR(50) NOT NULL,
  custo_moedas INTEGER NOT NULL DEFAULT 0,
  imagem VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itemloja_tipo_poder ON itemloja(tipo_poder);
CREATE INDEX IF NOT EXISTS idx_itemloja_ativo ON itemloja(ativo);

-- Tabela de inventário para armazenar os poderes comprados pelos usuários
CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  itemloja_id INTEGER NOT NULL REFERENCES itemloja(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, itemloja_id)
);

CREATE INDEX IF NOT EXISTS idx_inventario_usuario ON inventario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_itemloja ON inventario(itemloja_id);
