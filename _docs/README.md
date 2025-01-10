# Platica Documentation

## Overview
This directory contains the complete technical documentation for Platica, a next-generation workplace communication platform focused on transparency and collective intelligence.

## Core Documents

### Vision and Concepts
- [Manifesto](./product/manifesto.md) - Core vision and philosophy
- [Concept Summary](./product/concept-summary.md) - Key features and concepts
- [Key Examples](./product/key-examples.md) - Usage examples and patterns

### Technical Documentation
- [Architecture](./tech/architecture.md) - System architecture and design patterns
- [Database](./tech/database.md) - System architecture and design patterns
- [Architecture](./tech/frontend-architecture.md) - System architecture and design patterns


## Key Concepts Quick Reference

### Communication Spaces
- **Channels**: Public, persistent knowledge streams
- **Rooms**: Time-boxed collaborative environments
- **Chats**: Ephemeral direct communication

### Artifacts
- **Minutes**: Automated summaries of channel activity or meetings
- **Memos**: Permanent knowledge documents
- **Bulletins**: Official announcements

### Roles
- **Administrators**: Platform governance
- **Moderators**: Channel management
- **Members**: Regular users
- **Secretaries**: AI assistants

## Development Guidelines

### Technology Stack
- **Backend**: Bun + SQLite + Litestream
- **Frontend**: React + TailwindUI + shadcn
- **API**: REST + WebSocket
- **Storage**: S3-compatible

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start development server:
   ```bash
   bun dev
   ```

For detailed technical information, see [architecture.md](./architecture.md).

For project vision and examples, start with the [Manifesto](./manifesto.md). 