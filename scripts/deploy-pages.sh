#!/usr/bin/env bash
# Redeploy public/ to the gh-pages branch (GitHub Pages).
set -e
cd "$(dirname "$0")/.."
git fetch origin
git subtree split --prefix public -b gh-pages-tmp
git push origin gh-pages-tmp:gh-pages --force
git branch -D gh-pages-tmp
echo "Pushed to gh-pages — https://<user>.github.io/game-night/ will update in a minute."
