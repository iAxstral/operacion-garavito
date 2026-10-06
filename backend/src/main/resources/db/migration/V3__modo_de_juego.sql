-- Modo de la partida: NORMAL, HARD (dificil) o DAILY (desafio del dia).
ALTER TABLE match_record ADD COLUMN mode VARCHAR(16) NOT NULL DEFAULT 'NORMAL';
