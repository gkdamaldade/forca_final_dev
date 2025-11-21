
INSERT INTO categories (name, slug, active) VALUES
('Animais', 'animais', TRUE),
('Frutas', 'frutas', TRUE),
('Países', 'paises', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Relaciona pelo slug
WITH c AS (
  SELECT id FROM categories WHERE slug = 'animais'
)
INSERT INTO words (text, hint, category_id, active) VALUES
('elefante', 'Maior mamífero terrestre', (SELECT id FROM c), TRUE),
('tigre', 'Felino listrado', (SELECT id FROM c), TRUE)
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM categories WHERE slug = 'frutas'
)
INSERT INTO words (text, hint, category_id, active) VALUES
('banana', 'Amarela e curva', (SELECT id FROM c), TRUE)
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM categories WHERE slug = 'paises'
)
INSERT INTO words (text, hint, category_id, active) VALUES
('brasil', 'Maior país da América do Sul', (SELECT id FROM c), TRUE)
ON CONFLICT DO NOTHING;

-- Inserir os 6 poderes na tabela itemloja
INSERT INTO itemloja (nome, descricao, tipo_poder, custo_moedas, imagem, ativo) VALUES
('Vida extra', 'Ganha uma vida adicional.', 'vida_extra', 2500, '/public/assets/images/vida_extra.png', TRUE),
('Tirar vida', 'Remove uma vida do adversário.', 'tirar_vida', 2500, '/public/assets/images/Tirar_vida.png', TRUE),
('Ocultar letra', 'Oculta uma letra correta da palavra.', 'ocultar_letra', 2500, '/public/assets/images/ocultar_letra.png', TRUE),
('Ocultar dica', 'Remove a dica da rodada.', 'ocultar_dica', 2500, '/public/assets/images/ocultar_dica.png', TRUE),
('Liberar letra', 'Revela uma letra correta da palavra.', 'liberar_letra', 2500, '/public/assets/images/liberar_letra.png', TRUE),
('Palpite', 'Habilidade especial para virar o jogo.', 'palpite', 2500, '/public/assets/images/palpite.png', TRUE)
ON CONFLICT DO NOTHING;