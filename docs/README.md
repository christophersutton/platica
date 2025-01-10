# Platica Documentation

Welcome to the Platica documentation. This documentation is organized into three main sections to help you find the information you need.

## Documentation Structure

### 📘 Product Documentation
- Vision and concepts
- Feature explanations
- User guides
- Best practices

### 🏗 Architecture
- System overview
- Data flow
- Infrastructure
- Deployment

### 💻 Technical Reference
- API documentation
- Database schemas
- Frontend architecture
- Feature implementations

## Quick Start

1. For product understanding, start with [product/manifesto.md](./product/manifesto.md)
2. For system architecture, see [architecture/system-overview.md](./architecture/system-overview.md)
3. For implementation details, check [technical/](./technical/)

## Development Setup

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Start development server
bun dev
```

## Documentation Guidelines

When contributing to the documentation:

1. Maintain the three-tier structure (Product → Architecture → Technical)
2. Keep cross-references up to date
3. Include diagrams for complex concepts
4. Provide practical examples
5. Keep code samples current with the codebase