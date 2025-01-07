platica/
├── README.md
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   │   ├── common/     # Basic components like buttons, inputs
│   │   │   │   ├── chat/       # Chat-specific components
│   │   │   │   ├── workspace/  # Workspace management components
│   │   │   │   └── settings/   # Settings and profile components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── contexts/      # React context providers
│   │   │   ├── services/      # API client services
│   │   │   ├── utils/         # Helper functions
│   │   │   ├── types/         # TypeScript type definitions
│   │   │   └── pages/         # Page components
│   │   └── public/            # Static assets
│   └── server/                # Bun backend
│       ├── src/
│       │   ├── services/      # Core services
│       │   │   ├── auth/      # Authentication service
│       │   │   ├── read/      # Read service
│       │   │   ├── write/     # Write service
│       │   │   ├── search/    # Search service
│       │   │   └── websocket/ # WebSocket service
│       │   ├── middleware/    # Shared middleware
│       │   ├── repositories/  # Data access layer
│       │   ├── utils/         # Helper functions
│       │   └── types/         # TypeScript type definitions
│       └── scripts/           # Database migrations, etc.
├── packages/                  # Shared packages
│   ├── tsconfig/             # Shared TypeScript configs
│   ├── eslint-config/        # Shared ESLint configs
│   └── shared/               # Shared code, types, and constants
│       ├── src/
│       │   ├── types/        # Shared TypeScript interfaces
│       │   └── constants/    # Shared constants
│       └── package.json
└── scripts/                  # Development and deployment scripts