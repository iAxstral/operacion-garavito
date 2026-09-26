package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Director de los 5 Kinders de un edificio: respiro → Kinder activo → … → victoria.
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

    private enum Phase { RESTING, ACTIVE, VICTORY }

    /** Un zombi nunca aparece mas cerca que esto de un jugador vivo de su piso. */
    static final double MIN_SPAWN_DISTANCE_PX = 320;

    private final List<FloorGrid> floors;

    private int kinder;
    private WaveBlueprint blueprint;
    private int kills;
    private Phase phase = Phase.RESTING;
    private long nextEventAt;
    private long zombieSequence;
    private boolean justCleared;
    private boolean bossDue;

    public WaveDirector(long now, long startDelayMs, List<FloorGrid> floors) {
        this.nextEventAt = now + startDelayMs;
        this.floors = floors;
    }

    public synchronized WaveState state(long now) {
        int quota = blueprint == null ? 0 : blueprint.killQuota();
        boolean bossStage = phase == Phase.ACTIVE && blueprint.boss();
        int remaining = phase == Phase.ACTIVE && !bossStage ? Math.max(0, quota - kills) : 0;
        return new WaveState(kinder, WaveCurve.KINDER_COUNT, kills, quota, remaining,
                restingSeconds(now), bossStage, phase == Phase.VICTORY);
    }

    public synchronized int getKinder() {
        return kinder;
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
        switch (phase) {
            case RESTING -> {
                if (now >= nextEventAt) {
                    startKinder(now, kinder + 1);
                }
            }
            case ACTIVE -> {
                if (!blueprint.boss() && kills >= blueprint.killQuota()) {
                    finishKinder(now);
                    return List.of();
                }
                if (now >= nextEventAt) {
                    nextEventAt = now + blueprint.spawnIntervalMs();
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
            finishKinder(now);
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
    }

    private void startKinder(long now, int number) {
        kinder = number;
        blueprint = WaveCurve.blueprint(number);
        kills = 0;
        phase = Phase.ACTIVE;
        nextEventAt = now;
        bossDue = blueprint.boss();
    }

    private void finishKinder(long now) {
        justCleared = true;
        if (kinder >= WaveCurve.KINDER_COUNT) {
            phase = Phase.VICTORY;
            return;
        }
        phase = Phase.RESTING;
        nextEventAt = now + WaveCurve.WAVE_REST_MS;
    }

    private List<Zombie> spawnBurst(int alive, Collection<Player> players) {
        List<Player> living = players.stream().filter(Player::isAlive).toList();
        if (living.isEmpty()) {
            return List.of();
        }
        int room = WaveCurve.maxAlive(blueprint, players.size()) - alive;
        int count = Math.min(blueprint.spawnBurst(), room);

        ThreadLocalRandom random = ThreadLocalRandom.current();
        List<Zombie> burst = new ArrayList<>(Math.max(0, count));
        for (int i = 0; i < count; i++) {
            // Se sortea un jugador vivo y se spawnea en SU piso: asi la horda aparece
            // en todos los pisos donde hay gente, y nunca en uno que nadie pisa.
            int floor = living.get(random.nextInt(living.size())).getFloor();
            List<Player> onFloor = living.stream().filter(p -> p.getFloor() == floor).toList();
            FloorGrid.SpawnPoint point = pickSpawnPoint(floors.get(floor - 1).spawnPoints(), onFloor, random);
            burst.add(new Zombie(
                    "z" + (++zombieSequence),
                    floor,
                    point.x(),
                    point.y(),
                    WaveCurve.rollHealth(blueprint, random.nextDouble()),
                    WaveCurve.rollSpeed(blueprint, random.nextDouble())));
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
