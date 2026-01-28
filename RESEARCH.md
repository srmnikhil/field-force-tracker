# Real-Time Location Tracking Architecture for Unolo

## Overview

Unolo’s Field Force Tracker currently relies on manual check-ins. To improve visibility and operational efficiency, the system needs **near real-time location tracking** of field employees, displayed live on a manager’s dashboard.

This document evaluates multiple real-time communication approaches, compares their trade-offs, and recommends an architecture that fits Unolo’s **scale, battery constraints, reliability needs, budget, and small engineering team**.

The goal is not to find a “perfect” solution, but a **practical, shippable one**.

---

## 1. Technology Comparison

### 1. WebSockets (Custom Realtime Service)

#### How it works

WebSockets create a persistent, bidirectional connection between the client and server. Once connected, both sides can push messages at any time.

#### Pros

- True real-time, low latency
- Bi-directional communication
- Good fit for chat or collaborative apps

#### Cons

- Persistent connections drain mobile battery
- Frequent disconnects on mobile networks
- Requires additional infrastructure (Redis, pub/sub, sticky sessions)
- Reconnect storms under poor network conditions
- High operational complexity for a small team

#### When to use

- Chat applications
- Multiplayer games
- Desktop-heavy environments
- When you have dedicated infra/DevOps support

---

### 2. Server-Sent Events (SSE)

#### How it works

SSE provides a one-way streaming connection from server to client over HTTP. The server pushes updates; clients automatically reconnect.

#### Pros

- Simpler than WebSockets
- Automatic reconnect support
- Good for live dashboards

#### Cons

- One-way only (client → server still needs HTTP)
- Limited mobile and browser support
- Not ideal for high-frequency mobile telemetry
- Does not solve ingestion at scale

#### When to use

- Monitoring dashboards
- Notifications
- Admin panels with low-frequency updates

---

### 3. Long Polling

#### How it works

Clients repeatedly make HTTP requests asking for updates. The server holds the request open until data is available.

#### Pros

- Works everywhere
- Simple to implement

#### Cons

- Inefficient
- High server load
- Poor battery performance
- High latency compared to other approaches

#### When to use

- Legacy systems
- Very low traffic applications

---

### 4. HTTP/2 Push

#### How it works

Servers proactively push resources to clients over HTTP/2.

#### Pros

- Reduced latency for static resources

#### Cons

- Deprecated in modern browsers
- Not designed for realtime data streams
- Poor fit for telemetry or tracking

#### When to use

- Not recommended for realtime location tracking

---

### 5. gRPC over HTTP/2

#### How it works

gRPC uses binary-encoded messages over HTTP/2 with strongly typed contracts defined using Protocol Buffers.

#### Pros

- High performance
- Efficient payload size
- Built-in streaming support
- Strong service contracts

#### Cons

- Poor browser support (requires gRPC-Web)
- Higher tooling and learning overhead
- Harder debugging compared to JSON
- Overkill for current scale

#### When to use

- Internal microservice communication
- Large systems with many backend services
- Performance-critical internal APIs

---

### 6. Event Streaming (Kafka / Cloud PubSub)

#### How it works

Producers publish events to a stream. Multiple consumers independently process those events.

#### Pros

- Massive scalability
- Decoupled architecture
- Replayability
- Durable event storage

#### Cons

- Significant operational complexity
- Requires infra expertise
- Overkill for a single producer–consumer flow
- Higher cost and maintenance burden

#### When to use

- Very high event volume
- Multiple downstream consumers (analytics, ML, alerts)
- Large engineering teams

---

### 7. Managed Realtime Services (Firebase / Ably / Pusher)

#### How it works

The backend publishes events to a managed realtime service. Dashboards subscribe to channels and receive updates instantly. The service manages connections, retries, and fan-out.

#### Pros

- Fast to implement
- Handles scaling and reconnects
- Mobile-friendly
- No need to manage WebSocket infrastructure
- SDKs for web and mobile

#### Cons

- Ongoing usage cost
- Vendor lock-in
- Less low-level control

#### When to use

- Startups
- Small teams
- Realtime features with limited infra capacity

---

## Top 3 Most Viable Approaches

1. **HTTP ingestion + Managed Realtime Service (Firebase / Ably / Pusher)**
2. **Custom WebSockets with Redis pub/sub**
3. **Kafka / PubSub + Realtime Layer**

Among these, the first is the most practical for Unolo today.

---

## 2. Recommendation

### Recommended Architecture

**HTTP ingestion for mobile → backend-controlled fan-out using a managed realtime service**

#### Why this fits Unolo

- **Scale:**  
  10,000 employees × 2 updates/min ≈ 20,000 updates/min  
  Stateless HTTP endpoints scale horizontally without persistent connections.

- **Battery:**  
  Periodic HTTP requests are far more battery-efficient than always-on sockets.

- **Reliability:**  
  HTTP works well on flaky networks; managed realtime services handle reconnects.

- **Cost:**  
  No need to run and maintain WebSocket clusters or Kafka infrastructure.

- **Development time:**  
  Small team can ship quickly using existing SDKs and simple REST APIs.

This approach trades low-level control for speed, reliability, and simplicity — a good trade for a startup.

---

## 3. Trade-offs

### What we sacrifice

- Full control over realtime infrastructure
- Dependency on a third-party service
- Higher cost at very large scale

### What would make us reconsider

- Realtime costs exceeding acceptable limits
- Need for replayable event streams
- Multiple internal consumers (analytics, alerts, ML)

### Where this approach breaks down

- 100,000+ active users with high-frequency updates
- Millions of events per hour
- Requirement for complex internal event processing

At that point, Kafka or custom infrastructure becomes justified.

---

## 4. High-Level Implementation

### Backend

- Add `POST /api/location/update`
- Authenticate and validate requests
- Accept updates only during active check-ins
- Update latest location (overwrite, not insert)
- Publish updates to realtime channels

### Mobile / Frontend

- Send location updates every 30 seconds (adaptive if needed)
- Pause tracking when no active check-in
- Manager dashboard subscribes to realtime updates
- Update map UI on incoming events

### Database

- Store only the **latest location** per employee for live tracking
- Sample or aggregate historical data (not every update)
- Persist check-in/check-out events as the source of truth

### Infrastructure

- Existing REST backend
- Managed realtime service (Firebase / Ably / Pusher)
- Standard database (SQLite now, PostgreSQL later)

---

## Conclusion

There is no single “best” real-time architecture — only the **best decision given current constraints**.

For Unolo’s scale, budget, and team size, **HTTP ingestion combined with a managed realtime fan-out service** provides the best balance of reliability, battery efficiency, cost, and speed of development, while leaving room to evolve as the system grows.
