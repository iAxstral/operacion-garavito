package co.eci.operaciongaravito.game;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.IntFunction;
import java.util.random.RandomGenerator;

/**
 * Travesuras de Navidad: duendes que salen de la nada y tiran una bola de nieve (deja
 * ciego un instante) y renos que escupen barro con carbon (mancha la pantalla y quita
 * un poco de vida). Solo durante un Kinder activo.
 *
 * <p>El servidor decide todo, como con el acido del escupidor: donde aparece el bicho,
 * a quien le tira, por donde va la bola y a quien le pega. Asi todos ven lo mismo y la
 * bola se esquiva de verdad (va en linea recta hacia donde estaba el jugador al tirar).
 * El efecto en la pantalla (blanco o manchas) lo pinta el cliente del jugador golpeado
 * al ver su golpe en {@link #state}.
 *
 * <p>Concurrencia: el tick llama {@link #update} con el candado de la sala, y el
 * broadcast lee {@link #state}; ambos se serializan con el monitor de esta instancia.
 */
public class Travesuras {

    public enum Tipo {
        DUENDE(700, 650, 380, 20, 0, 170, 260),
        RENO(950, 700, 300, 26, 3, 230, 320);

        /** Desde que aparece hasta que tira. */
        final long preparaMs;
        /** Desde que tira hasta que se va. */
        final long quedaMs;
        final double velocidadPxS;
        final double radioGolpePx;
        final int dano;
        final double distanciaMinPx;
        final double distanciaMaxPx;

        Tipo(long preparaMs, long quedaMs, double velocidadPxS, double radioGolpePx, int dano,
                double distanciaMinPx, double distanciaMaxPx) {
            this.preparaMs = preparaMs;
            this.quedaMs = quedaMs;
            this.velocidadPxS = velocidadPxS;
            this.radioGolpePx = radioGolpePx;
            this.dano = dano;
            this.distanciaMinPx = distanciaMinPx;
            this.distanciaMaxPx = distanciaMaxPx;
        }
    }

    /** Un duende o un reno tal como viaja al cliente; {@code tiro} indica que ya lanzo. */
    public record BromistaState(String id, Tipo tipo, int floor, long x, long y, double angle, boolean tiro) {
    }

    /** Una bola de nieve o de barro en el aire. */
    public record BolaState(String id, Tipo tipo, int floor, long x, long y, double angle) {
    }

    /** A {@code playerId} le acaba de pegar una bola: su cliente pinta el efecto. */
    public record GolpeState(String id, Tipo tipo, String playerId, int floor, long x, long y) {
    }

    public record Estado(List<BromistaState> bromistas, List<BolaState> bolas, List<GolpeState> golpes) {
        public static final Estado VACIO = new Estado(List.of(), List.of(), List.of());
    }

    /** Pausa entre una travesura y la siguiente (al azar en este rango). */
    static final long ENTRE_MIN_MS = 9_000;
    static final long ENTRE_MAX_MS = 16_000;
    /** Los renos aparecen desde este Kinder; antes solo duendes. */
    static final int RENOS_DESDE_KINDER = 2;
    static final double CHANCE_RENO = 0.4;
    static final long VIDA_BOLA_MS = 1_400;
    /** Cuanto se sigue mandando un golpe (por si se pierde un mensaje). */
    static final long GOLPE_VISIBLE_MS = 900;

    private static final class Bromista {
        final String id;
        final Tipo tipo;
        final int floor;
        final double x;
        final double y;
        final String objetivo;
        final long tiraEn;
        final long seVaEn;
        double angle;
        boolean tiro;

        Bromista(String id, Tipo tipo, int floor, double x, double y, String objetivo, long now) {
            this.id = id;
            this.tipo = tipo;
            this.floor = floor;
            this.x = x;
            this.y = y;
            this.objetivo = objetivo;
            this.tiraEn = now + tipo.preparaMs;
            this.seVaEn = tiraEn + tipo.quedaMs;
        }
    }

    private static final class Bola {
        final String id;
        final Tipo tipo;
        final int floor;
        final double vx;
        final double vy;
        final long muereEn;
        double x;
        double y;

        Bola(String id, Tipo tipo, int floor, double x, double y, double angle, long now) {
            this.id = id;
            this.tipo = tipo;
            this.floor = floor;
            this.x = x;
            this.y = y;
            this.vx = Math.cos(angle) * tipo.velocidadPxS;
            this.vy = Math.sin(angle) * tipo.velocidadPxS;
            this.muereEn = now + VIDA_BOLA_MS;
        }
    }

    private record Golpe(GolpeState state, long nacio) {
    }

    private final RandomGenerator random;
    private final Map<String, Bromista> bromistas = new LinkedHashMap<>();
    private final Map<String, Bola> bolas = new LinkedHashMap<>();
    private final List<Golpe> golpes = new ArrayList<>();
    private long siguienteEn;
    private long secuencia;

    public Travesuras(RandomGenerator random, long now) {
        this.random = random;
        this.siguienteEn = now + pausa();
    }

