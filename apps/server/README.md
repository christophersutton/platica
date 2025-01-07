# @platica/server

The backend server for Platica, providing REST API and WebSocket functionality.

## Features

- REST API for chat functionality
- Real-time WebSocket communication
- SQLite database integration
- Authentication and authorization
- Rate limiting

## Development

1. Install dependencies:
```bash
bun install
```

2. Set up the database:
```bash
bun db:setup
bun db:seed  # Optional: Add sample data
```

3. Start the development server:
```bash
bun dev
```

## Available Scripts

- `bun dev` - Start the server in development mode
- `bun build` - Build for production
- `bun db:setup` - Set up the database schema
- `bun db:seed` - Seed the database with sample data
- `bun test` - Run tests

## Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update the variables in `.env` with your desired values

## API Documentation

[Add API documentation or link to it]
