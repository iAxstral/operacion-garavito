package co.eci.operaciongaravito.game;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public class RoundCoordinator {

    static final int REQUIRED_DECISIONS = Role.values().length;
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

    public RoundState currentStateView() {
        RoundState state = currentState;
        return new RoundState(state.number(), state.schoolState(), false);
    }

    public void reset() {
        synchronized (resolveLock) {
            decisions.clear();
            schoolState.reset();
            roundNumber = 1;
            currentRoundResolved = false;
            currentState = new RoundState(roundNumber, schoolState.toSnapshot(), false);
            scheduleTimeout();
        }
    }

    public void submitDecision(String role, String action) {
        Role.valueOf(role);
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

    private void tryResolve(boolean forcedByTimeout) {
        synchronized (resolveLock) {
            if (currentRoundResolved) {
                return;
            }
            if (!forcedByTimeout && decisions.size() < REQUIRED_DECISIONS) {
                return;
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
