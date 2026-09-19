#!/bin/bash
set -e

# Removes ONLY the accidental Velici V3 root files if they still contain
# recognizable Velici content. Your real Bay Café backend/frontend files
# are not touched by this cleanup.

remove_if_contains () {
  file="$1"
  marker="$2"

  if [ -f "$file" ] && grep -q "$marker" "$file"; then
    echo "Removing accidental Velici file: $file"
    rm -f "$file"
  fi
}

remove_if_contains "package.json" '"name": "velici-community"'
remove_if_contains "index.html" '<title>Velici</title>'
remove_if_contains "server.js" '\[Velici\]'
remove_if_contains ".env.example" 'OWNERSHIP_ROLE_NAMES='
remove_if_contains "src/App.jsx" 'VELICI'
remove_if_contains "src/styles.css" 'velici-loader'
remove_if_contains "src/main.jsx" 'App from "./App.jsx"'

# Remove the accidental root src folder only if nothing remains in it.
if [ -d "src" ] && [ -z "$(find src -mindepth 1 -maxdepth 1 -print -quit)" ]; then
  rmdir src
fi

echo "Accidental Velici root files cleaned."
echo "Bay Café V74 backend/frontend restore files are now in place."
