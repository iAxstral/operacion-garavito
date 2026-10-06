package co.eci.operaciongaravito.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import co.eci.operaciongaravito.cluster.InMemoryRoomRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Dos nodos que comparten el registro sala -> nodo (como con Redis en el perfil cluster). */
class ClusterRoutingTest {

    private static final String NODE_A = "http://nodo-a:8080";
    private static final String NODE_B = "http://nodo-b:8080";

    private GameSessionService nodeA;
    private GameSessionService nodeB;

    private static GameSessionService node(String url, InMemoryRoomRegistry registry) {
        GameSessionService service = new GameSessionService(null, null, 8, 1, 500, 600, 1500, 3000, 115, 24, 12, 900);
        service.setRoomRegistry(registry);
        service.setNodeUrl(url);
        return service;
    }

    @BeforeEach
    void setUp() {
        InMemoryRoomRegistry shared = new InMemoryRoomRegistry();
        nodeA = node(NODE_A, shared);
        nodeB = node(NODE_B, shared);
    }

    @Test
    @DisplayName("la sala creada en un nodo redirige al otro hacia su dueño")
    void redirectsToOwner() {
        assertNotNull(nodeA.create("ABCD", Building.F));
        assertNull(nodeA.redirectFor("ABCD"), "en su nodo no hay redireccion");
        assertEquals(NODE_A, nodeB.redirectFor("ABCD"));
        assertNull(nodeB.redirectFor("ZZZZ"), "una sala que no existe no redirige");
    }

    @Test
    @DisplayName("dos nodos no pueden tener la misma sala")
    void codeTakenAcrossNodes() {
        assertNotNull(nodeA.create("ABCD", Building.F));
        assertNull(nodeB.create("ABCD", Building.F), "el codigo ya es de otro nodo");
        assertNotNull(nodeB.create("EFGH", Building.C));
        assertEquals(NODE_B, nodeA.redirectFor("EFGH"));
    }

    @Test
    @DisplayName("el registro en memoria solo deja soltar la sala a su dueño")
    void releaseOnlyByOwner() {
        InMemoryRoomRegistry registry = new InMemoryRoomRegistry();
        assertTrue(registry.claim("ABCD", NODE_A));
        assertFalse(registry.claim("ABCD", NODE_B));
        registry.release("ABCD", NODE_B);
        assertEquals(NODE_A, registry.ownerOf("ABCD"));
        registry.release("ABCD", NODE_A);
        assertNull(registry.ownerOf("ABCD"));
        assertTrue(registry.claim("ABCD", NODE_B));
    }
}
