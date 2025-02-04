#!/bin/bash

set -e # This is to fail on errors

cd $(dirname $0)

OUTPUT=$(node -e "console.log(process.cwd())")
echo "STDOUT=$OUTPUT"
echo "STDERR=$OUTPUT" >&2