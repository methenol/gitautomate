# GitAutomate: AI-Powered Project Planning Tool

GitAutomate is a Next.js web application that transforms Product Requirements Documents (PRDs) into comprehensive project plans using Google's Gemini AI models. It features GitHub integration for automatic issue creation and local export capabilities.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Setup
- **Node.js Version**: Install Node.js 20.x (specified in `.nvmrc`)
- **Dependencies**: `npm install` -- takes 1-2 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
- **Environment Setup**: Create `.env` file with `GOOGLE_API_KEY="YOUR_GOOGLE_AI_API_KEY"`
- **Genkit CLI**: Install globally with `npm install -g genkit-cli` -- required for AI backend server

### Build and Test Process
- **Build**: `npm run build` -- takes 30 seconds. NEVER CANCEL. Set timeout to 2+ minutes.
- **Lint**: `npm run lint` -- takes 3 seconds
- **Type Check**: `npm run typecheck` -- takes 7 seconds  
- **Security Scan**: `npm audit --audit-level=high --exit-code` -- takes 1 second
- **Pre-commit Validation**: `./scripts/pre-commit.sh` -- takes 25 seconds total. NEVER CANCEL. Set timeout to 2+ minutes.

### Development Servers
**LOCAL DEVELOPMENT REQUIRES TWO CONCURRENT PROCESSES:**

1. **Genkit AI Backend Server**:
   - Command: `npm run genkit:dev` or `npm run genkit:watch`
   - Alternative: `genkit start -- npx tsx src/ai/dev.ts`
   - Port: 4000 (Genkit UI - may fail to load due to network restrictions)
   - API: localhost:4033 (Telemetry)

2. **Next.js Frontend Server**:
   - Command: `npm run dev`
   - Port: 9002
   - URL: http://localhost:9002
   - Uses Turbopack for fast development

**CRITICAL**: Both servers must run simultaneously for full functionality. Start Genkit backend first, then Next.js frontend.

### Production/Docker
- **Production Start**: `npm run prod:start` -- runs both servers together
- **Docker Build**: `docker compose build` -- CURRENTLY FAILS due to missing `next` command during build
- **Docker Issue**: Known problem with Dockerfile, use local development instead
- **Docker Alternative**: Manual container setup works but requires debugging the build stage

## Validation

### Manual Testing Scenarios
Always validate changes by running through these complete scenarios:

1. **Basic Application Load**:
   - Start both development servers
   - Navigate to http://localhost:9002
   - Verify GitAutomate interface loads with Step 1 (Select Repository) and Step 2 (Provide PRD)

2. **Settings Configuration**:
   - Click settings icon (⚙️) in top-right corner
   - Test entering Google AI API Key
   - Verify TDD toggle functionality
   - Click "Save Settings" and confirm dialog closes

3. **PRD Input and Processing**:
   - Enter a sample PRD in the text area (e.g., "Build a todo application with add/edit/delete functionality")
   - Verify "Generate Architecture" button becomes enabled
   - Test with valid API key to ensure AI integration works

### CI/CD Validation
Always run these commands before committing:
- `npm run lint` -- must pass for CI (.github/workflows/ci.yml)
- `npm run typecheck` -- must pass for CI
- `npm run build` -- must pass for CI
- `npm audit --audit-level=high --exit-code` -- must pass for security scan
- `./scripts/pre-commit.sh` -- validates all CI checks locally

## Architecture and Key Components

### Technology Stack
- **Framework**: Next.js 15.3.3 with App Router and Turbopack
- **Language**: TypeScript with strict mode
- **AI Backend**: Firebase Genkit with Google AI integration
- **UI**: React with ShadCN UI components and Tailwind CSS
- **State**: React hooks and local storage
- **Forms**: React Hook Form with Zod validation

### Project Structure
```
src/
├── ai/                    # Genkit AI flows and backend
│   ├── dev.ts            # Development server entry point
│   ├── flows/            # AI flow implementations
│   └── genkit.ts         # Genkit configuration
├── app/                  # Next.js App Router pages
├── components/           # React UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
└── types/               # TypeScript type definitions
```

### Key Files
- `package.json` -- Scripts and dependencies
- `next.config.ts` -- Next.js configuration with build error ignoring
- `.eslintrc.js` -- ESLint configuration
- `tsconfig.json` -- TypeScript configuration
- `docker-compose.yml` -- Container orchestration (has build issues)
- `.github/workflows/ci.yml` -- CI pipeline definition

## Common Tasks

### Adding New AI Flows
- Create new flow in `src/ai/flows/`
- Import in `src/ai/dev.ts`
- Test with Genkit UI at localhost:4000 (if accessible)

### UI Component Development
- Use ShadCN UI components from `src/components/ui/`
- Follow existing patterns for form handling and validation
- Test responsive design and dark theme compatibility

### Environment Variables
- `GOOGLE_API_KEY` -- Required for AI functionality
- Store in `.env` file (not committed)
- Can be overridden in application settings UI

### GitHub Integration
- Requires GitHub Personal Access Token with `repo` scope
- Configured through application settings UI
- Used for repository selection and issue creation

## Known Issues and Workarounds

### Genkit CLI Installation
- Must install `genkit-cli` globally: `npm install -g genkit-cli`
- Local genkit binary not available in node_modules/.bin/
- Use `npx tsx` instead of just `tsx` in command chains

### Docker Build Failure
- Current Dockerfile has issues with `next` command not found during build
- Use local development setup instead
- If Docker needed, debug the dependency installation in builder stage

### Network Restrictions
- Genkit UI assets may fail to download (403 errors)
- Core functionality works despite UI asset failures
- Google Fonts may be blocked (cosmetic issue only)

### Build Warnings
- OpenTelemetry and Handlebars warnings are normal and non-breaking
- TypeScript and ESLint validation are disabled in production build
- These warnings don't affect functionality

## Command Reference

### Most Used Commands
```bash
# Fresh setup
npm install
npm install -g genkit-cli

# Development (run in separate terminals)
npm run genkit:dev
npm run dev

# Validation
npm run lint
npm run typecheck  
npm run build
./scripts/pre-commit.sh

# Production
npm run prod:start
```

### Timeout Recommendations
- `npm install`: 5+ minutes
- `npm run build`: 2+ minutes  
- `./scripts/pre-commit.sh`: 2+ minutes
- Development servers: Start immediately, no timeout needed

**CRITICAL**: NEVER CANCEL builds or long-running commands. Wait for completion even if it takes longer than expected.