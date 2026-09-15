#!/usr/bin/env python3
from storage_byte_backup import main, BackupError
import json
import sys

try:
    raise SystemExit(main())
except BackupError as exc:
    print(json.dumps({"status": "failed", "diagnosticCode": exc.code}), file=sys.stderr)
    raise SystemExit(1)
