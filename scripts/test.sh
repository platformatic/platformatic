#! /bin/bash

set -e

CPU=`uname -p`
OS=`uname -s`

echo Detected CPU: $CPU
echo Detected OS: $OS

if [ $OS = "Darwin" ]
then
  if [ $CPU = "arm" ]
  then
    DOCKERFILE="docker-compose-apple-silicon.yml"
  else
    DOCKERFILE="docker-compose-mac.yml"
  fi
elif [ $OS = "Linux" ]
then
    DOCKERFILE="docker-compose.yml"
else
    echo "Failed to identify this OS"
    exit 1
fi

echo Using docker-compose file: $DOCKERFILE
echo

PROJECTS=`ls packages`

docker-compose -f $DOCKERFILE down

for project in $PROJECTS; do
  echo ========================
  echo $project
  echo

  docker-compose -f $DOCKERFILE up -d

  echo 
  echo ">> Waiting for databases to start..."
  echo
  sleep 5

  pushd packages/$project

  # tests are a bit flaky, retry if fails
  for i in $(seq 1 5); do [ $i -gt 1 ] && sleep 15; pnpm test && s=0 && break || s=$?; done; (exit $s)

  popd

  docker-compose -f $DOCKERFILE down
  docker-compose -f $DOCKERFILE rm -f
  docker volume prune -f
  echo 
  echo ">> Waiting for databases to stop..."
  echo 
  sleep 5
done
