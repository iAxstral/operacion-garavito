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
            session = sessionService.create(gameId, Building.parseOrDefault(request.building()),
                    GameMode.parseOrDefault(request.mode()));
            if (session == null) {
                sessionService.broadcastRejected(gameId, LastEvent.lobbyRejected(request.clientId(), "code_taken"));
                return;
            }
        } else {
            session = sessionService.find(gameId);
            if (session == null) {
                String owner = sessionService.redirectFor(gameId);
                sessionService.broadcastRejected(gameId, owner != null
                        ? LastEvent.lobbyRedirect(request.clientId(), owner)
                        : LastEvent.lobbyRejected(request.clientId(), "lobby_not_found"));
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

        String rejection = session.joinPlayer(request.role(), request.token());
        if (rejection != null) {
            sessionService.broadcast(gameId, session, LastEvent.joinRejected(request.clientId(), rejection));
            return;
        }
        session.setPlayerName(request.role(), request.name());
        session.setPlayerCostume(request.role(), request.costume());
        sessionService.registerSeat(headers.getSessionId(), gameId, request.role());
        sessionService.broadcast(gameId, session, LastEvent.joinOk(request.role(), request.clientId()));
    }

    @MessageMapping("/game/{gameId}/rejoin")
    public void rejoin(@DestinationVariable String gameId, JoinRequest request, SimpMessageHeaderAccessor headers) {
        GameSession session = sessionService.find(gameId);
        String rejection = sessionService.rejoin(gameId, request.role(), request.token(), headers.getSessionId());
        if (rejection != null) {
            sessionService.broadcastRejected(gameId, LastEvent.rejoinRejected(request.clientId(), rejection));
            return;
        }
        session.setPlayerName(request.role(), request.name());
        session.setPlayerCostume(request.role(), request.costume());
        sessionService.broadcast(gameId, session, LastEvent.rejoinOk(request.role(), request.clientId()));
    }

    @MessageMapping("/game/{gameId}/perk")
    public void choosePerk(@DestinationVariable String gameId, PerkRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptChoosePerk(playerId, request.perk());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/hide")
    public void hide(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptHide(playerId, System.currentTimeMillis());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/chat")
    public void chat(@DestinationVariable String gameId, ChatRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        LastEvent event = session.attemptChat(playerId, request.phrase(), System.currentTimeMillis());
        if (event != null) {
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/ping")
    public void ping(@DestinationVariable String gameId, PingRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        LastEvent event = session.attemptPing(playerId, request.kind(), System.currentTimeMillis());
        if (event != null) {
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/start")
    public void start(@DestinationVariable String gameId, StartRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null && session.start(playerId)) {
            sessionService.broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/leave")
    public void leave(@DestinationVariable String gameId, LeaveRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        sessionService.leave(gameId, playerId);
    }

    @MessageMapping("/game/{gameId}/pickup")
    public void pickup(@DestinationVariable String gameId, PickupRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PickupResult result = session.attemptPickup(playerId, request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.pickupSuccess(playerId, request.itemId())
                : LastEvent.pickupRejected(playerId, request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/purchase")
    public void purchase(@DestinationVariable String gameId, PurchaseRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PurchaseResult result = session.attemptPurchase(playerId, request.itemId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.purchaseSuccess(playerId, request.itemId())
                : LastEvent.purchaseRejected(playerId, request.itemId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/door/toggle")
    public void toggleDoor(@DestinationVariable String gameId, DoorToggleRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        DoorToggleResult result = session.attemptToggleDoor(
                playerId, request.doorId(), request.x(), request.y());

        LastEvent event = result.success()
                ? null
                : LastEvent.doorRejected(playerId, request.doorId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/start")
    public void startMission(@DestinationVariable String gameId, MissionStartRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptStartMission(playerId, request.missionId());

        LastEvent event = result.success()
                ? LastEvent.missionStarted(playerId, request.missionId())
                : LastEvent.missionRejected(playerId, request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/mission/cancel")
    public void cancelMission(@DestinationVariable String gameId, MissionStartRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        session.attemptCancelMission(playerId, request.missionId());
        broadcast(gameId, session, LastEvent.missionCancelled(playerId, request.missionId()));
    }

    @MessageMapping("/game/{gameId}/mission/complete")
    public void completeMission(@DestinationVariable String gameId, MissionCompleteRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        MissionResult result = session.attemptCompleteMission(playerId, request.missionId(), request.x(), request.y());

        LastEvent event = result.success()
                ? LastEvent.missionSuccess(playerId, request.missionId())
                : LastEvent.missionRejected(playerId, request.missionId(), result.reason());

        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/move")
    public void move(@DestinationVariable String gameId, MoveRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null
                && !session.reportPosition(playerId, request.floor(), request.x(), request.y())
                && session.shouldCorrect(playerId)) {
            broadcast(gameId, session, LastEvent.positionCorrected(playerId));
        }
    }

    @MessageMapping("/game/{gameId}/attack")
    public void attack(@DestinationVariable String gameId, AttackRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        AttackResult result = session.attemptAttack(
                playerId, request.type() == null ? AttackType.BASIC : request.type(),
                request.x(), request.y(), request.facing());

        if (result.kills() > 0 || !result.success()) {
            LastEvent event = result.success()
                    ? LastEvent.attackKill(playerId, result.kills())
                    : LastEvent.attackRejected(playerId, result.reason());
            broadcast(gameId, session, event);
        }
    }

    @MessageMapping("/game/{gameId}/use")
    public void useItem(@DestinationVariable String gameId, UseItemRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        UseItemResult result = session.attemptUseItem(playerId, request.itemId());

        LastEvent event = result.success()
                ? LastEvent.useSuccess(playerId, request.itemId())
                : LastEvent.useRejected(playerId, request.itemId(), result.reason());
        broadcast(gameId, session, event);
    }

    @MessageMapping("/game/{gameId}/equip")
    public void equip(@DestinationVariable String gameId, EquipRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptEquip(playerId, request.itemId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.equipRejected(playerId, request.itemId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/reload")
    public void reload(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReload(playerId);
        broadcast(gameId, session, result.success() ? null : LastEvent.reloadRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/start")
    public void startRevive(@DestinationVariable String gameId, ReviveRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptReviveStart(playerId, request.targetId());
        broadcast(gameId, session, result.success()
                ? null
                : LastEvent.reviveRejected(playerId, request.targetId(), result.reason()));
    }

    @MessageMapping("/game/{gameId}/revive/cancel")
    public void cancelRevive(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session != null) {
            session.attemptReviveCancel(playerId);
            broadcast(gameId, session, null);
        }
    }

    @MessageMapping("/game/{gameId}/event/interact")
    public void interactEvent(@DestinationVariable String gameId, PlayerRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptEventInteract(playerId);
        // El exito lo anuncia el tick (EVENT_RESOLVED); aqui solo el rechazo.
        broadcast(gameId, session, result.success() ? session.pollEvent() : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/place")
    public void placeBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptPlaceBarricade(playerId, request.x(), request.y(), request.facing());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/repair")
    public void repairBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptRepairBarricade(playerId, request.barricadeId());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/barricade/dismantle")
    public void dismantleBarricade(@DestinationVariable String gameId, BarricadeRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptDismantleBarricade(playerId, request.barricadeId());
        broadcast(gameId, session, result.success() ? null : LastEvent.abilityRejected(playerId, result.reason()));
    }

    @MessageMapping("/game/{gameId}/transfer")
    public void transfer(@DestinationVariable String gameId, TransferRequest request,
            SimpMessageHeaderAccessor headers) {
        String playerId = sessionService.seatRole(gameId, headers.getSessionId());
        if (playerId == null) {
            return;
        }
        GameSession session = sessionService.find(gameId);
        if (session == null) {
            return;
        }
        PlayerActionResult result = session.attemptTransfer(playerId, request.targetId(), request.amount());
        broadcast(gameId, session, result.success()
                ? LastEvent.transfer(playerId, request.targetId(), request.amount())
                : LastEvent.abilityRejected(playerId, result.reason()));
    }

    private void broadcast(String gameId, GameSession session, LastEvent lastEvent) {
        sessionService.broadcast(gameId, session, lastEvent);
    }
}
