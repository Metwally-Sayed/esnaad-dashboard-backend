# MCP Servers Configuration

This document explains the Model Context Protocol (MCP) servers configured for this project.

## What are MCP Servers?

MCP servers provide enhanced capabilities for AI assistants like Claude Code, enabling:
- Direct database interactions
- File system operations
- External API integrations
- And more...

## Configured MCP Servers

### 1. PostgreSQL MCP Server

**Purpose**: Direct PostgreSQL database access and query execution

**Package**: `@modelcontextprotocol/server-postgres`

**Configuration** (in `.clauderc`):
```json
{
  "postgres": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-postgres",
      "postgresql://postgres:password@localhost:5432/esnaad_dashboard"
    ]
  }
}
```

**Capabilities**:
- Run SQL queries directly
- Introspect database schema
- Manage tables and data
- Execute Prisma operations

**Usage Example**:
When working with Claude Code, you can ask:
- "Show me all users in the database"
- "Create a new table for blog posts"
- "Run a query to get dashboard statistics"

### 2. Filesystem MCP Server

**Purpose**: Enhanced file system operations

**Package**: `@modelcontextprotocol/server-filesystem`

**Configuration** (in `.clauderc`):
```json
{
  "filesystem": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/Users/metwally/Desktop/esnaad-dashboard/esnaad-dashboard-backend"
    ]
  }
}
```

**Capabilities**:
- Read and write files
- Search file contents
- Manage directories
- File metadata operations

## Updating MCP Configuration

### Update Database Connection

Edit `.clauderc` and change the PostgreSQL connection string:

```json
"postgresql://username:password@host:port/database"
```

### Add More MCP Servers

You can add additional MCP servers to `.clauderc`:

#### Brave Search (for web searches)
```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "your-api-key"
  }
}
```

#### GitHub (for repository operations)
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "your-github-token"
  }
}
```

#### Puppeteer (for PDF generation and web scraping)
```json
"puppeteer": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
}
```

## Installing MCP Servers

MCP servers are automatically installed when Claude Code starts if they're configured in `.clauderc`.

To manually install:

```bash
# PostgreSQL MCP
npm install -g @modelcontextprotocol/server-postgres

# Filesystem MCP
npm install -g @modelcontextprotocol/server-filesystem
```

## Troubleshooting

### MCP Server Not Working

1. **Check Configuration**: Ensure `.clauderc` is valid JSON
2. **Verify Credentials**: Database URL must be correct
3. **Restart Claude Code**: Changes require restart
4. **Check Logs**: Look for MCP errors in Claude Code console

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify database exists
- Check username/password
- Confirm port is correct (default: 5432)

### Permission Issues

On macOS/Linux, ensure the filesystem path has read/write permissions:

```bash
chmod -R 755 /path/to/project
```

## Security Considerations

1. **Never commit `.clauderc`** with sensitive credentials
2. **Use environment variables** for sensitive data
3. **Limit filesystem access** to project directory only
4. **Restrict database user** permissions in production

## Alternative: Environment-Based Configuration

Create `.clauderc` with environment variables:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres"
      ],
      "env": {
        "PGHOST": "localhost",
        "PGPORT": "5432",
        "PGDATABASE": "esnaad_dashboard",
        "PGUSER": "postgres",
        "PGPASSWORD": "password"
      }
    }
  }
}
```

## Learn More

- [MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [Available MCP Servers](https://github.com/modelcontextprotocol)
- [Creating Custom MCP Servers](https://docs.claude.com/en/docs/claude-code/mcp/custom-servers)

## Benefits for Development

With MCP servers enabled, you can:

✅ Query database without leaving your editor
✅ Generate reports and analytics on-the-fly
✅ Automate database migrations
✅ Quickly prototype database schemas
✅ Debug data issues in real-time
✅ Enhance file operations

Enjoy enhanced development with MCP! 🚀
