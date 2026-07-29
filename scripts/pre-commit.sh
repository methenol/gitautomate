#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

echo "Running pre-commit checks..."

# Mirrors .github/workflows/ci.yml. Ordered fastest-and-most-specific first, so a
# failure tells you what broke before you wait on the slow checks.
echo "🔍 Running lint check..."
npm run lint

echo "🔍 Running markdown lint..."
npm run lint:md

echo "🔍 Running typecheck..."
npm run typecheck

echo "🔍 Running tests..."
npm test

echo "🔍 Running build check..."
npm run build

echo "🔍 Running security scan..."
# Run npm audit with the same settings as CI
npm audit --audit-level=high --exit-code

echo "✅ All pre-commit checks passed!"
