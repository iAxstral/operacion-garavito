package co.eci.operaciongaravito.cluster;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Un solo nodo: el registro vive en memoria (y nunca hay a donde redirigir). */
@Component
@Profile("!cluster")
public class InMemoryRoomRegistry implements RoomRegistry {

    private final Map<String, String> owners = new ConcurrentHashMap<>();

    @Override
    public boolean claim(String code, String nodeUrl) {
        return nodeUrl.equals(owners.computeIfAbsent(code, c -> nodeUrl));
    }

    @Override
    public String ownerOf(String code) {
        return owners.get(code);
    }

    @Override
    public void refresh(String code, String nodeUrl) {
        // En memoria no caduca.
    }

    @Override
    public void release(String code, String nodeUrl) {
        owners.remove(code, nodeUrl);
    }
}
