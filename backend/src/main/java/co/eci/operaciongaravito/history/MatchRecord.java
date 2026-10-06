package co.eci.operaciongaravito.history;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Una partida terminada (victoria o equipo caido), tabla creada por Flyway (V1). */
@Entity
@Table(name = "match_record")
public class MatchRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String building;

    @Column(nullable = false)
    private boolean victory;

    @Column(name = "kinder_reached", nullable = false)
    private int kinderReached;

    @Column(name = "duration_seconds", nullable = false)
    private long durationSeconds;

    @Column(name = "player_count", nullable = false)
    private int playerCount;

    @Column(name = "played_at", nullable = false)
    private Instant playedAt;

    /** NORMAL, HARD o DAILY (V3). */
    @Column(nullable = false, length = 16)
    private String mode = "NORMAL";

    @OneToMany(mappedBy = "match", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<MatchPlayerRecord> players = new ArrayList<>();

    protected MatchRecord() {
    }

    public MatchRecord(String building, boolean victory, int kinderReached, long durationSeconds, Instant playedAt) {
        this.building = building;
        this.victory = victory;
        this.kinderReached = kinderReached;
        this.durationSeconds = durationSeconds;
        this.playedAt = playedAt;
    }

    public MatchRecord(String building, boolean victory, int kinderReached, long durationSeconds, Instant playedAt,
                       String mode) {
        this(building, victory, kinderReached, durationSeconds, playedAt);
        this.mode = mode;
    }

    public String getMode() {
        return mode;
    }

    public void addPlayer(MatchPlayerRecord player) {
        player.setMatch(this);
        players.add(player);
        playerCount = players.size();
    }

    public Long getId() {
        return id;
    }

    public String getBuilding() {
        return building;
    }

    public boolean isVictory() {
        return victory;
    }

    public int getKinderReached() {
        return kinderReached;
    }

    public long getDurationSeconds() {
        return durationSeconds;
    }

    public int getPlayerCount() {
        return playerCount;
    }

    public Instant getPlayedAt() {
        return playedAt;
    }

    public List<MatchPlayerRecord> getPlayers() {
        return players;
    }
}
