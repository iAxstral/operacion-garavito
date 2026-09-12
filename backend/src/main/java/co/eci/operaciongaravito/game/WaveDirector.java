package co.eci.operaciongaravito.game;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Maquina de estados de las oleadas: spawneando → limpiando → respiro.
 *
 * Decide *cuando* spawnear; {@link WaveCurve} decide *que tan dura* es la
 * oleada y {@link ZombieSpawnCatalog} *donde* puede aparecer un zombi. La
 * llama unicamente el hilo del tick de {@link GameSession}, asi que su estado
 * interno no necesita sincronizacion.
 */
public class WaveDirector {

    private enum Phase { RESTING, SPAWNING, CLEARING }

    /** Un zombi nunca aparece mas cerca que esto de un jugador vivo. */
    private static final double MIN_SPAWN_DISTANCE_PX = 320;

    private int wave;
    private WaveBlueprint blueprint;
    private int spawned;
    private Phase phase = Phase.RESTING;
    private long nextEventAt;
    private long zombieSequence;

    public WaveDirector(long now, long startDelayMs) {
        this.nextEventAt = now + startDelayMs;
    }

    public int getWave() {
        return wave;
    }

    public int restingSeconds(long now) {
        if (phase != Phase.RESTING) {
            return 0;
        }
        return (int) Math.max(0, Math.ceil((nextEventAt - now) / 1000.0));
    }

    /** Zombis que aun se le deben a esta oleada: en pie mas los no spawneados. */
    public int remaining(int alive) {
        return blueprint == null ? 0 : alive + (blueprint.total() - spawned);
    }

    /**
     * Avanza la oleada. Devuelve el zombi a agregar en este tick, o null.
     * Devolver como mucho uno por tick es intencional: mantiene la cadencia
     * de spawn aunque el tick se atrase, en vez de vomitar la oleada entera.
     */
    public Zombie update(long now, int alive, Collection<Player> players) {
        switch (phase) {
            case RESTING -> {
                if (now >= nextEventAt) {
                    startWave(now, wave + 1);
                }
            }
            case SPAWNING -> {
                if (now >= nextEventAt) {
                    nextEventAt = now + blueprint.spawnIntervalMs();
                    spawned++;
                    if (spawned >= blueprint.total()) {
                        phase = Phase.CLEARING;
                    }
                    return spawnZombie(players);
                }
                if (spawned >= blueprint.total()) {
                    phase = Phase.CLEARING;
                }
            }
            case CLEARING -> {
                if (alive == 0) {
                    phase = Phase.RESTING;
                    nextEventAt = now + WaveCurve.WAVE_REST_MS;
                }
            }
        }
        return null;
    }

    /**
     * Corta la corrida y vuelve a empezar desde la oleada 1. Se usa cuando cae
     * el equipo completo: perder el progreso de oleadas es el costo de morir.
     * Antes esto reintentaba la misma oleada, que en la practica hacia que
     * morir no costara nada.
     */
    public void resetRun(long now) {
        phase = Phase.RESTING;
        nextEventAt = now + WaveCurve.WAVE_REST_MS;
        wave = 0; // startWave sumara 1
        spawned = 0;
    }

    private void startWave(long now, int number) {
        wave = number;
        blueprint = WaveCurve.blueprint(number);
        spawned = 0;
        phase = Phase.SPAWNING;
        nextEventAt = now;
    }

    private Zombie spawnZombie(Collection<Player> players) {
        ZombieSpawnCatalog.SpawnPoint point = pickSpawnPoint(players);
        ThreadLocalRandom random = ThreadLocalRandom.current();
        return new Zombie(
                "z" + (++zombieSequence),
                point.x(),
                point.y(),
                WaveCurve.rollHealth(blueprint, random.nextDouble()),
                WaveCurve.rollSpeed(blueprint, random.nextDouble())
        );
    }

    /**
     * Elige el punto de spawn mas lejano posible entre los que estan a una
     * distancia decente de todos los jugadores vivos. Si ninguno califica
     * (jugadores repartidos por todo el piso), cae en el que maximiza la
     * distancia al jugador mas cercano — nunca aparece encima de nadie.
     */
    private ZombieSpawnCatalog.SpawnPoint pickSpawnPoint(Collection<Player> players) {
        List<Player> alive = players.stream().filter(Player::isAlive).toList();
        if (alive.isEmpty()) {
            return ZombieSpawnCatalog.POINTS.get(
                    ThreadLocalRandom.current().nextInt(ZombieSpawnCatalog.POINTS.size()));
        }

        ZombieSpawnCatalog.SpawnPoint best = null;
        double bestDistance = -1;
        for (ZombieSpawnCatalog.SpawnPoint candidate : ZombieSpawnCatalog.POINTS) {
            double nearest = Double.MAX_VALUE;
            for (Player player : alive) {
                nearest = Math.min(nearest, Math.hypot(candidate.x() - player.getX(), candidate.y() - player.getY()));
            }
            if (nearest > bestDistance) {
                bestDistance = nearest;
                best = candidate;
            }
        }

        // Entre los que superan el minimo, se sortea para que la horda no
        // entre siempre por la misma esquina.
        List<ZombieSpawnCatalog.SpawnPoint> acceptable = ZombieSpawnCatalog.POINTS.stream()
                .filter(candidate -> alive.stream().allMatch(player ->
                        Math.hypot(candidate.x() - player.getX(), candidate.y() - player.getY()) >= MIN_SPAWN_DISTANCE_PX))
                .toList();

        return acceptable.isEmpty()
                ? best
                : acceptable.get(ThreadLocalRandom.current().nextInt(acceptable.size()));
    }
}
