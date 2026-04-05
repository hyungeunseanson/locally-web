import { expect, test } from '@playwright/test';

import {
  buildStorageUploadFailureDiagnostic,
  redactStorageObjectPath,
} from '@/app/utils/supabase/storageUploadDiagnostics';

test.describe('Storage upload diagnostics', () => {
  test('redacts per-user object names while preserving the contract prefix', () => {
    expect(
      redactStorageObjectPath('id_card/123e4567-e89b-12d3-a456-426614174000_1732456789012')
    ).toBe('id_card/<redacted>');
    expect(redactStorageObjectPath('')).toBe('<redacted>');
  });

  test('extracts safe structured diagnostics from storage upload errors', () => {
    const diagnostic = buildStorageUploadFailureDiagnostic(
      {
        name: 'StorageApiError',
        message: 'new row violates row-level security policy for table "objects"',
        error: 'AccessDenied',
        details: 'insert rejected for verification-docs',
        statusCode: '403',
      },
      {
        route: '/host/register',
        boundary: 'host_register_storage_upload',
        bucket: 'verification-docs',
        fileKind: 'id_card',
        filePath: 'id_card/123e4567-e89b-12d3-a456-426614174000_1732456789012',
        locale: 'ja',
      }
    );

    expect(diagnostic).toMatchObject({
      route: '/host/register',
      boundary: 'host_register_storage_upload',
      bucket: 'verification-docs',
      fileKind: 'id_card',
      filePathPattern: 'id_card/<redacted>',
      pathPrefix: 'id_card',
      locale: 'ja',
      errorName: 'StorageApiError',
      errorMessage: 'new row violates row-level security policy for table "objects"',
      errorCode: 'AccessDenied',
      errorDetails: 'insert rejected for verification-docs',
      statusCode: '403',
    });
  });
});
