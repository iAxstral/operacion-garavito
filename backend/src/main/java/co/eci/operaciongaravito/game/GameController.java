package co.eci.operaciongaravito.game;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class GameController {

    private final GameSessionService sessionService;

    public GameController(GameSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @MessageMapping("/game/{gameId}/lobby")
    public void lobby(@DestinationVariable String gameId, LobbyRequest request) {
        GameSession session;
        if (!GameSessionService.isValidCode(gameId)) {
            sessionService.broadcastRejected(gameId, LastEvent.lobbyRejected(request.clientId(), "invalid_code"));
            return;
        }
        if (request.create()) {
            session = sessionService.create(gameId, Building.parseOrDefault(request.building()));
            if (session == null) {
                sessionService.broadcastRejected(gameId, LastEvent.lobbyRejected(request.clientId(), "code_taken"));
                return;
            }
        } else {
            session = sessionService.find(gameId);
            if (session == null) {
                sessionService.broadcastRejected(gameId, LastEvent.lobbyRejected(request.clientId(), "lobby_not_found"));
                return;
            }
        }
        sessionService.broadcast(gameId, session, LastEvent.lobbyOk(request.clientId()));
    }

    @MessageMapping("/game/{gameId}/join")
    public void join(@DestinationVariable String gameId, JoinRequest request, SimpMessageHeaderAccessor headers) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            sessionService.broadcastRejected(gameId, LastEvent.joinRejected(request.clientId(), "lobby_not_found"));
            return;
        }

        String rejection = session.joinPlayer(request.role());
        if (rejection != null) {
            sessionService.broadcast(gameId, session, LastEvent.joinRejected(request.clientId(), rejection));
            return;
        }
        sessionService.registerSeat(headers.getSessionId(), gameId, request.role());
        sessionService.broadcast(gameId, session, LastEvent.joinOk(request.role(), request.clientId()));
    }

    @MessageMapping("/game/{gameId}/start")
    public void start(@DestinationVariable String gameId, StartRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session != null && session.start(request.playerId())) {
            sessionService.broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/leave")
    public void leave(@DestinationVariable String gameId, LeaveRequest request) {
        sessionService.leave(gameId, request.playerId());
    }

    @MessageMapping("/game/{gameId}/pickup")
    public void pickup(@DestinationVariable String gameId, PickupRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PickupResult result = session.attemptPickup(request.playerId(), request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.pickupSuccess(request.playerId(), request.itemId())
                : LastEvent.pickupRejected(request.playerId(), request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/purchase")
    public void purchase(@DestinationVariable String gameId, PurchaseRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PurchaseResult result = session.attemptPurchase(request.playerId(), request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.purchaseSuccess(request.playerId(), request.itemId())
                : LastEvent.purchaseRejected(request.playerId(), request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/door/toggle")
    public void toggleDoor(@DestinationVariable String gameId, DoorToggleRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        DoorToggleResult result = session.attemptToggleDoor(
                request.playerId(), request.doorId(), request.x(), request.y());

        LastEvent event = result.success()
                ? null
                : LastEvent.doorRejected(request.playerId(), request.doorId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/start")
    public void startMission(@DestinationVariable String gameId, MissionStartRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptStartMission(request.playerId(), request.missionId());

        LastEvent event = result.success()
                ? LastEvent.missionStarted(request.playerId(), request.missionId())
                : LastEvent.missionRejected(request.playerId(), request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/cancel")
    public void cancelMission(@DestinationVariable String gameId, MissionStartRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        session.attemptCancelMission(request.playerId(), request.missionId());
        broadcast(gameId, session, LastEvent.missionCancelled(request.playerId(), request.missionId()));
    }

    @MessageMapping("/game/{gameId}/mission/complete")
    public void completeMission(@DestinationVariable String gameId, MissionCompleteRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptCompleteMission(request.playerId(), request.missionId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.missionSuccess(request.playerId(), request.missionId())
                : LastEvent.missionRejected(request.playerId(), request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/move")
    public void move(@DestinationVariable String gameId, MoveRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session != null) {
            session.reportPosition(request.playerId(), request.floor(), request.x(), request.y());
        }
    }

    @MessageMapping("/game/{gameId}/attack")
    public void attack(@DestinationVariable String gameId, AttackRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        AttackResult result = session.attemptAttack(
                request.playerId(), request.type() == null ? AttackType.BASIC : request.type(),
                request.x(), request.y(), request.facing());

        if (result.kills() > 0 || !result.success()) {
            LastEvent event = result.success()
                    ? LastEvent.attackKill(request.playerId(), result.kills())
                    : LastEvent.attackRejected(request.playerId(), result.reason());
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/use")
    public void useItem(@DestinationVariable String gameId, UseItemRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        UseItemResult result = session.attemptUseItem(request.playerId(), request.itemId());

        LastEvent event = result.success()
                ? LastEvent.useSuccess(request.playerId(), request.itemId())
                : LastEvent.useRejected(request.playerId(), request.itemId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/equip")
    public void equip(@DestinationVariable String gameId, EquipRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptEquip(request.playerId(), request.itemId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.equipRejected(request.playerId(), request.itemId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/reload")
    public void reload(@DestinationVariable String gameId, PlayerRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReload(request.playerId());
        broadcast(gameId, session, result.success() ? null : LastEvent.reloadRejected(request.playerId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/start")
    public void startRevive(@DestinationVariable String gameId, ReviveRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReviveStart(request.playerId(), request.targetId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.reviveRejected(request.playerId(), request.targetId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/cancel")
    public void cancelRevive(@DestinationVariable String gameId, PlayerRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session != null) {
            session.attemptReviveCancel(request.playerId());
            broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/barricade/place")
    public void placeBarricade(@DestinationVariable String gameId, BarricadeRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptPlaceBarricade(request.playerId(), request.x(), request.y(), request.facing());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(request.playerId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/repair")
    public void repairBarricade(@DestinationVariable String gameId, BarricadeRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptRepairBarricade(request.playerId(), request.barricadeId());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(request.playerId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/transfer")
    public void transfer(@DestinationVariable String gameId, TransferRequest request) {
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptTransfer(request.playerId(), request.targetId(), request.amount());
        broadcast(gameId, session, result.success()
                ? LastEvent.transfer(request.playerId(), request.targetId(), request.amount())
                : LastEvent.abilityRejected(request.playerId(), result.reason()));
    }

    private void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        sessionService.broadcast(gameId, session, lastEvent);
    }
}
