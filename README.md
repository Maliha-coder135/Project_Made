# Real-Time Chat Application with Redis Cluster
### PDC Project 6B — Parallel & Distributed Computing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSERS                             │
│              (Socket.IO WebSocket connections)                       │
└────────────────────┬────────────────────────────────────────────────┘
                     │ WebSocket / HTTP
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NGINX LOAD BALANCER                             │
│              (ip_hash sticky sessions for WebSockets)               │
└──────────┬──────────────────────────────────────┬───────────────────┘
           │                                      │
           ▼                                      ▼
┌──────────────────────┐              ┌──────────────────────┐
│   Chat Server #1     │              │   Chat Server #2     │
│   Node.js/Express    │              │   Node.js/Express    │
│   Socket.IO          │              │   Socket.IO          │
│   Port 3000          │              │   Port 3001          │
└──────────┬───────────┘              └──────────┬───────────┘
           │    Socket.IO Redis Adapter           │
           │    (Pub/Sub across servers)          │
           └──────────────┬───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      REDIS CLUSTER                                  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  Master #1  │  │  Master #2  │  │  Master #3  │                │
│  │  Port 7001  │  │  Port 7002  │  │  Port 7003  │                │
│  │  Slots 0-   │  │  Slots 5461-│  │  Slots 10922│                │
│  │  5460       │  │  10921      │  │  -16383     │                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                │
│         │                │                │                         │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐                │
│  │ Replica #1  │  │ Replica #2  │  │ Replica #3  │                │
│  │  Port 7004  │  │  Port 7005  │  │  Port 7006  │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
│  16,384 hash slots distributed across 3 masters                    │
│  1 replica per master (automatic failover)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How Redis Cluster Enables Scalability

### The Problem Without Redis
When you run two Chat Server instances, each has its **own in-memory Socket.IO store**. A user on Server #1 sends a message — Server #2 users **never receive it** because the servers don't communicate.

### The Solution: Redis Pub/Sub Adapter
`@socket.io/redis-adapter` makes all server instances share one Pub/Sub channel via Redis:

```
Server #1 emits event → Redis Pub/Sub → Server #2 receives → forwards to its clients
                                       → Server #3 receives → forwards to its clients
```

### Redis Cluster = Distributed Data
The Redis Cluster shards data across 3 masters using **consistent hashing** (16,384 slots):
- `chat:room:general:messages` → hashed to Master #2 (e.g., slot 7200)
- `chat:room:tech:messages` → hashed to Master #1 (e.g., slot 3100)
- `chat:stats:global` → hashed to Master #3 (e.g., slot 11000)

This gives us **horizontal scalability**, **fault tolerance** (replicas), and **no single point of failure**.

---

## Quick Start

### Option A: No Redis (Simplest — In-Memory Only)

```bash
npm install
npm start
# Open http://localhost:3000
```
⚠️ Messages don't persist and multi-server scaling is disabled.

---

### Option B: Docker Compose (Full Redis Cluster)

#### Prerequisites
- Docker Desktop installed and running

```bash
# 1. Start the full stack
docker compose up -d

# 2. Wait ~10 seconds for the cluster to form
docker logs redis-cluster-init

# 3. Open the app
open http://localhost      # Through Nginx load balancer
open http://localhost:3000  # Direct to server #1
open http://localhost:3001  # Direct to server #2
```

#### Verify the cluster formed
```bash
docker exec redis-node-1 redis-cli -p 7001 cluster info
# cluster_state:ok  ← must see this
# cluster_slots_assigned:16384
# cluster_known_nodes:6
```

---

### Option C: Local Redis Cluster (Manual)

```bash
# Install Redis
brew install redis   # macOS
sudo apt install redis  # Ubuntu

# Create 6 node configs
mkdir -p /tmp/redis-cluster
for port in 7001 7002 7003 7004 7005 7006; do
  mkdir -p /tmp/redis-cluster/$port
  cat > /tmp/redis-cluster/$port/redis.conf <<EOF
port $port
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
appendonly yes
bind 127.0.0.1
protected-mode no
EOF
done

# Start 6 Redis instances
for port in 7001 7002 7003 7004 7005 7006; do
  redis-server /tmp/redis-cluster/$port/redis.conf --daemonize yes --logfile /tmp/redis-cluster/$port/redis.log
done

# Form the cluster (3 masters + 1 replica each)
redis-cli --cluster create \
  127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003 \
  127.0.0.1:7004 127.0.0.1:7005 127.0.0.1:7006 \
  --cluster-replicas 1 --cluster-yes

# Verify
redis-cli -p 7001 cluster nodes

# Run server with cluster mode
USE_CLUSTER=true npm start
```

