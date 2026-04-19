#!/bin/bash
# Always use this script to start the worker locally — never call rq directly.
# OBJC_DISABLE_INITIALIZE_FORK_SAFETY is required on macOS; without it the
# worker's forked child process is silently killed by the OS, leaving jobs
# stuck in 'running' state with no error logged.
set -e
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES \
  exec rq worker extraction --url "${REDIS_URL:-redis://localhost:6379/0}"
