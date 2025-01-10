# Platica

A modern real-time chat application built with Bun, TypeScript, and React.

## Prerequisites

- [Bun](https://bun.sh) (v1.0.30 or later)
- Node.js 18+ (for some development tools)
- SQLite 3.35.0+ (included with Bun)
- S3-compatible storage (for file uploads)

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd platica
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
bun db:setup  # Creates and sets up the database
bun db:seed   # (Optional) Seeds the database with sample data
```

5. Start development servers:
```bash
bun dev
```

The application will be available at:
- Web: http://localhost:3000
- API: http://localhost:8000

## Development

### Available Scripts

- `bun dev` - Start all applications in development mode
- `bun build` - Build all applications for production
- `bun test` - Run tests
- `bun lint` - Run ESLint
- `bun format` - Format code with Prettier
- `bun db:setup` - Set up database
- `bun db:seed` - Seed database with sample data
- `bun clean` - Clean build artifacts

### Project Structure

```
platica/
├── apps/
│   ├── server/     # Bun backend
│   └── web/        # React frontend
├── packages/
│   └── shared/     # Shared code
└── docs/          # Documentation
```

### Documentation

- [Architecture Overview](_docs/architecture.md)
- [Database Documentation](_docs/database.md)
- [Development Guidelines](_docs/instructions.md)

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

[MIT License](LICENSE)