package co.eci.operaciongaravito.history;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRecordRepository extends JpaRepository<MatchRecord, Long> {

    /** Mejores partidas de un edificio: primero las ganadas, despues el Kinder mas alto y la mas rapida. */
    List<MatchRecord> findTop10ByBuildingOrderByVictoryDescKinderReachedDescDurationSecondsAsc(String building);

    long countByBuilding(String building);

    long countByBuildingAndVictoryTrue(String building);
}
