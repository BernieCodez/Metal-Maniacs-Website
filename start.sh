#!/bin/bash
node server.js &
SERVER_PID=$!

# Wait for port 3000 to open, then set it public
for i in $(seq 1 20); do
  sleep 1
  if lsof -i :3000 -sTCP:LISTEN > /dev/null 2>&1; then
    gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null
    break
  fi
done

wait $SERVER_PID
