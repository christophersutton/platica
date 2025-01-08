# Platica

A modern real-time chat application built with Bun, TypeScript, and React.

## Prerequisites

- [Bun](https://bun.sh) (v1.0.30 or later)

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd platica
```

2. Install dependencies:
```bash
bun install
```

3. Set up the database:
```bash
bun db:setup  # Creates and sets up the database
bun db:seed   # (Optional) Seeds the database with sample data
```

4. Start the development servers:
```bash
bun dev
```

This will start both the web and server applications in development mode.

## Available Scripts

- `bun dev` - Start all applications in development mode
- `bun build` - Build all applications for production
- `bun lint` - Run ESLint on all TypeScript/TSX files
- `bun format` - Format all TypeScript/TSX/MD files with Prettier
- `bun clean` - Remove all node_modules directories
- `bun db:setup` - Set up the database
- `bun db:seed` - Seed the database with sample data

## Project Structure

- `/apps`
  - `/server` - Backend API server
  - `/web` - Frontend web application
- `/packages`
  - `/shared` - Shared types and utilities
- `/docs` - Project documentation
- `/scripts` - Utility scripts

## Development

Each application can be run independently using their respective package scripts. See the README in each app directory for more details.

## License

[Add your license here]