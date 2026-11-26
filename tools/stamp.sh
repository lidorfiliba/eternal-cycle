#!/bin/sh
# Stamps a build id into web/version.txt and web/game.js so open clients can tell a new version is out.
# Installed as the pre-commit hook: cp tools/stamp.sh .git/hooks/pre-commit
set -e
cd "$(git rev-parse --show-toplevel)"
id=$(date -u +%Y%m%d%H%M%S)
printf '%s' "$id" > web/version.txt
sed -i "s/^const BUILD='[0-9]*';/const BUILD='$id';/" web/game.js
git add web/version.txt web/game.js
