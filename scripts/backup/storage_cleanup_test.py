import contextlib
import errno
import io
import json
import os
import pathlib
import shutil
import tempfile
import unittest
from unittest import mock

import cleanup_storage_backup as cleanup


class StorageCleanupTests(unittest.TestCase):
    def capture_directory(self, root):
        path = pathlib.Path(root) / 'locally-authoritative-storage-123-current'
        path.mkdir()
        (path / 'private-payload').write_text('private-fixture')
        return path

    def test_directory_recreated_during_removal_is_retried_then_removed(self):
        for error_number in (errno.ENOTEMPTY, errno.EEXIST):
            with self.subTest(error_number=error_number), tempfile.TemporaryDirectory() as root:
                path = self.capture_directory(root)
                real_remove = shutil.rmtree
                calls = []

                def concurrent_remove(target):
                    calls.append(target)
                    real_remove(target)
                    if len(calls) == 1:
                        target.mkdir()
                        (target / 'late-private-payload').write_text('late-fixture')
                        raise OSError(error_number, 'directory not empty', str(target))

                with mock.patch.object(cleanup.shutil, 'rmtree', side_effect=concurrent_remove), mock.patch.object(cleanup.time, 'sleep') as sleep:
                    result = cleanup.cleanup(root, '123')
                self.assertEqual(result['status'], 'complete')
                self.assertEqual((result['cleanupAttempts'], result['cleanupRetryCount'], result['removedDirectories']), (2, 1, 1))
                sleep.assert_called_once_with(1)
                self.assertFalse(path.exists())

    def test_persistent_directory_not_empty_is_bounded_and_cli_fails_safely(self):
        with tempfile.TemporaryDirectory() as root:
            path = self.capture_directory(root)
            output = io.StringIO()
            error = OSError(errno.ENOTEMPTY, 'private-secret-fragment', str(path))
            with mock.patch.dict(os.environ, {'RUNNER_TEMP': root, 'GITHUB_RUN_ID': '123'}), mock.patch.object(cleanup.shutil, 'rmtree', side_effect=error) as remove, mock.patch.object(cleanup.time, 'sleep') as sleep, contextlib.redirect_stdout(output):
                exit_code = cleanup.main()
            result = json.loads(output.getvalue())
            self.assertEqual(exit_code, 1)
            self.assertEqual(result['diagnosticCode'], 'temporary_cleanup_failed')
            self.assertEqual((remove.call_count, sleep.call_count), (3, 2))
            self.assertEqual((result['cleanupAttempts'], result['cleanupRetryCount'], result['removedDirectories']), (3, 2, 0))
            self.assertTrue(path.exists())
            self.assertNotIn(str(path), output.getvalue())
            self.assertNotIn('private-secret-fragment', output.getvalue())

    def test_permission_failure_is_not_retried(self):
        with tempfile.TemporaryDirectory() as root:
            path = self.capture_directory(root)
            with mock.patch.object(cleanup.shutil, 'rmtree', side_effect=PermissionError(errno.EACCES, 'private', str(path))) as remove, mock.patch.object(cleanup.time, 'sleep') as sleep:
                result = cleanup.cleanup(root, '123')
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(remove.call_count, 1)
            sleep.assert_not_called()

    def test_only_current_run_local_capture_directories_are_removed(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            current = self.capture_directory(root)
            previous = pathlib.Path(root) / 'locally-authoritative-storage-122-previous'
            previous.mkdir()
            other = pathlib.Path(root) / 'unrelated-directory'
            other.mkdir()
            linked = pathlib.Path(root) / 'locally-authoritative-storage-123-linked'
            linked.symlink_to(outside, target_is_directory=True)
            offline_identity = pathlib.Path(outside) / 'offline-identity-fixture'
            offline_identity.write_text('private-fixture')
            result = cleanup.cleanup(root, '123')
            self.assertEqual(result['status'], 'complete')
            self.assertFalse(current.exists())
            self.assertTrue(previous.is_dir())
            self.assertTrue(other.is_dir())
            self.assertTrue(linked.is_symlink())
            self.assertEqual(offline_identity.read_text(), 'private-fixture')

    def test_missing_root_during_removal_is_idempotent_but_partial_removal_fails(self):
        for remove_root in (True, False):
            with self.subTest(remove_root=remove_root), tempfile.TemporaryDirectory() as root:
                path = self.capture_directory(root)
                real_remove = shutil.rmtree

                def missing(target):
                    if remove_root:
                        real_remove(target)
                    raise FileNotFoundError('private path')

                with mock.patch.object(cleanup.shutil, 'rmtree', side_effect=missing):
                    result = cleanup.cleanup(root, '123')
                self.assertEqual(result['status'], 'complete' if remove_root else 'failed')
                self.assertEqual(path.exists(), not remove_root)

    def test_invalid_scope_fails_without_removal(self):
        with tempfile.TemporaryDirectory() as root, mock.patch.object(cleanup.shutil, 'rmtree') as remove:
            for run_id in ('*', '../123', None, ''):
                self.assertEqual(cleanup.cleanup(root, run_id)['status'], 'failed')
            self.assertEqual(cleanup.cleanup(None, '123')['status'], 'failed')
            remove.assert_not_called()

    def test_workflow_always_runs_cleanup_and_does_not_ignore_failure(self):
        workflow = (pathlib.Path(__file__).resolve().parents[2] / '.github/workflows/authoritative-storage-backup.yml').read_text()
        step = workflow.split('- name: Remove private plaintext and intermediate files')[1].split('- name: Publish sanitized result')[0]
        self.assertIn('if: always()', step)
        self.assertIn('python3 scripts/backup/cleanup_storage_backup.py', step)
        self.assertNotIn('continue-on-error', step)
        self.assertNotIn('ignore_errors', step)


if __name__ == '__main__':
    unittest.main()
