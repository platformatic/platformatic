#!/usr/bin/env bash
# Temporary diagnostics for the intermittent Node 24 hang in packages/node.
# Loops the custom-commands tests and dumps the process tree when one hangs.
set -u
ITERATIONS=${ITERATIONS:-15}
HANG_SECONDS=${HANG_SECONDS:-150}
OUT=$(mktemp -d)
hangs=0

dump_processes () {
  if [ "${RUNNER_OS:-}" = "Windows" ]; then
    powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -match 'node|npm|cmd|tsc|sh|bash' } | Select-Object ProcessId,ParentProcessId,CreationDate,Name,CommandLine | Format-List | Out-String -Width 400"
  else
    ps -eo pid,ppid,etimes,stat,args --forest | grep -vE '^\s*[0-9]+\s+[0-9]+\s+[0-9]+\s+\S+\s+(ps|grep) '
  fi
}

REPORTS="$OUT/reports"
mkdir -p "$REPORTS"
if [ "${RUNNER_OS:-}" != "Windows" ]; then
  export NODE_OPTIONS="--report-on-signal --report-signal=SIGUSR2 --report-directory=$REPORTS ${NODE_OPTIONS:-}"
fi

inspect_tsc () {
  for tpid in $(pgrep -f "bin/tsc -p" || true); do
    echo "::group::tsc pid $tpid details"
    echo "--- wchan: $(cat /proc/$tpid/wchan 2>/dev/null)"
    echo "--- threads:"; for t in /proc/$tpid/task/*; do echo "$(basename $t) $(cat $t/comm) $(cat $t/wchan 2>/dev/null)"; done
    echo "--- fds:"; ls -l /proc/$tpid/fd 2>/dev/null
    echo "--- unix sockets:"; ss -xp 2>/dev/null | grep "pid=$tpid," || true
    echo "--- cwd: $(readlink /proc/$tpid/cwd)"; ls -la "$(readlink /proc/$tpid/cwd)/dist" 2>/dev/null
    echo "--- environment (PLT/NODE):"; tr '\0' '\n' < /proc/$tpid/environ | grep -E '^(PLT_|NODE_OPTIONS)' || true
    rm -f "$REPORTS"/*.json
    kill -USR2 "$tpid" 2>/dev/null
    sleep 5
    report=$(ls "$REPORTS"/*.json 2>/dev/null | head -1)
    if [ -n "$report" ]; then
      node -e '
        const r = require(process.argv[1])
        console.log("--- javascriptStack:", JSON.stringify(r.javascriptStack, null, 2))
        console.log("--- active libuv handles:")
        for (const h of r.libuv) if (h.is_active || h.is_referenced) console.log(JSON.stringify(h))
        console.log("--- workers:", r.workers?.length ?? 0)
      ' "$report"
    else
      echo "--- no diagnostic report produced within 5s (main thread blocked?)"
    fi
    echo "::endgroup::"
  done
}

for i in $(seq 1 "$ITERATIONS"); do
  log="$OUT/iteration-$i.log"
  launcher=""
  if [ "${RUNNER_OS:-}" != "Windows" ]; then launcher="setsid"; fi
  $launcher node --test --test-reporter=spec --test-concurrency=1 --test-timeout=600000 \
    --test-name-pattern="custom commands" test/backlog.test.js test/reuse-port.test.js > "$log" 2>&1 &
  pid=$!
  start=$(date +%s)
  while kill -0 "$pid" 2>/dev/null; do
    if [ $(( $(date +%s) - start )) -ge "$HANG_SECONDS" ]; then
      hangs=$((hangs + 1))
      echo "::group::HANG in iteration $i after ${HANG_SECONDS}s - process tree"
      dump_processes
      echo "::endgroup::"
      if [ "${RUNNER_OS:-}" != "Windows" ]; then inspect_tsc; fi
      echo "::group::HANG in iteration $i - test output (last 400 lines)"
      tail -n 400 "$log"
      echo "::endgroup::"
      if [ "${RUNNER_OS:-}" = "Windows" ]; then
        taskkill //F //T //PID "$(cat /proc/$pid/winpid 2>/dev/null || echo $pid)" > /dev/null 2>&1 || true
      fi
      kill -9 -- "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      break
    fi
    sleep 2
  done
  wait "$pid" 2>/dev/null
  rc=$?
  echo "iteration $i: rc=$rc duration=$(( $(date +%s) - start ))s $(grep -E '^ℹ (pass|fail)' "$log" | tr '\n' ' ')"
done

echo "hangs: $hangs/$ITERATIONS"
[ "$hangs" -eq 0 ]
