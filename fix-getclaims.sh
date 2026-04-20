#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

echo "Scanning for Supabase getClaims destructuring pattern in: $ROOT_DIR"

find "$ROOT_DIR" \
  \( -path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.next/*" \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" \) -type f -print0 |
while IFS= read -r -d '' file; do
  if perl -0ne '
    exit 0 if /const\s*\{\s*data:\s*\{\s*claims\s*\}\s*,\s*error:\s*claimsError\s*,\s*\}\s*=\s*await\s+supabase\.auth\.getClaims\(\)/s;
    exit 1;
  ' "$file"; then
    echo "Fixing: $file"

    cp "$file" "$file.bak"

    perl -0pi -e '
      s/const\s*\{\s*data:\s*\{\s*claims\s*\}\s*,\s*error:\s*claimsError\s*,\s*\}\s*=\s*await\s+supabase\.auth\.getClaims\(\)/const { data, error: claimsError } = await supabase.auth.getClaims()\n  const claims = data?.claims/sg
    ' "$file"
  fi
done

echo "Done."
echo "Backup copies were created as *.bak"
