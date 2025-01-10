# Contributing Guide

## Project Management Process

### Feature Development Flow
1. Create project file in docs/projects/active/
2. Complete Initial Assessment checklist
3. Break into discrete tasks
4. Implement tasks systematically
5. Complete Pre-Submission checklist
6. Submit for review
7. Move to archive when complete

## When to Request Approval

### Data Model Changes
- New types or schemas
- Database schema changes
- New fields or relationships
- Changes to existing models

### Architecture Changes
- New patterns not in architecture.md
- New dependencies required
- Changes affecting multiple components
- New state management approaches

### Cross-Cutting Changes
- Changes to shared utilities
- Changes to core functionality
- Changes affecting multiple components
- Security-related changes

## Implementation Checklists

### Initial Assessment
- [ ] Review relevant documentation
- [ ] Identify affected components
- [ ] Check if data model changes needed
- [ ] Look for existing patterns
- [ ] Break into discrete tasks
- [ ] Flag architecture questions
- [ ] Request approval if needed

### Task Implementation
- [ ] Use correct types from shared package
- [ ] Verify imports resolve correctly
- [ ] Follow architectural patterns
- [ ] Keep changes minimal and focused
- [ ] Add/update tests
- [ ] Document new patterns

### Pre-Submission
- [ ] Changes follow architecture.md
- [ ] No unapproved schema changes
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated
- [ ] Tests added/updated

## Documentation Updates
1. Architecture Changes
   - Document new patterns
   - Update API documentation
   - Add migration notes
   - Document pattern deviations

2. Code Documentation
   - Clear type definitions
   - Interface documentation
   - API endpoint documentation
   - Updated examples

## Key Questions
Before submitting changes, ask:
1. "Is this change documented in architecture.md?"
2. "Am I only using shared package types?"
3. "Is this the smallest change that solves the problem?"
4. "Have I added any new patterns?"
5. "Does this need data model changes?"

## Debugging Guide

### 1. Reproduce the Issue
- Understand reported symptoms
- Replicate in controlled environment
- Document reproduction steps
- Identify minimal test case

### 2. Analyze the Problem
- Review relevant logs
- Check error messages
- Analyze stack traces
- Review recent changes

### 3. Implement and Test
- Create failing test
- Implement fix
- Verify fix works
- Add regression test

### 4. Document Resolution
- Update documentation
- Add code comments if needed
- Document root cause
- Note prevention measures