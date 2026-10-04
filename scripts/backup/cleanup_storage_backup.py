#!/usr/bin/env python3
"""Remove only this workflow run's local capture directories, with bounded retry."""
import errno
import json
import os
import pathlib
import re
import shutil
import time

MAX_CLEANUP_ATTEMPTS = 3
CLEANUP_RETRY_DELAY_SECONDS = 1


def cleanup(root, run_id):
    result = dict(status='complete', diagnosticCode='temporary_cleanup_complete',
                  cleanupAttempts=0, cleanupRetryCount=0, removedDirectories=0)
    try:
        root = pathlib.Path(root)
        if not re.fullmatch(r'[0-9]+', run_id) or not root.is_dir() or root.is_symlink():
            raise ValueError('invalid cleanup scope')
        for path in sorted(root.glob('locally-authoritative-storage-' + run_id + '-*')):
            if path.is_symlink() or not path.is_dir():
                continue
            for attempt in range(1, MAX_CLEANUP_ATTEMPTS + 1):
                result['cleanupAttempts'] += 1
                try:
                    shutil.rmtree(path)
                except FileNotFoundError:
                    # An already removed root is success; an incomplete tree is not.
                    if path.exists():
                        raise
                except OSError as error:
                    if error.errno not in {errno.ENOTEMPTY, errno.EEXIST} or attempt == MAX_CLEANUP_ATTEMPTS:
                        raise
                    result['cleanupRetryCount'] += 1
                    time.sleep(CLEANUP_RETRY_DELAY_SECONDS)
                    continue
                result['removedDirectories'] += 1
                break
    except Exception:
        # Never expose exception text: it can contain a private path or payload.
        result.update(status='failed', diagnosticCode='temporary_cleanup_failed')
    return result


def main():
    result = cleanup(os.environ.get('RUNNER_TEMP'), os.environ.get('GITHUB_RUN_ID'))
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'complete' else 1


if __name__ == '__main__':
    raise SystemExit(main())
