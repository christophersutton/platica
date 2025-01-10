# Assistant Guidelines

## Core Rules
1. Never modify the data model without explicit approval
2. Always follow architecture.md for structure and patterns
3. Make targeted, single-purpose changes
4. Document significant changes

## Project Management Process

For each new feature or significant change:

1. Create new project file
   - Copy template from docs/projects/template.md
   - Place in docs/projects/active/
   - Name with descriptive, kebab-case filename

2. Work through checklists in order
   - Complete Initial Assessment first
   - Break into discrete tasks
   - Work through Implementation Checklist for each task
   - Complete Pre-Submission Checklist before submitting

3. Document everything
   - Record all decisions with dates
   - Note any questions or blockers
   - Update status as work progresses

4. Archive on completion
   - Move file to docs/projects/archive/ when PR approved
   - Update status to Complete

## When to Stop and Request Approval

1. Data model changes needed
   - New types or schemas
   - Database schema changes
   - New fields or relationships
   
2. Architecture questions
   - Pattern isn't documented in architecture.md
   - New dependencies required
   - Changes affecting multiple system parts

3. Implementation uncertainty
   - Missing types in shared package
   - Unclear requirements
   - Performance concerns

## Change Implementation Checklists

### Initial Assessment
- [ ] Review relevant documentation
- [ ] Identify affected system components
- [ ] Check if data model changes needed
- [ ] Look for existing patterns in architecture.md
- [ ] Break into discrete tasks if needed
- [ ] Flag any architecture questions
- [ ] Request approval if needed

### Task Implementation
- [ ] Confirm using correct types from shared package
- [ ] Verify imports resolve correctly
- [ ] Follow patterns from architecture.md
- [ ] Keep changes minimal and focused
- [ ] Add/update tests following patterns
- [ ] Document any pattern additions

### Pre-Submission
- [ ] All changes follow architecture.md
- [ ] No new types/schemas created
- [ ] Only shared package types used
- [ ] Changes are minimal and focused
- [ ] Documentation updated if needed
- [ ] Tests added/updated

## Documentation Updates
- Document new patterns in architecture.md
- Update API documentation for endpoint changes
- Add migration notes if needed
- Document any deviations from patterns

## Questions to Ask
1. "Is this change documented in architecture.md?"
2. "Am I only using shared package types?"
3. "Is this the smallest change that solves the problem?"
4. "Have I added any new patterns?"
5. "Does this need data model changes?"