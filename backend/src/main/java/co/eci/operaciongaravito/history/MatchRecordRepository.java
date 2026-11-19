package co.eci.operaciongaravito.history;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRecordRepository extends JpaRepository<MatchRecord, Long> {

    /** Mejores partidas de un edificio: primero las ganadas, despues el Kinder mas alto y la mas rapida. */
    List<MatchRecord> findTop10ByBuildingOrderByVictoryDescKinderReachedDescDurationSecondsAsc(String building);

    long countByBuilding(String building);

    long countByBuildingAndVictoryTrue(String building);

    /** Igual, pero de un modo y desde una fecha (el desafio del dia solo cuenta las de hoy). */
    List<MatchRecord> findTop10ByBuildingAndModeAndPlayedAtGreaterThanEqualOrderByVictoryDescKinderReachedDescDurationSecondsAsc(
            String building, String mode, java.time.Instant since);

    long countByBuildingAndModeAndPlayedAtGreaterThanEqual(String building, String mode, java.time.Instant since);

    long countByBuildingAndModeAndPlayedAtGreaterThanEqualAndVictoryTrue(String building, String mode,
                                                                        java.time.Instant since);
}
