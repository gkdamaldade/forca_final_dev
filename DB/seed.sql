-- Inserir os 6 poderes na tabela itemloja
INSERT INTO itemloja (nome, descricao, tipo_poder, custo_moedas, imagem, ativo) VALUES
('Vida extra', 'Ganha uma vida adicional.', 'vida_extra', 2500, '/public/assets/images/vida_extra.png', TRUE),
('Tirar vida', 'Remove uma vida do adversário.', 'tirar_vida', 2500, '/public/assets/images/Tirar_vida.png', TRUE),
('Ocultar letra', 'Oculta uma letra correta da palavra.', 'ocultar_letra', 2500, '/public/assets/images/ocultar_letra.png', TRUE),
('Ocultar dica', 'Remove a dica da rodada.', 'ocultar_dica', 2500, '/public/assets/images/ocultar_dica.png', TRUE),
('Liberar letra', 'Revela uma letra correta da palavra.', 'liberar_letra', 2500, '/public/assets/images/liberar_letra.png', TRUE),
('Palpite', 'Habilidade especial para virar o jogo.', 'palpite', 2500, '/public/assets/images/palpite.png', TRUE)
ON CONFLICT DO NOTHING;
