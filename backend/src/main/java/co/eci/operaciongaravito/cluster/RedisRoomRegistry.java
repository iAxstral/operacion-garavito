package co.eci.operaciongaravito.cluster;

import java.time.Duration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Registro compartido en Redis (perfil {@code cluster}): clave
 * {@code garavito:room:CODIGO} con la URL del nodo dueño. Se crea con SET NX (solo un
 * nodo gana la sala aunque dos la creen a la vez) y caduca en dos minutos si el nodo
 * deja de renovarla (por ejemplo, si se cayo).
 */
@Component
@Profile("cluster")
public class RedisRoomRegistry implements RoomRegistry {

    static final Duration TTL = Duration.ofMinutes(2);
    private static final String PREFIX = "garavito:room:";

    private final StringRedisTemplate redis;

    public RedisRoomRegistry(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public boolean claim(String code, String nodeUrl) {
        Boolean created = redis.opsForValue().setIfAbsent(PREFIX + code, nodeUrl, TTL);
        return Boolean.TRUE.equals(created) || nodeUrl.equals(ownerOf(code));
    }

    @Override
    public String ownerOf(String code) {
        return redis.opsForValue().get(PREFIX + code);
    }

    @Override
    public void refresh(String code, String nodeUrl) {
        if (nodeUrl.equals(ownerOf(code))) {
            redis.expire(PREFIX + code, TTL);
        }
    }

    @Override
    public void release(String code, String nodeUrl) {
        if (nodeUrl.equals(ownerOf(code))) {
            redis.delete(PREFIX + code);
        }
    }
}
