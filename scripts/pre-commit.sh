


#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

echo "Running pre-commit checks..."

# Run all the npm scripts that mirror the CI workflow
echo "🔍 Running lint check..."
npm run lint

echo "🔍 Running typecheck..."
npm run typecheck

echo "🔍 Running build check..."
npm run build

echo "🔍 Running security scan..."
# Run npm audit with the same settings as CI
npm audit --audit-level=high

echo "🔍 Running tests..."
# The CI just echoes this message, so we'll do the same
echo "No test files found, skipping test execution"

echo "✅ All pre-commit checks passed!"


