#!/bin/bash
# Always use this script to start workers locally — never call rq directly.
# OBJC_DISABLE_INITIALIZE_FORK_SAFETY is required on macOS; without it the
# worker's forked child process is silently killed by the OS, leaving jobs
# stuck in 'running' state with no error logged.
#
# Usage:
#   ./run-worker.sh        # 1 worker (default)
#   ./run-worker.sh 2      # 2 workers in background
set -e

COUNT=${1:-1}

if [ "$COUNT" -eq 1 ]; then
    OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
      exec rq worker extraction --url "${REDIS_URL:-redis://localhost:6379/0}"
else
    echo "Starting $COUNT workers..."
    for i in $(seq 1 "$COUNT"); do
        OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
          rq worker extraction --url "${REDIS_URL:-redis://localhost:6379/0}" &
        echo "Worker $i started (PID $!)"
    done
    echo "Stop all workers with: pkill -f 'rq worker'"
    wait
fi
