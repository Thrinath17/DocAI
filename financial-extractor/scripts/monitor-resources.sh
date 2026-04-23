#!/bin/bash
# Run this in a second terminal WHILE a job is processing.
# It shows Ollama GPU status, worker CPU/memory, and how to get GPU power readings.
#
# Usage: ./scripts/monitor-resources.sh

set -euo pipefail

echo "=== Ollama: loaded models and VRAM/RAM usage ==="
/opt/homebrew/bin/ollama ps

echo ""
echo "=== Worker process CPU + memory ==="
WORKER_PID=$(pgrep -f "rq worker" | head -1 || true)
if [ -n "$WORKER_PID" ]; then
    ps -p "$WORKER_PID" -o pid,command,pcpu,pmem,rss
else
    echo "No rq worker process found. Is the worker running?"
fi

echo ""
echo "=== Top CPU consumers (snapshot) ==="
ps -Ao pid,command,pcpu,pmem -r | head -10

echo ""
echo "=== Ollama GPU acceleration check ==="
OLLAMA_PS=$(/opt/homebrew/bin/ollama ps 2>/dev/null || echo "")
if echo "$OLLAMA_PS" | grep -q "100%"; then
    echo "OK — model fully loaded into GPU (Metal MPS active)"
elif echo "$OLLAMA_PS" | grep -q "%"; then
    echo "WARNING — model only partially on GPU. Some layers running on CPU (slow)."
    echo "$OLLAMA_PS"
else
    echo "Model not currently loaded. Upload a doc and re-run this script during processing."
fi

echo ""
echo "=== For live GPU power during a job run ==="
echo "  sudo powermetrics --samplers gpu_power -i 500 -n 10"
echo "  Look for 'GPU Power' > 0 W — confirms Metal inference is active."
