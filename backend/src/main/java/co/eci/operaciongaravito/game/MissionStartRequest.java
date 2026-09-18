package co.eci.operaciongaravito.game;

/** Pedido de abrir o cancelar la tarea de una mision (sin x/y: la posicion ya se valido al pisar la zona). */
public record MissionStartRequest(String playerId, String missionId) {
}
