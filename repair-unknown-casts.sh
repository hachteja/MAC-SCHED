#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

echo "Repairing malformed unknown-cast replacements in: $ROOT_DIR"

find "$ROOT_DIR" \
  \( -path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.next/*" \) -prune -o \
  \( -name "*.ts" -o -name "*.tsx" \) -type f -print0 |
while IFS= read -r -d '' file; do
  cp "$file" "$file.pre_repair.bak"

  python3 - "$file" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

original = text

patterns = [
    # (((foo as Type | null as unknown) as ) ?? [])
    (
        re.compile(
            r"""\(\(\(\s*([A-Za-z0-9_.$]+)\s+as\s+(.+?)\s+as\s+unknown\s*\)\s+as\s*\)\s*\?\?\s*\[\]\)""",
            re.DOTALL,
        ),
        r"(((\1 as unknown) as \2) ?? [])",
    ),
    # ((((foo as Type | null as unknown) as ) ?? []))
    (
        re.compile(
            r"""\(\(\(\(\s*([A-Za-z0-9_.$]+)\s+as\s+(.+?)\s+as\s+unknown\s*\)\s+as\s*\)\s*\?\?\s*\[\]\)\)""",
            re.DOTALL,
        ),
        r"((((\1 as unknown) as \2) ?? []))",
    ),
]

for pattern, replacement in patterns:
    text = pattern.sub(replacement, text)

if text != original:
    path.write_text(text)
    print(f"Repaired: {path}")
PY
done

echo "Done."
echo "Backups created as *.pre_repair.bak"