    /**
     * Avanza un tick. {@code objetivos} son los jugadores que se pueden molestar (vivos,
     * ni escondidos ni a salvo); con {@code activo} en false no aparece nadie nuevo pero
     * lo que ya esta en el aire termina su recorrido.
     */
    public synchronized void update(long now, double deltaSeconds, boolean activo, int kinder,
            Collection<Player> objetivos, IntFunction<FloorGrid> pisos) {
        golpes.removeIf(golpe -> now - golpe.nacio() > GOLPE_VISIBLE_MS);

        if (activo && now >= siguienteEn && !objetivos.isEmpty()) {
            siguienteEn = now + pausa();
            aparecer(now, kinder, objetivos, pisos);
        } else if (!activo) {
            siguienteEn = Math.max(siguienteEn, now + ENTRE_MIN_MS);
        }

        for (Bromista bromista : bromistas.values()) {
            if (!bromista.tiro && now >= bromista.tiraEn) {
                lanzar(bromista, objetivos, now);
            }
        }
        bromistas.values().removeIf(bromista -> now >= bromista.seVaEn);

        bolas.values().removeIf(bola -> !avanzar(bola, now, deltaSeconds, objetivos, pisos.apply(bola.floor)));
    }

    /** Se va todo: al pasar un Kinder o si cae el equipo. */
    public synchronized void limpiar(long now) {
        bromistas.clear();
        bolas.clear();
        siguienteEn = now + pausa();
    }

    public synchronized Estado state() {
        if (bromistas.isEmpty() && bolas.isEmpty() && golpes.isEmpty()) {
            return Estado.VACIO;
        }
        return new Estado(
                bromistas.values().stream().map(b -> new BromistaState(b.id, b.tipo, b.floor, Math.round(b.x),
                        Math.round(b.y), b.angle, b.tiro)).toList(),
                bolas.values().stream().map(b -> new BolaState(b.id, b.tipo, b.floor, Math.round(b.x),
                        Math.round(b.y), Math.atan2(b.vy, b.vx))).toList(),
                golpes.stream().map(Golpe::state).toList());
    }

    private long pausa() {
        return random.nextLong(ENTRE_MIN_MS, ENTRE_MAX_MS + 1);
    }

    private void aparecer(long now, int kinder, Collection<Player> objetivos, IntFunction<FloorGrid> pisos) {
        List<Player> lista = List.copyOf(objetivos);
        Player victima = lista.get(random.nextInt(lista.size()));
        Tipo tipo = kinder >= RENOS_DESDE_KINDER && random.nextDouble() < CHANCE_RENO ? Tipo.RENO : Tipo.DUENDE;
        soltar(tipo, victima, now, pisos);
    }

    /** Hace aparecer un bicho de {@code tipo} cerca de {@code victima} (lo usan las pruebas). */
    synchronized void soltar(Tipo tipo, Player victima, long now, IntFunction<FloorGrid> pisos) {
        FloorGrid grid = pisos.apply(victima.getFloor());
        double[] punto = puntoCerca(grid, victima, tipo);
        if (punto == null) {
            return; // encerrado entre paredes: esta vez se salva
        }
        String id = (tipo == Tipo.DUENDE ? "duende" : "reno") + (++secuencia);
        Bromista bromista = new Bromista(id, tipo, victima.getFloor(), punto[0], punto[1], victima.getPlayerId(), now);
        bromista.angle = Math.atan2(victima.getY() - punto[1], victima.getX() - punto[0]);
        bromistas.put(id, bromista);
    }

    /** Un punto caminable a la distancia del tipo, con linea de vision hasta la victima. */
    private double[] puntoCerca(FloorGrid grid, Player victima, Tipo tipo) {
        for (int intento = 0; intento < 24; intento++) {
            double angulo = random.nextDouble(0, Math.PI * 2);
            double distancia = random.nextDouble(tipo.distanciaMinPx, tipo.distanciaMaxPx);
            double x = victima.getX() + Math.cos(angulo) * distancia;
            double y = victima.getY() + Math.sin(angulo) * distancia;
            if (grid.isWalkable(x, y) && grid.hasLineOfSight(x, y, victima.getX(), victima.getY())) {
                return new double[] { x, y };
            }
        }
        return null;
    }

    /** Tira hacia donde esta su victima en este momento (si se movio despues, la esquiva). */
    private void lanzar(Bromista bromista, Collection<Player> objetivos, long now) {
        bromista.tiro = true;
        Player victima = objetivos.stream()
                .filter(p -> p.getPlayerId().equals(bromista.objetivo) && p.getFloor() == bromista.floor)
                .findFirst().orElse(null);
        if (victima == null) {
            return; // se escondio o cambio de piso: el bicho se queda con la bola en la mano
        }
        bromista.angle = Math.atan2(victima.getY() - bromista.y, victima.getX() - bromista.x);
        String id = "bola" + (++secuencia);
        bolas.put(id, new Bola(id, bromista.tipo, bromista.floor, bromista.x, bromista.y, bromista.angle, now));
    }

    private boolean avanzar(Bola bola, long now, double deltaSeconds, Collection<Player> objetivos, FloorGrid grid) {
        if (now >= bola.muereEn) {
            return false;
        }
        bola.x += bola.vx * deltaSeconds;
        bola.y += bola.vy * deltaSeconds;
        if (!grid.isWalkable(bola.x, bola.y)) {
            return false;
        }
        for (Player player : objetivos) {
            if (player.isAlive() && player.getFloor() == bola.floor
                    && Math.hypot(player.getX() - bola.x, player.getY() - bola.y) <= bola.tipo.radioGolpePx) {
                if (bola.tipo.dano > 0) {
                    player.takeDamage(bola.tipo.dano);
                }
                golpes.add(new Golpe(new GolpeState(bola.id, bola.tipo, player.getPlayerId(), bola.floor,
                        Math.round(bola.x), Math.round(bola.y)), now));
                return false;
            }
        }
        return true;
    }
}
