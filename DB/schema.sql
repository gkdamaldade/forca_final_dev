
-- Schema para Postgres
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(120) UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS words (
  id SERIAL PRIMARY KEY,
  text VARCHAR(120) NOT NULL,
  hint VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  won BOOLEAN NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_words_category ON words(category_id);
CREATE INDEX IF NOT EXISTS idx_results_player ON results(player_id);
CREATE INDEX IF NOT EXISTS idx_results_word ON results(word_id);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at);

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