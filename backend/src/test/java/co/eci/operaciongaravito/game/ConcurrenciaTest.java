package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

/**
 * Operaciones simultaneas sobre una misma sala (docs/CONCURRENCIA.md). Todos los hilos
 * esperan en un CountDownLatch y salen a la vez, como mensajes STOMP que llegan en el
 * mismo instante por hilos distintos del broker, mientras el tick de la sala corre en
 * otro hilo. Se repite varias veces para que el orden cambie entre corridas.
 *
 * Que se comprueba: sin duplicacion (un objeto tiene un solo dueno, un rol un solo
 * ocupante), sin perdida (el dinero total se conserva) y estado consistente (lo que se
 * difunde coincide con lo que paso).
 */
class ConcurrenciaTest {

    private static final int HILOS = 16;
    private static final String COMIDA = "cafeteria-food-1"; // piso 1, (1632, 1248)

    private GameSession session;

    @BeforeEach
    void setUp() {
        session = new GameSession("CONC01", Building.F, BossConfig.defaults());
    }

    /** Lanza n tareas a la vez (todas esperan la misma senal) y devuelve sus resultados. */
    private static <T> List<T> simultaneas(int n, IntFunction<T> tarea) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<T>> futuros = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            int id = i;
            futuros.add(pool.submit(() -> {
                salida.await();
                return tarea.apply(id);
            }));
        }
        salida.countDown();
        List<T> resultados = new ArrayList<>();
        for (Future<T> f : futuros) {
            resultados.add(f.get(10, TimeUnit.SECONDS));
        }
        pool.shutdown();
        return resultados;
    }

    @RepeatedTest(5)
    @DisplayName("16 conexiones piden el mismo rol a la vez: exactamente una lo ocupa")
    void sameRoleHasOneOccupant() throws Exception {
        List<String> rechazos = simultaneas(HILOS, i -> session.joinPlayer("SEGURIDAD", "token-concurrente-" + i));
        assertEquals(1, rechazos.stream().filter(r -> r == null).count(), "un solo ganador");
        assertEquals(HILOS - 1, rechazos.stream().filter("role_taken"::equals).count(), "los demas, rechazo explicito");
        assertEquals(1, session.playerCount());
    }

    @RepeatedTest(5)
    @DisplayName("4 jugadores recogen el mismo objeto en el mismo instante: un solo dueno, sin duplicarlo")
    void sameItemHasOneOwner() throws Exception {
        String[] roles = { "SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA" };
        for (String role : roles) {
            session.joinPlayer(role);
            session.getOrCreatePlayer(role).reportPosition(1, 1632, 1248);
        }
        List<PickupResult> resultados = simultaneas(roles.length,
                i -> session.attemptPickup(roles[i], COMIDA, 1632, 1248));

        assertEquals(1, resultados.stream().filter(PickupResult::success).count());
        assertEquals(roles.length - 1, resultados.stream().filter(r -> "already_claimed".equals(r.reason())).count());
        long copias = 0;
        for (String role : roles) {
            copias += session.getOrCreatePlayer(role).inventorySnapshot().stream()
                    .filter(slot -> COMIDA.equals(slot.itemId())).count();
        }
        assertEquals(1, copias, "el objeto existe en un solo inventario");
        assertTrue(session.claimedItemIdsSnapshot().contains(COMIDA), "y el estado difundido lo muestra reclamado");
    }

    @Test
    @DisplayName("transferencias simultaneas de Garavitos: no se pierde ni se crea dinero")
    void concurrentTransfersConserveMoney() throws Exception {
        session.joinPlayer("ECONOMIA");
        session.joinPlayer("SALUD");
        Player tesorera = session.getOrCreatePlayer("ECONOMIA");
        Player medica = session.getOrCreatePlayer("SALUD");
        tesorera.addGaravitos(100 - tesorera.getGaravitos());
        int total = tesorera.getGaravitos() + medica.getGaravitos();

        // 32 transferencias de 5 (160 en total) contra un saldo de 100: solo 20 caben.
        List<PlayerActionResult> resultados = simultaneas(32, i -> session.attemptTransfer("ECONOMIA", "SALUD", 5));

        long aceptadas = resultados.stream().filter(PlayerActionResult::success).count();
        assertEquals(20, aceptadas, "ni una de mas: el saldo nunca queda negativo");
        assertEquals(0, tesorera.getGaravitos());
        assertEquals(total, tesorera.getGaravitos() + medica.getGaravitos(), "el total se conserva");
    }

    @Test
    @DisplayName("mensajes de movimiento de 4 jugadores mientras corre el tick: el ultimo movimiento aceptado es el que queda")
    void movesDuringTicksKeepConsistentState() throws Exception {
        String[] roles = { "SEGURIDAD", "SALUD", "ECONOMIA", "INFRAESTRUCTURA" };
        for (String role : roles) {
            session.joinPlayer(role);
        }
        session.start("SEGURIDAD");
        ConcurrentHashMap<String, double[]> ultimo = new ConcurrentHashMap<>();
        ConcurrentLinkedQueue<Throwable> errores = new ConcurrentLinkedQueue<>();
        AtomicInteger ticks = new AtomicInteger();

        Thread tick = new Thread(() -> {
            long t = System.currentTimeMillis();
            for (int i = 0; i < 200; i++) {
                try {
                    session.tick(t + i * 66L, 0.066);
                    session.playerStates(); // lo que se difunde en cada tick
                    ticks.incrementAndGet();
                } catch (Throwable e) {
                    errores.add(e);
                }
            }
        });
        tick.start();
        simultaneas(roles.length, i -> {
            Player p = session.getOrCreatePlayer(roles[i]);
            for (int paso = 0; paso < 50; paso++) {
                double x = p.getX() + 6;
                if (session.reportPosition(roles[i], 1, x, p.getY())) {
                    ultimo.put(roles[i], new double[] { x, p.getY() });
                }
            }
            return null;
        });
        tick.join(10_000);

        assertTrue(errores.isEmpty(), () -> "excepciones en el tick: " + errores);
        assertEquals(200, ticks.get());
        for (String role : roles) {
            double[] esperado = ultimo.get(role);
            if (esperado != null) {
                PlayerState estado = session.playerStates().stream()
                        .filter(p -> p.playerId().equals(role)).findFirst().orElseThrow();
                assertEquals(esperado[0], estado.x(), 0.001, role + ": el estado difundido es el del ultimo movimiento");
            }
        }
    }
}
