package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import tools.jackson.databind.json.JsonMapper;

/**
 * Mide (sin red) cuanto cuesta en CPU el tick de una sala y armar + serializar su
 * mensaje de estado, con muchas salas a la vez. Es lo que separa el costo del juego
 * del costo de la red en la prueba de carga (frontend/scripts/load-test.mjs).
 *
 * No corre con el resto: ./mvnw test -Dtest=TickCostBenchmarkTest -Dbenchmark=true
 */
@EnabledIfSystemProperty(named = "benchmark", matches = "true")
class TickCostBenchmarkTest {

    private static final int ROOMS = 50;
    private static final String[] ROLES = { "SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA" };
    private static final Building[] BUILDINGS = { Building.F, Building.C, Building.G, Building.A };

    @Test
    void measure() {
        List<GameSession> sessions = new ArrayList<>();
        for (int r = 0; r < ROOMS; r++) {
            GameSession session = new GameSession("B" + r, BUILDINGS[r % BUILDINGS.length], BossConfig.defaults());
            for (String role : ROLES) {
                session.joinPlayer(role, "t");
                session.getOrCreatePlayer(role).reportPosition(1, 608 + 40 * Arrays.asList(ROLES).indexOf(role), 800);
            }
            session.start(ROLES[0]);
            sessions.add(session);
        }
        JsonMapper json = JsonMapper.builder().build();

        long now = System.currentTimeMillis();
        // Calentamiento + llegar al Kinder 1 (los zombis aparecen despues de 45 s de juego).
        for (int i = 0; i < 800; i++) {
            now += 66;
            for (GameSession s : sessions) {
                s.tick(now, 0.066);
                for (String role : ROLES) { s.getOrCreatePlayer(role).revive(100); }
            }
        }

        int ticks = 300;
        long[] tickNanos = new long[ticks * ROOMS];
        long[] serializeNanos = new long[ticks * ROOMS];
        long bytes = 0;
        int zombies = 0;
        int index = 0;
        for (int i = 0; i < ticks; i++) {
            now += 66;
            for (GameSession s : sessions) {
                long t0 = System.nanoTime();
                s.tick(now, 0.066);
                long t1 = System.nanoTime();
                GameStateMessage message = new GameStateMessage(s.playerStates(), s.claimedItemIdsSnapshot(), null,
                        s.zombieStates(), s.waveState(), s.doorStates(), s.lobbyState(), s.bossView(),
                        s.projectileStates(), s.barricadeStates(), s.lastSummary(), s.kinderEvent(), s.puddleStates());
                byte[] payload = json.writeValueAsBytes(message);
                long t2 = System.nanoTime();
                tickNanos[index] = t1 - t0;
                serializeNanos[index] = t2 - t1;
                bytes += payload.length;
                zombies += s.zombieStates().size();
                index++;
                for (String role : ROLES) { s.getOrCreatePlayer(role).revive(100); }
            }
        }
        Arrays.sort(tickNanos);
        Arrays.sort(serializeNanos);
        double totalTickMs = Arrays.stream(tickNanos).sum() / 1e6;
        double totalSerializeMs = Arrays.stream(serializeNanos).sum() / 1e6;
        double simulatedSeconds = ticks * 0.066;
        System.out.printf("%n== Costo por sala (%d salas, %d ticks cada una, %.1f zombis promedio por sala) ==%n",
                ROOMS, ticks, zombies / (double) (ticks * ROOMS));
        System.out.printf("tick:        promedio %.3f ms, p50 %.3f, p99 %.3f ms%n", totalTickMs / index,
                tickNanos[index / 2] / 1e6, tickNanos[(int) (index * 0.99)] / 1e6);
        System.out.printf("serializar:  promedio %.3f ms, p50 %.3f, p99 %.3f ms, %.2f KB por mensaje%n",
                totalSerializeMs / index, serializeNanos[index / 2] / 1e6, serializeNanos[(int) (index * 0.99)] / 1e6,
                bytes / 1024.0 / index);
        System.out.printf("CPU de juego para %d salas en tiempo real: %.1f%% de un nucleo (ticks) + %.1f%% (estado a 8/s)%n",
                ROOMS, 100 * totalTickMs / 1000 / simulatedSeconds,
                100 * (totalSerializeMs * (8 / 15.0)) / 1000 / simulatedSeconds);
    }
}
