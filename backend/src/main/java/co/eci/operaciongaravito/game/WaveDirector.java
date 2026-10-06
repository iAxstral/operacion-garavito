package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Director de los 5 Kinders de un edificio: respiro → Kinder activo → … → escape → victoria.
 *
 * Al caer el jefe del Kinder 5 empieza el escape: la horda sigue llegando y el equipo
 * tiene {@link #ESCAPE_MS} para correr a la salida (la entrada del piso 1). GameSession
 * decide quien escapo y llama {@link #win()}.
 *
 * Un Kinder se pasa matando su cuota de zombis, no limpiando todo el mapa: asi un
 * zombi varado en un piso vacio nunca traba la partida. Mientras el Kinder esta
 * activo aparecen rafagas de zombis en todos los pisos donde hay jugadores vivos
 * (incluido el piso 1), hasta el tope de vivos simultaneos.
 *
 * Concurrencia: el tick llama {@link #update} y las kills llegan desde hilos de
 * Tomcat ({@link #onZombiesKilled}); todo el estado se protege con el monitor de
 * esta instancia.
 */
public class WaveDirector {

    private enum Phase { RESTING, ACTIVE, ESCAPE, VICTORY }

    /** Tiempo para llegar a la salida tras vencer al jefe. */
    public static final long ESCAPE_MS = 75_000;
    /** Respiro corto antes de que la horda vuelva a llegar en el escape. */
    static final long ESCAPE_GRACE_MS = 2_500;

    /** Un zombi nunca aparece mas cerca que esto de un jugador vivo de su piso. */
    static final double MIN_SPAWN_DISTANCE_PX = 320;

    private final List<FloorGrid> floors;

    private int kinder;
    private WaveBlueprint blueprint;
    private int kills;
    private Phase phase = Phase.RESTING;
    private long nextEventAt;
    private long zombieSequence;
    /** Turno de piso para la proxima aparicion: se reparten por turnos, no al azar. */
    private int floorTurn;
    private boolean justCleared;
    private boolean bossDue;
    private boolean bossDefeated;
    /** Se cumplio la cuota (o cayo el jefe) pero faltan misiones: la horda sigue llegando. */
    private boolean waitingForMissions;
    private long escapeEndsAt;

    public WaveDirector(long now, long startDelayMs, List<FloorGrid> floors) {
        this.nextEventAt = now + startDelayMs;
        this.floors = floors;
    }

    public synchronized WaveState state(long now) {
        int quota = blueprint == null ? 0 : blueprint.killQuota();
        boolean bossStage = phase == Phase.ACTIVE && blueprint.boss();
        int remaining = phase == Phase.ACTIVE && !bossStage ? Math.max(0, quota - kills) : 0;
        return new WaveState(kinder, WaveCurve.KINDER_COUNT, kills, quota, remaining,
                restingSeconds(now), bossStage, phase == Phase.VICTORY,
                phase == Phase.ACTIVE && waitingForMissions, 0, 0,
                phase == Phase.ESCAPE, escapeSecondsLeft(now));
    }

    /** True si hay un Kinder en curso (no respiro ni victoria). */
    public synchronized boolean isActive() {
        return phase == Phase.ACTIVE;
    }

    public synchronized int getKinder() {
        return kinder;
    }

    /**
     * Kinder para el que se juegan las misiones ahora: el que viene durante el respiro,
     * el activo durante el Kinder, 0 tras ganar.
     */
    public synchronized int upcomingKinder() {
        return switch (phase) {
            case RESTING -> Math.min(kinder + 1, WaveCurve.KINDER_COUNT);
            case ACTIVE -> kinder;
            case ESCAPE, VICTORY -> 0;
        };
    }

    public synchronized boolean isEscaping() {
        return phase == Phase.ESCAPE;
    }

    public synchronized int escapeSecondsLeft(long now) {
        if (phase != Phase.ESCAPE) {
            return 0;
        }
        return (int) Math.max(0, Math.ceil((escapeEndsAt - now) / 1000.0));
    }

    public synchronized boolean escapeTimedOut(long now) {
        return phase == Phase.ESCAPE && now >= escapeEndsAt;
    }

    /** El equipo escapo: se gana la corrida. */
    public synchronized void win() {
        if (phase == Phase.ESCAPE) {
            phase = Phase.VICTORY;
        }
    }

    public synchronized boolean isVictory() {
        return phase == Phase.VICTORY;
    }

    public synchronized int restingSeconds(long now) {
        if (phase != Phase.RESTING) {
            return 0;
        }
        return (int) Math.max(0, Math.ceil((nextEventAt - now) / 1000.0));
    }

    /**
     * Avanza el Kinder y devuelve los zombis a agregar en este tick (una rafaga, o
     * ninguno). {@code alive} son los zombis vivos que ya hay en el mapa.
     */
    public synchronized List<Zombie> update(long now, int alive, Collection<Player> players) {
        return update(now, alive, players, true);
    }

    /**
     * Igual que {@link #update(long, int, Collection)}, pero el Kinder solo se pasa si
     * ademas {@code missionsDone} (la barrera del MissionBoard esta abierta).
     */
    public synchronized List<Zombie> update(long now, int alive, Collection<Player> players, boolean missionsDone) {
        switch (phase) {
            case RESTING -> {
                if (now >= nextEventAt) {
                    startKinder(now, kinder + 1);
                }
            }
            case ACTIVE -> {
                boolean goalMet = blueprint.boss() ? bossDefeated : kills >= blueprint.killQuota();
                waitingForMissions = goalMet && !missionsDone;
                if (goalMet && missionsDone) {
                    finishKinder(now);
                    return List.of();
                }
                if (now >= nextEventAt) {
                    nextEventAt = now + blueprint.spawnIntervalMs();
                    return spawnBurst(alive, players);
                }
            }
            case ESCAPE -> {
                // La horda no para mientras corren a la salida (sin cuota que cumplir).
                if (now >= nextEventAt) {
                    nextEventAt = now + Math.max(400, blueprint.spawnIntervalMs() * 6 / 10);
                    return spawnBurst(alive, players);
                }
            }
            case VICTORY -> {
                // Nada: la corrida se gano.
            }
        }
        return List.of();
    }

    /** Suma kills al Kinder activo; los kills durante el respiro no cuentan. */
    public synchronized void onZombiesKilled(int count) {
        if (phase == Phase.ACTIVE && count > 0) {
            kills += count;
        }
    }

    /** El jefe del ultimo Kinder cayo: se gana la corrida. */
    public synchronized void onBossDefeated(long now) {
        if (phase == Phase.ACTIVE && blueprint.boss()) {
            // Se cierra en el proximo update, cuando tambien esten las misiones.
            bossDefeated = true;
        }
    }

    /** True una sola vez al empezar el Kinder del jefe: es el momento de hacerlo aparecer. */
    public synchronized boolean consumeBossDue() {
        boolean value = bossDue;
        bossDue = false;
        return value;
    }

    /** True una sola vez justo despues de pasar un Kinder (para retirar la horda). */
    public synchronized boolean consumeJustCleared() {
        boolean value = justCleared;
        justCleared = false;
        return value;
    }

    /** Vuelve al Kinder 1: se usa al empezar la partida y cuando cae todo el equipo. */
    public synchronized void resetRun(long now, long delayMs) {
        phase = Phase.RESTING;
        nextEventAt = now + delayMs;
        kinder = 0;
        kills = 0;
        blueprint = null;
        justCleared = false;
        bossDue = false;
        bossDefeated = false;
        waitingForMissions = false;
    }

    private void startKinder(long now, int number) {
        kinder = number;
        blueprint = WaveCurve.blueprint(number);
        kills = 0;
        phase = Phase.ACTIVE;
        nextEventAt = now;
        bossDue = blueprint.boss();
        bossDefeated = false;
        waitingForMissions = false;
    }

    private void finishKinder(long now) {
        justCleared = true;
        if (kinder >= WaveCurve.KINDER_COUNT) {
            phase = Phase.ESCAPE;
            escapeEndsAt = now + ESCAPE_MS;
            nextEventAt = now + ESCAPE_GRACE_MS;
            return;
        }
        phase = Phase.RESTING;
        nextEventAt = now + WaveCurve.WAVE_REST_MS;
    }

    private List<Zombie> spawnBurst(int alive, Collection<Player> players) {
        int room = WaveCurve.maxAlive(blueprint, players.size()) - alive;
        return spawn(Math.min(blueprint.spawnBurst(), room), players);
    }

    /**
     * Horda extra (p. ej. si nadie recogio los suministros): {@code count} zombis del
     * Kinder activo aunque se pase el tope de vivos. Vacia si no hay Kinder activo.
     */
    public synchronized List<Zombie> surge(Collection<Player> players, int count) {
        if (phase != Phase.ACTIVE) {
            return List.of();
        }
        return spawn(count, players);
    }

    private List<Zombie> spawn(int count, Collection<Player> players) {
        List<Player> living = players.stream().filter(Player::isAlive).toList();
        if (living.isEmpty()) {
            return List.of();
        }

        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<Zombie> burst = new ArrayList<>(Math.max(0, count));
        // Pisos con gente viva, por turnos: asi la horda aparece en todos ellos (antes se
        // sorteaba y a veces un piso ocupado se quedaba sin zombis) y nunca en uno vacio.
        List<Integer> occupied = living.stream().map(Player::getFloor).distinct().sorted().toList();
        for (int i = 0; i < count; i++) {
            int floor = occupied.get(Math.floorMod(floorTurn++, occupied.size()));
            List<Player> onFloor = living.stream().filter(p -> p.getFloor() == floor).toList();
            FloorGrid.SpawnPoint point = pickSpawnPoint(floors.get(floor - 1).spawnPoints(), onFloor, random);
            ZombieKind kind = WaveCurve.rollKind(blueprint, random.nextDouble());
            int health = kind.health() > 0 ? kind.health() : WaveCurve.rollHealth(blueprint, random.nextDouble());
            burst.add(new Zombie(
                    "z" + (++zombieSequence),
                    floor,
                    point.x(),
                    point.y(),
                    health,
                    WaveCurve.rollSpeed(blueprint, random.nextDouble()) * kind.speedFactor(),
                    kind));
        }
        return burst;
    }

    /**
     * Un punto al azar entre los que quedan lejos de todos los jugadores del piso
     * ("de todos lados"); si el piso esta tan lleno que ninguno califica, el mas lejano.
     */
    static FloorGrid.SpawnPoint pickSpawnPoint(List<FloorGrid.SpawnPoint> points, List<Player> onFloor,
                                                       ThreadLocalRandom random) {
        List<FloorGrid.SpawnPoint> acceptable = points.stream()
                .filter(point -> onFloor.stream().allMatch(player ->
                        Math.hypot(point.x() - player.getX(), point.y() - player.getY()) >= MIN_SPAWN_DISTANCE_PX))
                .toList();
        if (!acceptable.isEmpty()) {
            return acceptable.get(random.nextInt(acceptable.size()));
        }

        FloorGrid.SpawnPoint best = points.get(0);
        double bestDistance = -1;
        for (FloorGrid.SpawnPoint point : points) {
            double nearest = onFloor.stream()
                    .mapToDouble(player -> Math.hypot(point.x() - player.getX(), point.y() - player.getY()))
                    .min().orElse(Double.MAX_VALUE);
            if (nearest > bestDistance) {
                bestDistance = nearest;
                best = point;
            }
        }
        return best;
    }
}
