package co.eci.operaciongaravito.security;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

/**
 * Cliente STOMP "a mano" sobre el WebSocket crudo de SockJS (/ws/websocket), como el
 * que usaria un atacante: manda los frames tal cual (comodines, destinos prohibidos,
 * cuerpos rotos, frames gigantes) sin la proteccion de una libreria.
 */
final class RawStompClient implements AutoCloseable {

    record Frame(String command, Map<String, String> headers, String body) {
        String header(String name) {
            return headers.get(name);
        }
    }

    private final List<Frame> frames = new CopyOnWriteArrayList<>();
    private final StringBuilder partial = new StringBuilder();
    private final CompletableFuture<Void> connected = new CompletableFuture<>();
    private volatile boolean closed;
    private volatile int closeCode;
    private WebSocket socket;
    private int subscriptions;

    static RawStompClient connect(int port, String origin) throws Exception {
        RawStompClient client = new RawStompClient();
        client.open(port, origin);
        return client;
    }

    private void open(int port, String origin) throws Exception {
        WebSocket.Builder builder = HttpClient.newHttpClient().newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(5));
        if (origin != null) {
            builder.header("Origin", origin);
        }
        socket = builder.buildAsync(URI.create("ws://localhost:" + port + "/ws/websocket"), new WebSocket.Listener() {
            @Override
            public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
                synchronized (partial) {
                    partial.append(data);
                    if (last) {
                        parse(partial.toString());
                        partial.setLength(0);
                    }
                }
                webSocket.request(1);
                return null;
            }

            @Override
            public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
                closed = true;
                closeCode = statusCode;
                return null;
            }

            @Override
            public void onError(WebSocket webSocket, Throwable error) {
                closed = true;
            }
        }).get(5, TimeUnit.SECONDS);
        sendRaw(frame("CONNECT", Map.of("accept-version", "1.2", "host", "localhost", "heart-beat", "0,0"), ""));
        connected.get(5, TimeUnit.SECONDS);
    }

    private void parse(String text) {
        for (String raw : text.split("\0")) {
            String chunk = raw.replaceFirst("^\n+", "");
            if (chunk.isBlank()) {
                continue;
            }
            int sep = chunk.indexOf("\n\n");
            String head = sep < 0 ? chunk : chunk.substring(0, sep);
            String body = sep < 0 ? "" : chunk.substring(sep + 2);
            String[] lines = head.split("\n");
            Map<String, String> headers = new LinkedHashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon > 0) {
                    headers.putIfAbsent(lines[i].substring(0, colon), lines[i].substring(colon + 1));
                }
            }
            Frame frame = new Frame(lines[0], headers, body);
            frames.add(frame);
            if ("CONNECTED".equals(frame.command())) {
                connected.complete(null);
            }
        }
    }

    static String frame(String command, Map<String, String> headers, String body) {
        StringBuilder sb = new StringBuilder(command).append('\n');
        headers.forEach((k, v) -> sb.append(k).append(':').append(v).append('\n'));
        return sb.append('\n').append(body).append('\0').toString();
    }

    void sendRaw(String text) {
        if (closed) {
            return;
        }
        try {
            socket.sendText(text, true).get(5, TimeUnit.SECONDS);
        } catch (Exception ex) {
            closed = true;
        }
    }

    String subscribe(String destination) {
        String id = "sub-" + (subscriptions++);
        sendRaw(frame("SUBSCRIBE", Map.of("id", id, "destination", destination), ""));
        return id;
    }

    void unsubscribe(String id) {
        sendRaw(frame("UNSUBSCRIBE", Map.of("id", id), ""));
    }

    void send(String destination, String json) {
        sendRaw(frame("SEND", Map.of("destination", destination, "content-type", "application/json"), json));
    }

    List<Frame> frames() {
        return new ArrayList<>(frames);
    }

    List<Frame> messages() {
        return frames.stream().filter(f -> "MESSAGE".equals(f.command())).toList();
    }

    List<Frame> messagesTo(String destinationPrefix) {
        return messages().stream().filter(f -> f.header("destination") != null
                && f.header("destination").startsWith(destinationPrefix)).toList();
    }

    boolean sawError() {
        return frames.stream().anyMatch(f -> "ERROR".equals(f.command()));
    }

    /** Espera hasta {@code ms} a que llegue un frame que cumpla {@code test}. */
    Frame await(Predicate<Frame> test, long ms) throws InterruptedException {
        long until = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < until) {
            for (Frame frame : frames) {
                if (test.test(frame)) {
                    return frame;
                }
            }
            Thread.sleep(20);
        }
        return null;
    }

    /** Mensaje cuyo cuerpo contiene {@code text} (p. ej. un tipo de evento y un clientId). */
    Frame awaitBody(String text, long ms) throws InterruptedException {
        return await(f -> "MESSAGE".equals(f.command()) && f.body().contains(text), ms);
    }

    /** Espera hasta {@code ms} a que el servidor cierre la conexion. */
    boolean awaitClosed(long ms) throws InterruptedException {
        long until = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < until && !closed) {
            Thread.sleep(20);
        }
        return closed;
    }

    boolean isClosed() {
        return closed;
    }

    int closeCode() {
        return closeCode;
    }

    @Override
    public void close() {
        if (!closed) {
            try {
                socket.sendClose(WebSocket.NORMAL_CLOSURE, "fin").get(2, TimeUnit.SECONDS);
            } catch (Exception ignored) {
                // ya estaba cerrado
            }
        }
        socket.abort();
    }
}
