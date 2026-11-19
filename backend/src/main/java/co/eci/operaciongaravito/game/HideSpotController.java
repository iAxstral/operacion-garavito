package co.eci.operaciongaravito.game;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** GET /api/buildings/{building}/hide-spots: los armarios de ese edificio (fijos). */
@RestController
public class HideSpotController {

    @GetMapping("/api/buildings/{building}/hide-spots")
    public List<HideSpots.Spot> hideSpots(@PathVariable String building) {
        return HideSpots.forBuilding(Building.parseOrDefault(building));
    }
}
