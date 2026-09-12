package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Barrera de sincronizacion por partida: espera las decisiones de los 4
 * roles antes de resolver la ronda actual.
 *
 * Mismo patron conceptual que un {@code CyclicBarrier} — todas las partes
 * "llegan" antes de que se dispare la accion, y solo se dispara una vez —
 * pero adaptado a mensajeria asincrona por WebSocket en vez de hilos
 * bloqueados en {@code await()}: aca "llegar a la barrera" es publicar
 * {@code /decide}, y la ronda se resuelve desde el hilo que entrega la 4a
 * decision, o desde un hilo del scheduler si se agota el timeout — nunca
 * hay un hilo esperando bloqueado.
 *
 * {@code decisions} es un {@code ConcurrentHashMap} (put por rol es
 * atomico y sin lock; una resubmision del mismo rol antes de que la ronda
 * resuelva simplemente sobreescribe su entrada en vez de duplicarla). El
 * unico {@code synchronized} esta en el punto de resolucion
 * ({@link #tryResolve}) — evita que dos disparadores (la 4a decision
 * llegando Y el timeout venciendo casi al mismo tiempo) resuelvan la misma
 * ronda dos veces.
 */
public class RoundCoordinator {

    static final int REQUIRED_DECISIONS = Role.values().length; // 4
    static final String DEFAULT_ACTION = "no_action";
    private static final long TIMEOUT_SECONDS = 30;

    private final SchoolState schoolState = new SchoolState();
    private final ScheduledExecutorService scheduler;
    private final Consumer<RoundState> onRoundResolved;
    private final Map<String, String> decisions = new ConcurrentHashMap<>();
    private final Object resolveLock = new Object();

    private volatile int roundNumber = 1;
    private volatile boolean currentRoundResolved = false;
    private volatile RoundState currentState;
    private volatile ScheduledFuture<?> timeoutTask;

    public RoundCoordinator(ScheduledExecutorService scheduler, Consumer<RoundState> onRoundResolved) {
        this.scheduler = scheduler;
        this.onRoundResolved = onRoundResolved;
        this.currentState = new RoundState(roundNumber, schoolState.toSnapshot(), false);
        scheduleTimeout();
    }

    /** Vista de la ronda actual, para broadcasts que no son "se acaba de resolver" (join/pickup). */
    public RoundState currentStateView() {
        RoundState state = currentState;
        return new RoundState(state.number(), state.schoolState(), false);
    }

    public void submitDecision(String role, String action) {
        Role.valueOf(role); // lanza IllegalArgumentException si el rol no es valido
        decisions.put(role, action);
        if (decisions.size() >= REQUIRED_DECISIONS) {
            tryResolve(false);
        }
    }

    private void scheduleTimeout() {
        ScheduledFuture<?> previous = timeoutTask;
        if (previous != null) {
            previous.cancel(false);
        }
        timeoutTask = scheduler.schedule(() -> tryResolve(true), TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    /**
     * @param forcedByTimeout true si dispara porque se agoto el tiempo (resuelve
     *                        igual, completando con {@link #DEFAULT_ACTION} los
     *                        roles faltantes); false si dispara porque llego una
     *                        decision (solo resuelve si ya estan las 4).
     */
    private void tryResolve(boolean forcedByTimeout) {
        synchronized (resolveLock) {
            if (currentRoundResolved) {
                return; // ya resolvio el otro disparador (decision vs timeout) para esta ronda
            }
            if (!forcedByTimeout && decisions.size() < REQUIRED_DECISIONS) {
                return; // todavia faltan decisiones y no vencio el timeout
            }
            currentRoundResolved = true;

            for (Role role : Role.values()) {
                decisions.putIfAbsent(role.name(), DEFAULT_ACTION);
            }

            schoolState.applyDecisions(decisions, DEFAULT_ACTION);
            RoundState resolved = new RoundState(roundNumber, schoolState.toSnapshot(), true);
            currentState = resolved;

            decisions.clear();
            roundNumber += 1;
            currentRoundResolved = false;
            scheduleTimeout();

            onRoundResolved.accept(resolved);
        }
    }
}
