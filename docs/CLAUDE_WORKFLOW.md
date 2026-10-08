# Claude Workflow for Small Marketplace CDP

This document defines the workflow patterns and conventions for implementing the Small Marketplace CDP using Claude Code.

## Overview

This workflow defines how to approach development of the Small Marketplace CDP platform using Claude Code. It emphasizes:
- Incremental development (Phase-based approach)
- Security and privacy as core principles
- Test-driven development
- Continuous integration and delivery

## Development Workflow

### Phase-Based Approach

The platform is developed in phases:

**Phase 0: Foundation**
- Repository setup and structure
- Event schema package
- Docker Compose setup
- Database migrations
- Health checks
- Quality gates

**Phase 1: Core API Layer**
- Event ingestion API
- Data pipeline
- Database indexing

**Phase 2: Control Plane**
- Tenant management
- User & workspace management
- Analytics dashboard

**Phase 3: CRM & Engagement**
- Contact management
- Campaign management
- Personalization

**Phase 4: Advanced Features**
- Integrations
- Advanced analytics
- Performance & scaling

**Phase 5: Security & Compliance**
- Security enhancements
- Privacy controls
- Compliance

### Development Process

1. **Read CLAUDE.md**: Always read CLAUDE.md first as the engineering contract
2. **Explore**: Use targeted searches instead of dumping entire files
3. **Implement**: Build one feature at a time, thoroughly tested
4. **Validate**: Run tests before committing changes
5. **Document**: Document decisions and implementation details

## Claude Code Tools Usage

### Reading Files
```bash
# Use Read for single files
Read /path/to/file

# Use Bash for directory exploration
Bash "find /path -name \"*.ts\" -type f"

# Use Explore for broad searches
Agent "Explore: Search for event handling code in the repository"
```

### File Operations
```bash
# Use Write for creating new files
Write /path/to/file "content"

# Use Edit for modifying existing files
Edit /path/to/file "old text" "new text"

# Use Bash for complex operations
Bash "sed -i 's/old/new/g' /path/to/file"
```

### Testing
```bash
# Run tests for a package
Bash "npm run test --workspaces --if-present"

# Type check
Bash "npm run typecheck --workspaces --if-present"

# Lint
Bash "npm run lint --workspaces --if-present"
```

## Code Review Process

### Pre-Implementation Review
1. **Architecture Review**: Ensure implementation matches architecture
2. **Security Review**: Check for security vulnerabilities
3. **Performance Review**: Consider performance implications
4. **Test Review**: Ensure comprehensive test coverage

### Post-Implementation Review
1. **Functionality Review**: Verify functionality works as expected
2. **Integration Review**: Ensure proper integration with other components
3. **Documentation Review**: Check documentation completeness
4. **Code Quality Review**: Review code quality and maintainability

## Quality Gates

### Pre-Commit
- [ ] Tests pass
- [ ] TypeScript typecheck passes
- [ ] ESLint linting passes
- [ ] Code review completed
- [ ] Documentation updated

### Pre-Merge
- [ ] All tests pass
- [ ] Security scan passes
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Code review approved

## Issue Resolution

### Bug Fixes
1. **Reproduce**: Create a test to reproduce the bug
2. **Fix**: Implement a fix
3. **Test**: Ensure the fix resolves the issue
4. **Review**: Have the fix reviewed
5. **Deploy**: Deploy the fix

### Features
1. **Design**: Design the feature
2. **Implement**: Implement the feature
3. **Test**: Ensure the feature works
4. **Document**: Document the feature
5. **Review**: Have the feature reviewed
6. **Deploy**: Deploy the feature

## Configuration

### Claude Settings
```json
{
  "permissions": {
    "allowed_tools": ["Read", "Write", "Edit", "Bash", "Agent"],
    "denied_tools": ["TaskStop", "CronCreate", "Workflow"]
  },
  "security": {
    "max_file_size": 1000000,
    "allowed_domains": ["localhost", "example.com"],
    "require_approval": ["external", "destructive"]
  }
}
```

### Git Configuration
```bash
# Configure git
git config user.email "claude@anthropic.com"
git config user.name "Claude Code"
git config commit.gpgsign false
```

## Collaboration

### Code Reviews
- **Peer reviews**: All code changes require peer review
- **Documentation reviews**: Documentation changes require review
- **Architecture reviews**: Major architectural changes require review

### Communication
- **Issue tracking**: Use GitHub issues for tracking work
- **Pull requests**: Create pull requests for all changes
- **Code reviews**: Use GitHub pull request reviews
- **Discussions**: Use GitHub discussions for architectural decisions

## References
- `docs/SECURITY_PRIVACY.md`: Security and privacy policies
- `docs/EVENT_SCHEMA.md`: Event definitions and validation
- `docs/DATA_MODEL.md`: Detailed data model
- `docs/IMPLEMENTATION_PLAN.md`: Implementation roadmap

## End of Workflow

After completing Phase 0, stop and wait for the next explicit implementation task. Each subsequent phase will be implemented incrementally, with thorough testing and review at each stage.

Remember: The goal is to build a secure, scalable platform for small marketplaces, not to build the entire roadmap at once.

---
**Next Steps**: After Phase 0, proceed to Phase 1: Core API Layer implementation.

**Current Status**: Phase 0 completed successfully.

**Completed Components**:
- ✅ Repository structure
- ✅ Event schema package with Zod validation
- ✅ Docker Compose setup
- ✅ Database migrations
- ✅ Health checks
- ✅ Quality gates
- ✅ Basic tests
- ✅ Seed/demo data structure

**Ready for**: Phase 1 implementation.
