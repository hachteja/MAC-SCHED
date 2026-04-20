#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

echo "Fixing getClaims destructuring patterns in: $ROOT_DIR"

find "$ROOT_DIR" \
  \( -path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.next/*" \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" \) -type f -print0 |
while IFS= read -r -d '' file; do
  cp "$file" "$file.getclaims.bak"

  python3 - "$file" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
original = text

patterns = [
    # Pattern with claimsError:
    (
        re.compile(
            r"""const\s*\{\s*
                data:\s*\{\s*claims\s*\}\s*,\s*
                error:\s*claimsError\s*,?\s*
                \}\s*=\s*await\s+supabase\.auth\.getClaims\(\)
            """,
            re.VERBOSE | re.DOTALL,
        ),
        "const { data, error: claimsError } = await supabase.auth.getClaims()\n  const claims = data?.claims",
    ),

    # Pattern without claimsError:
    (
        re.compile(
            r"""const\s*\{\s*
                data:\s*\{\s*claims\s*\}\s*
                \}\s*=\s*await\s+supabase\.auth\.getClaims\(\)
            """,
            re.VERBOSE | re.DOTALL,
        ),
        "const { data } = await supabase.auth.getClaims()\n  const claims = data?.claims",
    ),
]

for pattern, replacement in patterns:
    text = pattern.sub(replacement, text)

if text != original:
    path.write_text(text)
    print(f"Updated: {path}")
PY
done

echo "Done."
echo "Backups created as *.getclaims.bak"
