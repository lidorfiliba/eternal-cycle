#!/bin/sh
# Stamps a build id into web/version.txt and web/game.js so open clients can tell a new version is out.
# Installed as the pre-commit hook: cp tools/stamp.sh .git/hooks/pre-commit
set -e
cd "$(git rev-parse --show-toplevel)"
id=$(date -u +%Y%m%d%H%M%S)
printf '%s' "$id" > web/version.txt
sed -i "s/^const BUILD='[0-9]*';/const BUILD='$id';/" web/game.js
# every file is asked for with the build id in its address, so no browser pairs a new file with an old one
sed -i "s/\(core\|i18n\)\.js?v=[0-9]*'/\1.js?v=$id'/g" web/game.js
sed -i "s/en\.js?v=[0-9]*'/en.js?v=$id'/" web/i18n.js
sed -i "s/\(config\|game\)\.js?v=[0-9]*\"/\1.js?v=$id\"/g" web/index.html
git add web/version.txt web/game.js web/i18n.js web/index.html