---

## Multi-Server Scaling Demo

Open **two terminals** and run two server instances:

```bash
# Terminal 1
PORT=3000 USE_CLUSTER=true node server/server.js

# Terminal 2
PORT=3001 USE_CLUSTER=true node server/server.js
```

Open two browser tabs:
- Tab 1: `http://localhost:3000`
- Tab 2: `http://localhost:3001`

Type in one tab → message appears in the other. ✅
This confirms Redis Pub/Sub is distributing events across server instances.

---

## Scalability Testing

### Run the Load Test

```bash
# Install test dependencies
npm install --save-dev socket.io-client

# Basic test: 50 clients, 5 messages each
node tests/scalability_test.js

# Heavy load: 200 clients, 10 messages each
node tests/scalability_test.js --clients 200 --messages 10

# Test against load balancer
node tests/scalability_test.js --url http://localhost --clients 100 --messages 5

# Slow ramp-up (for latency measurement)
node tests/scalability_test.js --clients 100 --ramp 200
```

### What the Test Measures

| Metric | Description |
|--------|-------------|
| **Connection Time** | How long WebSocket handshake takes (avg, P95) |
| **Throughput** | Messages delivered per second |
| **Delivery Rate** | % of messages successfully received |
| **Latency** | Round-trip time from send → receive (P50, P95, P99) |
| **Error Rate** | Failed connections or dropped messages |

### Expected Results

| Scenario | Clients | Expected Throughput | P95 Latency |
|----------|---------|---------------------|-------------|
| Single server, no Redis | 50 | 200–500 msg/s | < 20ms |
| Single server + Redis | 50 | 150–400 msg/s | < 30ms |
| 2 servers + Redis Cluster | 100 | 300–800 msg/s | < 50ms |
| 2 servers + Redis Cluster | 500 | 500–1500 msg/s | < 100ms |

---

## Key Files

```
chat-app/
├── server/
│   └── server.js          # Main server: Express + Socket.IO + Redis adapter
├── client/
│   └── index.html         # Full chat UI (single file, no build step)
├── redis-config/
│   ├── redis-node.conf    # Redis cluster node configuration
│   └── nginx.conf         # Load balancer with sticky sessions
├── tests/
│   └── scalability_test.js # Concurrent load testing suite
├── docker-compose.yml     # Full stack: 6 Redis nodes + 2 chat servers + Nginx
├── Dockerfile             # Chat server container
└── package.json
```

---

## Distributed Computing Concepts Demonstrated

### 1. Horizontal Scaling
Multiple stateless server instances behind a load balancer. State is externalized to Redis.

### 2. Pub/Sub Messaging Pattern
Redis Pub/Sub decouples message producers (servers receiving WebSocket events) from consumers (servers broadcasting to their connected clients).

### 3. Consistent Hashing
Redis Cluster distributes 16,384 hash slots across nodes. Keys are deterministically mapped using CRC16. Adding a node redistributes only some slots (minimal data movement).

### 4. Replication & Fault Tolerance
Each master has one replica. If a master fails, the replica is automatically promoted (automatic failover in ~5 seconds defined by `cluster-node-timeout`).

### 5. CAP Theorem Trade-off
Redis Cluster prioritizes **Consistency** and **Partition Tolerance** (CP):
- During network partition, some slots may be unavailable
- Redis does not sacrifice consistency for availability
- This is appropriate for chat (no silent message loss)

### 6. Sticky Sessions
Nginx uses `ip_hash` to route the same client to the same server. This is required because Socket.IO's polling fallback needs session affinity. WebSocket upgrades make this less critical.

---

## Monitoring

### Redis Insight (GUI)
If using Docker Compose, open http://localhost:8001 for Redis Insight GUI.
Add a cluster connection pointing to `redis-node-1:7001`.

### Redis CLI Monitoring
```bash
# Watch all commands in real time
redis-cli -p 7001 monitor

# Cluster health
redis-cli -p 7001 cluster info

# Slot distribution
redis-cli -p 7001 cluster nodes

# Memory usage
redis-cli -p 7001 info memory
```

### App Health Endpoint
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/stats
```

---

## Troubleshooting

**"CLUSTERDOWN: Hash slot not served"**
→ The cluster hasn't finished forming. Wait 10s and retry.

**Messages not crossing servers**
→ Confirm `USE_CLUSTER=true` or Redis is running. Check `/api/health` for `redisAvailable: true`.

**WebSocket upgrade fails behind Nginx**
→ Ensure the `Upgrade` and `Connection` headers are set in nginx.conf (already configured).

**Port conflicts**
→ Change ports in `docker-compose.yml` or via environment variables.
