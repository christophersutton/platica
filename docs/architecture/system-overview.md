# Platica System Overview

## System Architecture

### Core Components
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │   API Server    │     │    Database     │
│   React + TW    │────▶│    Bun + Elysia │────▶│     SQLite     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │                       │
        │                        │                       │
        │                ┌───────▼──────┐        ┌──────▼─────┐
        └───────────────▶│  WebSocket   │        │  Litestream │
                        │    Server     │        │ Replication │
                        └──────────────┘         └────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Bun
- **Database**: SQLite
- **Replication**: Litestream
- **Storage**: S3-compatible

### Frontend
- **Framework**: React
- **UI**: TailwindUI + shadcn
- **State**: React Query + Context
- **Real-time**: WebSocket

## Key System Features

### Real-time Communication
- WebSocket-based message delivery
- Presence management
- Typing indicators
- Room state synchronization

### Data Persistence
- SQLite for primary storage
- Litestream for replication
- S3 for file storage
- Optimized query patterns

### Authentication & Security
- Magic link authentication
- Role-based access control
- End-to-end encryption (planned)
- Audit logging

## System Boundaries

### Client Boundary
- React application
- WebSocket connection
- Local state management
- File upload/download

### Server Boundary
- HTTP API endpoints
- WebSocket handlers
- Database operations
- File storage operations

### Storage Boundary
- SQLite database
- S3 bucket
- Backup replicas
- CDN (planned)

## For More Details

- [API Reference](../technical/api/)
- [Database Architecture](../technical/database/)
- [Frontend Architecture](../technical/frontend/)
- [Deployment Guide](./deployment.md)