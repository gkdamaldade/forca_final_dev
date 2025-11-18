
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
