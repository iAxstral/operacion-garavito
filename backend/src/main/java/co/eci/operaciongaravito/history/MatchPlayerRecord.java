package co.eci.operaciongaravito.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Las estadisticas de un rol en una partida del historial. */
@Entity
@Table(name = "match_player")
public class MatchPlayerRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "match_id")
    private MatchRecord match;

    @Column(nullable = false, length = 32)
    private String role;

    @Column(nullable = false)
    private int kills;

    @Column(nullable = false)
    private int missions;

    @Column(name = "garavitos_earned", nullable = false)
    private int garavitosEarned;

    @Column(name = "damage_taken", nullable = false)
    private int damageTaken;

    @Column(nullable = false)
    private int revives;

    @Column(nullable = false)
    private int downs;

    @Column(name = "player_name", length = 24)
    private String playerName;

    protected MatchPlayerRecord() {
    }

    public MatchPlayerRecord(String role, int kills, int missions, int garavitosEarned, int damageTaken,
                             int revives, int downs, String playerName) {
        this(role, kills, missions, garavitosEarned, damageTaken, revives, downs);
        this.playerName = playerName;
    }

    public MatchPlayerRecord(String role, int kills, int missions, int garavitosEarned, int damageTaken,
                             int revives, int downs) {
        this.role = role;
        this.kills = kills;
        this.missions = missions;
        this.garavitosEarned = garavitosEarned;
        this.damageTaken = damageTaken;
        this.revives = revives;
        this.downs = downs;
    }

    void setMatch(MatchRecord match) {
        this.match = match;
    }

    public String getRole() {
        return role;
    }

    public String getPlayerName() {
        return playerName;
    }

    public int getKills() {
        return kills;
    }

    public int getMissions() {
        return missions;
    }

    public int getGaravitosEarned() {
        return garavitosEarned;
    }

    public int getDamageTaken() {
        return damageTaken;
    }

    public int getRevives() {
        return revives;
    }

    public int getDowns() {
        return downs;
    }
}
