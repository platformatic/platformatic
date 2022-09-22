#!/bin/sh

VERSION=`node -e "console.log(require('./package.json').version)"`

echo Synchronizing all modules to version $VERSION

for FILE in `ls packages/*/package.json`
do
  echo editing $FILE
  node -e "const meta = require('./$FILE'); meta.version = '$VERSION'; console.log(JSON.stringify(meta, null, 2))" > $FILE.tmp
  mv $FILE.tmp $FILE
done
