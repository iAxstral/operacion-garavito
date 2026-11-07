package co.eci.operaciongaravito.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

/**
 * application.properties tiene un bloque solo para produccion (separado con #---). Si ese
 * separador queda mal escrito, Spring ignora el archivo entero sin avisar: los limites de
 * seguridad caerian a sus valores por defecto y el health check marcaria Redis caido.
 */
@SpringBootTest
@ActiveProfiles("dev")
class ConfiguracionCargadaTest {

    @Autowired
    Environment environment;

    @Test
    @DisplayName("con el perfil dev se carga application.properties (y no el bloque de produccion)")
    void basePropertiesAreLoaded() {
        assertEquals("operacion-garavito", environment.getProperty("spring.application.name"));
        assertEquals("false", environment.getProperty("management.health.redis.enabled"));
        assertEquals("never", environment.getProperty("server.error.include-stacktrace"));
        assertEquals("80", environment.getProperty("security.ratelimit.burst"));
        assertNull(environment.getProperty("management.server.port"), "el actuator va en el mismo puerto en dev");
    }
}
