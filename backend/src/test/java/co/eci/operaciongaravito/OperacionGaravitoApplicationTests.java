package co.eci.operaciongaravito;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// Perfil dev (H2 en memoria) para que `./mvnw package` no dependa de un
// PostgreSQL corriendo en la máquina que compila.
@SpringBootTest
@ActiveProfiles("dev")
class OperacionGaravitoApplicationTests {

	@Test
	void contextLoads() {
	}

}
