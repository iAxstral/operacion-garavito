package co.eci.operaciongaravito.game;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

public class WaveDirector {

    private enum Phase { RESTING, SPAWNING, CLEARING }

    private static final double MIN_SPAWN_DISTANCE_PX = 320;
    public static final int FIRST_HAUNTED_FLOOR = 2;

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

    public int remaining(int alive) {
        return blueprint == null ? 0 : alive + (blueprint.total() - spawned);
    }

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

    public void resetRun(long now) {
        phase = Phase.RESTING;
        nextEventAt = now + WaveCurve.WAVE_REST_MS;
        wave = 0;
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
        List<Player> alive = players.stream().filter(Player::isAlive).toList();
        ThreadLocalRandom random = ThreadLocalRandom.current();
        int floor = pickZombieFloor(alive, random);
        ZombieSpawnCatalog.SpawnPoint point = pickSpawnPoint(alive.stream().filter(p -> p.getFloor() == floor).toList());
        return new Zombie(
                "z" + (++zombieSequence),
                floor,
                point.x(),
                point.y(),
                WaveCurve.rollHealth(blueprint, random.nextDouble()),
                WaveCurve.rollSpeed(blueprint, random.nextDouble())
        );
    }

    private int pickZombieFloor(List<Player> alive, ThreadLocalRandom random) {
        List<Integer> hauntedWithPlayers = alive.stream()
                .map(Player::getFloor)
                .filter(floor -> floor >= FIRST_HAUNTED_FLOOR)
                .toList();
        if (!hauntedWithPlayers.isEmpty()) {
            return hauntedWithPlayers.get(random.nextInt(hauntedWithPlayers.size()));
        }
        return FIRST_HAUNTED_FLOOR + random.nextInt(FloorGrid.FLOOR_COUNT - FIRST_HAUNTED_FLOOR + 1);
    }

    private ZombieSpawnCatalog.SpawnPoint pickSpawnPoint(List<Player> alive) {
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

        List<ZombieSpawnCatalog.SpawnPoint> acceptable = ZombieSpawnCatalog.POINTS.stream()
                .filter(candidate -> alive.stream().allMatch(player ->
                        Math.hypot(candidate.x() - player.getX(), candidate.y() - player.getY()) >= MIN_SPAWN_DISTANCE_PX))
                .toList();

        return acceptable.isEmpty()
                ? best
                : acceptable.get(ThreadLocalRandom.current().nextInt(acceptable.size()));
    }
}
