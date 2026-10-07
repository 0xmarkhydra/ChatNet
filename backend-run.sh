#!/bin/sh
set -eu

export JWT_SECRET="${JWT_SECRET:-chatnet-dev-secret}"
export OTP_PEPPER="${OTP_PEPPER:-$JWT_SECRET}"

export AUTH_URL="http://127.0.0.1:8081"
export CHAT_URL="http://127.0.0.1:8082"
export FEED_URL="http://127.0.0.1:8083"
export TRANSLATE_URL="http://127.0.0.1:8084"
export CALL_URL="http://127.0.0.1:8085"
export PORT="${PORT:-8080}"

PORT=8081 /app/auth &
AUTH_PID=$!

PORT=8082 /app/chat &
CHAT_PID=$!

PORT=8083 /app/feed &
FEED_PID=$!

PORT=8084 /app/translate &
TRANSLATE_PID=$!

PORT=8085 /app/call &
CALL_PID=$!

/app/gateway &
GATEWAY_PID=$!

cleanup() {
  trap - EXIT INT TERM
  kill "$GATEWAY_PID" "$AUTH_PID" "$CHAT_PID" "$FEED_PID" "$TRANSLATE_PID" "$CALL_PID" 2>/dev/null || true
  wait "$GATEWAY_PID" "$AUTH_PID" "$CHAT_PID" "$FEED_PID" "$TRANSLATE_PID" "$CALL_PID" 2>/dev/null || true
}

trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

while :; do
  for pid in "$GATEWAY_PID" "$AUTH_PID" "$CHAT_PID" "$FEED_PID" "$TRANSLATE_PID" "$CALL_PID"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ChatNet backend child process $pid exited; stopping container so Railway can restart it." >&2
      exit 1
    fi
  done
  sleep 2
done
