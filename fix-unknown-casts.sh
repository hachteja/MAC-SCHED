#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

echo "Scanning for nullable type assertions before ?? [] in: $ROOT_DIR"

find "$ROOT_DIR" \
  \( -path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.next/*" \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" \) -type f -print0 |
while IFS= read -r -d '' file; do
  if perl -0ne '
    exit 0 if /\(\s*([A-Za-z0-9_.$]+)\s+as\s+([A-Za-z0-9_<>\[\]\s|,:?{}]+)\)\s*\?\?\s*\[\]/s;
    exit 1;
  ' "$file"; then
    cp "$file" "$file.bak"

    perl -0pi -e '
      s/\(\s*([A-Za-z0-9_.$]+)\s+as\s+([A-Za-z0-9_<>\[\]\s|,:?{}]+)\)\s*\?\?\s*\[\]/(((\1 as unknown) as \2) ?? [])/g
    ' "$file"

    echo "Updated: $file"
  fi
done

echo "Done."
echo "Backups created as *.bak"
