# Diagramas UML

Los diagramas están en Mermaid: GitHub los dibuja solos, y para el documento en LaTeX
se exportan con `npx @mermaid-js/mermaid-cli -i docs/DIAGRAMAS.md -o diagrama.png`
(o desde https://mermaid.live).

## 1. Contexto

```mermaid
flowchart LR
  J([Jugador<br/>navegador o celular]) -- HTTPS / WebSocket STOMP --> S[Operación Garavito]
  E([Equipo de desarrollo]) -- push / PR --> GH[GitHub Actions]
  GH -- análisis --> SQ[SonarQube]
  GH -- despliegue CDK --> S
  O([Operador]) -- tableros y alertas --> G[Grafana]
  S -- métricas --> G
  P([Profesor / k6]) -- carga, estrés, picos --> S
```

## 2. Componentes

```mermaid
flowchart TB
  subgraph Frontend [Frontend React + Phaser]
    UI[Componentes React<br/>menús, HUD, minijuegos]
    ESC[MainScene Phaser<br/>mapa, jugadores, zombis]
    SYNC[gameSync / socketService<br/>STOMP sobre SockJS]
    UI --> SYNC
    ESC --> SYNC
  end
  subgraph Backend [Nodo backend Spring Boot]
    CTRL[GameController<br/>@MessageMapping]
    SEG[security: StompGuard, LimiteSalas,<br/>OrigenVerificado, ApiRateLimit]
    SVC[GameSessionService<br/>salas, tick, difusión]
    SES[GameSession<br/>reglas autoritativas]
    WAVE[WaveDirector, MissionBoard,<br/>AStarPathfinder, BossZombie]
    HIST[MatchHistoryService<br/>RankingController]
    REG[RoomRegistry<br/>InMemory / Redis]
    SEG --> CTRL --> SVC --> SES --> WAVE
    SVC --> REG
    SES --> HIST
  end
  SYNC -- /app/game/** --> SEG
  SVC -- /topic/game/sala --> SYNC
  HIST --> DB[(PostgreSQL)]
  REG --> R[(Redis)]
  PROM[Prometheus] -- /actuator/prometheus --> Backend
  GRAF[Grafana] --> PROM
```

## 3. Clases (núcleo del juego)

```mermaid
classDiagram
  class GameSessionService {
    -Map~String,GameSession~ sessions
    +create(code, building, mode) GameSession
    +createWithServerCode(building, mode) String
    +find(code) GameSession
    +seatRole(gameId, connectionId) String
    +broadcast(gameId, session, event)
    +reply(connectionId, event)
  }
  class GameSession {
    -Map~String,Player~ players
    -Map~String,String~ claimedItems
    -List~FloorGrid~ floors
    +joinPlayer(role, token) String
    +start(playerId) boolean
    +reportPosition(playerId, floor, x, y) boolean
    +attemptAttack(...) AttackResult
    +attemptPickup(...) PickupResult
    +attemptToggleDoor(...) DoorToggleResult
    +attemptTransfer(...) PlayerActionResult
    +tick(now, delta)
  }
  class Player {
    -String role
    -double x, y
    -int health, garavitos
    -List~InventorySlot~ inventory
    +tryTakeGaravitos(amount) boolean
    +tryAddItem(slot) boolean
  }
  class FloorGrid {
    +isWalkable(x, y) boolean
    +hasLineOfSight(...) boolean
    +setDoorOpen(doorId, open)
    +walkableSnapshot() boolean[][]
  }
  class WaveDirector
  class MissionBoard {
    +complete(role, missionId) boolean
    +allDone() boolean
  }
  class Zombie
  class BossZombie
  class AStarPathfinder
  class RoomRegistry {
    <<interface>>
    +claim(code, nodeUrl) boolean
    +ownerOf(code) String
  }
  GameSessionService "1" --> "*" GameSession
  GameSessionService --> RoomRegistry
  GameSession "1" --> "1..4" Player
  GameSession "1" --> "2..3" FloorGrid
  GameSession --> WaveDirector
  GameSession --> MissionBoard
  WaveDirector --> "*" Zombie
  BossZombie --|> Zombie
  Zombie ..> AStarPathfinder
  RoomRegistry <|.. InMemoryRoomRegistry
  RoomRegistry <|.. RedisRoomRegistry
```

## 4. Entidad–Relación

```mermaid
erDiagram
  MATCH_RECORD ||--|{ MATCH_PLAYER : tiene
  MATCH_RECORD {
    bigint id PK
    varchar building
    boolean victory
    int kinder_reached
    bigint duration_seconds
    int player_count
    timestamp played_at
    varchar mode
  }
  MATCH_PLAYER {
    bigint id PK
    bigint match_id FK
    varchar role
    varchar player_name
    int kills
    int missions
    int garavitos_earned
    int damage_taken
  }
```

Migraciones Flyway: `backend/src/main/resources/db/migration/V1..V4`. El estado de
las partidas en curso no está en la base: vive en la memoria del nodo.

## 5. Secuencia: crear sala, unirse y moverse

```mermaid
sequenceDiagram
  autonumber
  actor A as Anfitrión
  actor B as Invitado
  participant CF as CloudFront
  participant LB as ALB
  participant N1 as Nodo 1
  participant N2 as Nodo 2
  participant R as Redis
  A->>CF: WebSocket /ws
  CF->>LB: /ws
  LB->>N1: conexión
  A->>N1: SEND /app/game/create
  N1->>R: SETNX sala → /n1
  N1-->>A: LOBBY_CREATED (código)
  A->>N1: SEND /join (rol, token)
  B->>CF: WebSocket /ws
  CF->>LB: /ws
  LB->>N2: conexión
  B->>N2: SEND /lobby (código)
  N2->>R: GET sala
  R-->>N2: /n1
  N2-->>B: LOBBY_REDIRECT /n1
  B->>CF: WebSocket /n1/ws
  CF->>N1: /ws (CloudFront quita /n1)
  B->>N1: SEND /join
  A->>N1: SEND /start
  loop cada 100 ms por jugador
    B->>N1: SEND /move (x, y)
    N1->>N1: valida velocidad y paredes (synchronized)
  end
  loop tick cada 66 ms
    N1->>N1: zombis (A*), oleadas, misiones
    N1-->>A: /topic/game/sala (estado o delta)
    N1-->>B: /topic/game/sala (estado o delta)
  end
```

## 6. Despliegue (AWS, stack `OperacionGaravitoDistribuido`)

```mermaid
flowchart TB
  U([Navegador]) -->|HTTPS| CF[CloudFront<br/>global]
  CF -->|/*| S3[(S3<br/>frontend)]
  CF -->|/ws, /api| ALB[Application Load Balancer<br/>us-east-2a y 2b]
  CF -->|/n1/*| N1
  CF -->|/n2/*| N2
  CF -->|/grafana/*| MON
  subgraph AZa [Zona us-east-2a]
    N1[EC2 t4g.small<br/>nodo-1 · Java 21]
    MON[EC2 t4g.small<br/>Prometheus + Grafana]
  end
  subgraph AZb [Zona us-east-2b]
    N2[EC2 t4g.small<br/>nodo-2 · Java 21]
  end
  ALB --> N1
  ALB --> N2
  N1 --> RDS[(RDS PostgreSQL 16<br/>db.t4g.micro)]
  N2 --> RDS
  N1 --> EC[(ElastiCache Redis<br/>cache.t4g.micro)]
  N2 --> EC
  MON -->|:9091 actuator| N1
  MON -->|:9091 actuator| N2
  SM[Secrets Manager] -.credenciales.-> N1
  SM -.credenciales.-> N2
```

## 7. Actividades: un Kinder

```mermaid
flowchart TD
  I([Empieza el Kinder]) --> R[Respiro: el servidor reparte 3 misiones por jugador<br/>y ofrece mejoras]
  R --> O[Oleada: zombis desde todos lados]
  O --> D{¿Jugador mordido<br/>hasta 0?}
  D -- sí --> C[Cae] --> RV{¿Biomédica lo revive?}
  RV -- sí --> O
  RV -- no --> T{¿Todo el equipo caído?}
  T -- sí --> F([Fin: derrota, se guarda en el historial])
  T -- no --> O
  D -- no --> M[Completa misiones y mata zombis]
  M --> B{¿Cuota de zombis y<br/>todas las misiones de los vivos?}
  B -- no --> O
  B -- sí --> K{¿Era el Kinder 5?}
  K -- no --> I
  K -- sí --> E[Escape: llegar a la salida] --> V([Fin: victoria, ranking])
```
