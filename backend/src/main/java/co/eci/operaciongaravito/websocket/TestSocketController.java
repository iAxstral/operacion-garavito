package co.eci.operaciongaravito.websocket;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

/**
 * Sprint 1 scaffolding only: confirms the STOMP client/server can exchange
 * messages before any game/round logic exists.
 */
@Controller
public class TestSocketController {

    @MessageMapping("/game/test")
    @SendTo("/topic/game/test")
    public TestMessage echo(TestMessage message) {
        return new TestMessage("echo: " + message.text());
    }

    public record TestMessage(String text) {
    }
}
