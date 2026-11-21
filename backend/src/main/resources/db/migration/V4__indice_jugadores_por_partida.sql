-- PostgreSQL no indexa solo las llaves foraneas: sin esto, traer los jugadores de las
-- partidas del ranking recorre toda la tabla match_player.
CREATE INDEX idx_match_player_match ON match_player (match_id);
