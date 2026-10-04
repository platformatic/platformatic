#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p results/review/multi-app review/multi-app/tls
TASK_PLATFORM=${BENCH_PLATFORM:-$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')}
TASK_NODE_IMAGE=${BENCH_NODE_IMAGE:-node:22-bookworm}
# Disposable local fixture certificate; no production key is used.
openssl req -x509 -newkey rsa:2048 -nodes -keyout review/multi-app/tls/key.pem -out review/multi-app/tls/cert.pem -days 3 -subj /CN=watt-multi-server
chmod 644 review/multi-app/tls/key.pem
# Fail on occupied names. Only remove containers owned by this experiment.
docker run -d --platform "$TASK_PLATFORM" --name watt-request-build --cpuset-cpus "${BENCH_BUILD_CPUS:-0-3}" --cpus 4 "$TASK_NODE_IMAGE" sleep infinity
COPYFILE_DISABLE=1 tar --no-xattrs --exclude='./node_modules' --exclude='*/node_modules' --exclude='./.git' --exclude='./results' --exclude='._*' --exclude='./review/benchmark/rust/target' --exclude='./review/release/artifacts' -cf - . | docker exec -i watt-request-build sh -c 'mkdir -p /work && tar -xf - -C /work'
# The request policy needs no native rebuild, SQLite or privileged installation.
docker exec -w /work watt-request-build sh -c 'npm install -g pnpm@10.34.5 && pnpm install --frozen-lockfile --ignore-scripts'
docker exec -w /work watt-request-build node -e "const fs=require('node:fs'),p=require('node:path'),root=p.dirname(require.resolve('undici-thread-interceptor',{paths:['/work/packages/runtime']}));fs.cpSync(root,'/work/review/multi-app/stock-dependency',{recursive:true});fs.rmSync('/work/review/multi-app/stock-dependency/node_modules',{recursive:true,force:true});fs.symlinkSync('/work/packages/runtime/node_modules','/work/review/multi-app/stock-dependency/node_modules');fs.copyFileSync('/work/packages/runtime/lib/mesh/index.js','/work/packages/runtime/lib/mesh/feature-index.cjs');fs.copyFileSync('/work/review/multi-app/stock-entry.cjs','/work/packages/runtime/lib/mesh/index.js')"
docker commit watt-request-build watt-request-routing:local
docker network create watt-request-network
for role in server client; do
  if [ "$role" = server ]; then TASK_CPUS=0-3; else TASK_CPUS=4-7; fi
  docker run -d --platform "$TASK_PLATFORM" --name "watt-multi-$role" --network watt-request-network --cpuset-cpus "$TASK_CPUS" --cpus 4 --memory 2g --memory-swap 2g --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp:rw,exec,mode=1777 watt-request-routing:local sleep infinity
done
docker exec -i watt-multi-client sh -c 'cat > /tmp/multi-client.mjs' < review/multi-app/client.js
docker exec -i watt-multi-client sh -c 'cat > /tmp/forwarding-client.mjs' < review/multi-app/forwarding-client.js
