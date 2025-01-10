# UI Patterns

## Component Architecture

### Base Components
- Built on shadcn/ui
- Consistent styling with TailwindCSS
- Accessible by default
- Type-safe props

### Feature Components
- Composed from base components
- Feature-specific logic
- Clear responsibility boundaries
- Reusable patterns

## Common Patterns

### Message Components
```tsx
interface MessageProps {
  content: string
  sender: User
  timestamp: number
  reactions: Reaction[]
  isEdited: boolean
  threadInfo?: ThreadInfo
}

const Message: React.FC<MessageProps> = ({
  content,
  sender,
  timestamp,
  reactions,
  isEdited,
  threadInfo
}) => {
  return (
    <div className="flex gap-3 p-2 hover:bg-slate-50">
      <Avatar user={sender} />
      <div className="flex-1">
        <MessageHeader
          sender={sender}
          timestamp={timestamp}
          isEdited={isEdited}
        />
        <MessageContent content={content} />
        <MessageActions message={message} />
        {reactions.length > 0 && (
          <MessageReactions reactions={reactions} />
        )}
        {threadInfo && <ThreadPreview {...threadInfo} />}
      </div>
    </div>
  );
};
```

### List Virtualization
```tsx
interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  height: number
  itemHeight: number
}

const VirtualList = <T,>({
  items,
  renderItem,
  height,
  itemHeight
}: VirtualListProps<T>) => {
  return (
    <div className="overflow-auto" style={{ height }}>
      {/* Virtualization logic */}
    </div>
  );
};
```

### Loading States
```tsx
const LoadingState: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => (
  <div className="flex items-center justify-center p-4">
    <Spinner className="mr-2" />
    <span>{message}</span>
  </div>
);
```

### Error Boundaries
```tsx
class FeatureErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorDisplay onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

## Layout Patterns

### Workspace Layout
```tsx
const WorkspaceLayout: React.FC<{ children: React.ReactNode }> = ({
  children
}) => (
  <div className="flex h-screen">
    <Sidebar />
    <main className="flex-1 overflow-hidden">
      <Header />
      <div className="h-[calc(100vh-4rem)] overflow-auto">
        {children}
      </div>
    </main>
  </div>
);
```

### Split Views
```tsx
const SplitView: React.FC<{
  primary: React.ReactNode
  secondary: React.ReactNode
  splitRatio?: number
}> = ({
  primary,
  secondary,
  splitRatio = 0.65
}) => (
  <div className="flex h-full">
    <div style={{ flex: splitRatio }}>
      {primary}
    </div>
    <Divider />
    <div style={{ flex: 1 - splitRatio }}>
      {secondary}
    </div>
  </div>
);
```

## Form Patterns

### Input Components
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  ...props
}) => (
  <div className="space-y-1">
    <Label htmlFor={props.id}>{label}</Label>
    <input
      className={cn(
        'w-full px-3 py-2 border rounded-md',
        error ? 'border-red-500' : 'border-gray-300'
      )}
      {...props}
    />
    {error ? (
      <span className="text-sm text-red-500">{error}</span>
    ) : hint ? (
      <span className="text-sm text-gray-500">{hint}</span>
    ) : null}
  </div>
);
```

### Form Validation
```tsx
interface FormState {
  values: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
}

const useForm = <T extends Record<string, any>>(config: {
  initialValues: T
  validate: (values: T) => Record<string, string>
  onSubmit: (values: T) => Promise<void>
}) => {
  // Form handling logic
};
```

## Best Practices

### 1. Component Design
- Single responsibility
- Proper prop typing
- Clear documentation
- Reusable patterns

### 2. Performance
- Proper memoization
- Lazy loading
- Code splitting
- Resource optimization

### 3. Accessibility
- Proper ARIA attributes
- Keyboard navigation
- Screen reader support
- Color contrast

### 4. Testing
- Component isolation
- User event testing
- Snapshot testing
- Visual regression