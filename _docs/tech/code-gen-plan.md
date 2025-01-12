# Code Generation Pipeline Plan

## Overview

This document outlines our approach to generating type-safe API code using a combination of Zod-first schema definitions, procedural generation for pattern-based code, and AI assistance for complex implementations.

## Generation Phases

### 1. Schema Definition & Type Generation
These steps establish our source of truth:

1. **Base Schema Definition**
   - Input: Manually written Zod schemas
   - Output: TypeScript types via `z.infer`
   ```typescript
   // Input (manual)
   export const HubSchema = z.object({
     id: z.string().min(1),
     name: z.string().min(1).max(100),
     description: z.string().max(1000)
   });
   
   // Generated
   export type Hub = z.infer<typeof HubSchema>;
   ```

2. **Pattern Schema Definition**
   - Input: Manually written pattern schemas (Pagination, Filtering, etc.)
   - Output: Composable schema patterns
   ```typescript
   // Input (manual)
   export const PaginationSchema = z.object({
     cursor: z.string().optional(),
     limit: z.number().min(1).max(100)
   });

   // Usage
   export const ListHubsSchema = z.object({})
     .merge(PaginationSchema)
     .merge(z.object({
       archived: z.boolean().optional()
     }));
   ```

3. **Route Type Generation**
   - Input: Request/Response schemas
   - Tool: Custom AST transformer
   - Output: Route type definitions
   ```typescript
   // Generated
   export interface ListHubsRoute {
     method: 'GET';
     path: '/hubs';
     query: z.infer<typeof ListHubsSchema>;
     response: z.infer<typeof ListHubsResponseSchema>;
     auth: true;
   }
   ```

4. **Client Method Generation**
   - Input: Route types
   - Tool: Custom code generator
   - Output: Type-safe API client methods
   ```typescript
   // Generated
   export class ApiClient {
     async listHubs(params: ListHubsQuery): Promise<Hub[]> {
       return this.get('/hubs', { params });
     }
   }
   ```

### 2. AI-Assisted Generation
These steps use Deepseek for complex logic. See [AI Prompts](./ai-prompts.md) for detailed prompts and examples.

1. **Repository Tests**
   - Input: Schema validations + Controller code
   - Output: Repository test suites
   - Why AI: Complex mock setups, edge cases, validation rules
   - Implementation: See repository test example in ai-prompts.md

2. **Controller Tests**
   - Input: Schemas + Controller code + routes
   - Output: Controller test suites
   - Why AI: HTTP lifecycle, auth flows, validation handling
   - Implementation: See controller test example in ai-prompts.md

3. **Business Logic**
   - Input: Schemas + Controller requirements
   - Output: Service implementations
   - Why AI: Complex workflows, validation rules, error handling
   - Implementation: See business logic example in ai-prompts.md

## Implementation

### Pipeline Configuration
```typescript
interface GenerationConfig {
  // Schema & type generation config
  schemas: {
    sourceDir: string;
    outputDirs: {
      types: string;
      routes: string;
      client: string;
    };
  };

  // AI-assisted generation config
  ai: {
    components: {
      name: string;
      sourceDir: string;
      targetDir: string;
      conversation: Conversation;
      examples: Example[];
    }[];
  };
}
```

### Execution Flow
```typescript
async function main() {
  // 1. Schema & Type Generation
  await generateTypes();
  await generateRouteTypes();
  await generateClient();
  
  // 2. AI-Assisted Generation
  for (const component of config.ai.components) {
    // Generate tests first
    const tests = await generateTests(component);
    await verifyTests(tests);
    
    // Generate implementation
    const impl = await generateImplementation(component, tests);
    await verifyImplementation(impl, tests);
    
    // Refine if needed
    if (needsRefinement(impl)) {
      await refineImplementation(impl, tests);
    }
  }
}

// Schema & type generation
async function generateTypes() {
  const schemas = await loadSchemas();
  for (const schema of schemas) {
    const types = generateTypesFromSchema(schema);
    await writeTypes(types);
  }
}

// AI-assisted generation
async function generateTests(component: Component) {
  const { schemas, sourceContent, examples } = await prepareContext(component);
  
  return generateCode({
    schemas,
    input: sourceContent,
    examples,
    conversation: component.conversation
  });
}

async function verifyImplementation(
  impl: string,
  tests: string
): Promise<boolean> {
  await writeTemp(impl, tests);
  return runTests();
}
```

### Development Workflow

1. **Setup Phase**
   - Define base Zod schemas
   - Create pattern schemas
   - Set up test infrastructure

2. **Generation Phase**
   - Generate types from schemas
   - Generate tests with AI
   - Generate implementations
   - Verify and refine

3. **Verification Phase**
   - Run all tests
   - Check type safety
   - Verify API contracts
   - Manual review

## Next Steps

1. Create base schemas
   - Domain types
   - Pattern schemas
   - Validation rules

2. Create AI examples
   - Repository test examples
   - Controller test examples
   - Business logic examples

3. Set up pipeline
   - Configuration
   - Test infrastructure
   - CI integration