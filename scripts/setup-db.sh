#!/usr/bin/env bash
# Run this after starting the dev docker compose to set up the database
# Usage: ./scripts/setup-db.sh

set -e

DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/rate_snoop"}

echo "Running migrations against: $DATABASE_URL"

psql "$DATABASE_URL" -f packages/db/drizzle/0000_initial_schema.sql

echo "Database schema applied successfully!"
