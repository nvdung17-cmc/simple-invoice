#!/bin/sh
# Starts the API container. With SEED_ON_START=true it first runs the seeder,
# which applies pending migrations and inserts only the missing demo data, so
# every start is safe (spec §5.8). Then it runs the command (the API) as PID 1.
set -e
if [ "$SEED_ON_START" = "true" ]; then
  node dist/database/seed/run-seed.js
fi
exec "$@"
