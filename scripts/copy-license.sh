
FOLDERS=`ls -d packages/*`

for i in $FOLDERS; do
  echo "copying license to $i"
  cp LICENSE $i
  cp NOTICE $i
  echo "adjusting SPDX in $i"
  cd $i
  node -e 'const fs = require("fs"); const pkg = JSON.parse(fs.readFileSync("package.json")); pkg.license = "Apache-2.0"; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));'
  cd ../..
done

