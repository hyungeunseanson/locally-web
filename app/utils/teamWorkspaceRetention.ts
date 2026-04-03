import type { SupabaseClient } from '@supabase/supabase-js';

import { TEAM_CHAT_ROOM_ID } from '@/app/api/admin/team/_shared';
import { recordAuditLog } from '@/app/utils/supabase/admin';

export const TEAM_WORKSPACE_TASK_RETENTION_LIMIT = 100;
export const TEAM_WORKSPACE_COMMENT_RETENTION_LIMIT = 100;

const TEAM_WORKSPACE_TASK_PRUNE_RPC = 'prune_team_workspace_tasks';
const TEAM_WORKSPACE_COMMENT_PRUNE_RPC = 'prune_team_workspace_comments';
const TEAM_WORKSPACE_RETENTION_BATCH_SIZE = 50;
const TEAM_WORKSPACE_TASK_PRUNE_FALLBACK_MAX_PASSES = 3;
const TEAM_WORKSPACE_COMMENT_PRUNE_FALLBACK_MAX_PASSES = 3;

type TeamWorkspaceAdminClient = SupabaseClient;

type CleanupAuditContext = {
  adminId?: string;
  adminEmail?: string;
  reason: 'manual_delete' | 'task_retention' | 'comment_retention';
  targetTaskId?: string | null;
};

type DeletedTaskAssetRecord = {
  task_id: string;
  task_type?: string | null;
  task_content?: string | null;
  comment_image_urls?: unknown;
};

type DeletedCommentAssetRecord = {
  comment_id: string;
  image_url?: string | null;
};

type TaskCleanupCandidate = {
  id: string;
  type?: string | null;
  content?: string | null;
};

type TaskCommentCleanupCandidate = {
  id: string;
  metadata?: unknown;
};

type DeleteTeamWorkspaceTaskResult = {
  deleted: boolean;
  notFound?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  if (isRecord(error)) {
    return Object.fromEntries(
      Object.entries(error).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
    );
  }

  return { message: String(error) };
}

export function isMissingTeamWorkspaceRpcError(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
  functionName: string
) {
  if (!error) return false;

  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(functionName) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

function isForeignKeyDeleteError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  return error.code === '23503' || (error.message || '').toLowerCase().includes('foreign key');
}

function isSupportedTeamWorkspaceStoragePath(path: string) {
  return path.startsWith('markdown_images/');
}

export function extractAdminFilePathFromUrl(value?: string | null) {
  if (typeof value !== 'string') return null;
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  if (isSupportedTeamWorkspaceStoragePath(trimmedValue)) {
    return trimmedValue;
  }

  try {
    const parsed = new URL(trimmedValue);
    const decodedHref = decodeURIComponent(parsed.href);
    const markers = [
      '/storage/v1/object/public/admin_files/',
      '/storage/v1/object/sign/admin_files/',
      '/storage/v1/object/authenticated/admin_files/',
      '/storage/v1/object/admin_files/',
    ];

    for (const marker of markers) {
      const markerIndex = decodedHref.indexOf(marker);
      if (markerIndex < 0) continue;

      const nextPath = decodedHref
        .slice(markerIndex + marker.length)
        .split('?')[0]
        .replace(/^\/+/, '');

      if (isSupportedTeamWorkspaceStoragePath(nextPath)) {
        return nextPath;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractAdminFilePathsFromCommentMetadata(rawMetadata: unknown) {
  if (!isRecord(rawMetadata)) {
    return [] as string[];
  }

  return uniqueStrings([extractAdminFilePathFromUrl(typeof rawMetadata.image_url === 'string' ? rawMetadata.image_url : null)]);
}

export function extractAdminFilePathsFromMarkdown(content: string) {
  if (!content.trim()) return [] as string[];

  const matches: string[] = [];
  const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const htmlImagePattern = /<img[^>]+src=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null = null;

  while ((match = markdownImagePattern.exec(content)) !== null) {
    matches.push(match[1]);
  }

  while ((match = htmlImagePattern.exec(content)) !== null) {
    matches.push(match[1]);
  }

  return uniqueStrings(matches.map((value) => extractAdminFilePathFromUrl(value)));
}

function normalizeCommentImageUrls(rawValue: unknown) {
  if (!Array.isArray(rawValue)) {
    return [] as string[];
  }

  return uniqueStrings(rawValue.map((value) => (typeof value === 'string' ? value : null)));
}

async function recordTeamWorkspaceCleanupFailure(
  params: CleanupAuditContext & {
    actionType: 'team_workspace_storage_cleanup_failed' | 'team_workspace_db_cleanup_failed';
    detailMessage: string;
    paths?: string[];
    error: unknown;
  }
) {
  await recordAuditLog({
    admin_id: params.adminId,
    admin_email: params.adminEmail,
    action_type: params.actionType,
    target_type: 'team_workspace',
    target_id: params.targetTaskId || 'workspace',
    details: {
      reason: params.reason,
      message: params.detailMessage,
      paths: params.paths || [],
      error: serializeError(params.error),
    },
  });
}

async function getStillReferencedTeamWorkspacePaths(
  supabaseAdmin: TeamWorkspaceAdminClient,
  candidatePaths: string[]
) {
  const dedupedPaths = uniqueStrings(candidatePaths);
  if (dedupedPaths.length === 0) {
    return new Set<string>();
  }

  const [memoResult, commentResult] = await Promise.all([
    supabaseAdmin.from('admin_tasks').select('content').eq('type', 'MEMO'),
    supabaseAdmin
      .from('admin_task_comments')
      .select('metadata')
      .neq('task_id', TEAM_CHAT_ROOM_ID)
      .not('metadata', 'is', null),
  ]);

  if (memoResult.error) {
    throw memoResult.error;
  }

  if (commentResult.error) {
    throw commentResult.error;
  }

  const memoContents = (memoResult.data || [])
    .map((row) => (typeof row.content === 'string' ? row.content : ''))
    .filter(Boolean);
  const commentImageUrls = (commentResult.data || [])
    .flatMap((row) => extractAdminFilePathsFromCommentMetadata(row.metadata))
    .filter(Boolean);

  const referencedPaths = new Set<string>();

  for (const candidatePath of dedupedPaths) {
    if (memoContents.some((content) => content.includes(candidatePath)) || commentImageUrls.some((path) => path === candidatePath)) {
      referencedPaths.add(candidatePath);
    }
  }

  return referencedPaths;
}

async function cleanupTeamWorkspaceStoragePaths(
  supabaseAdmin: TeamWorkspaceAdminClient,
  storagePaths: string[],
  auditContext: CleanupAuditContext
) {
  const candidatePaths = uniqueStrings(storagePaths).filter(isSupportedTeamWorkspaceStoragePath);
  if (candidatePaths.length === 0) {
    return;
  }

  try {
    const referencedPaths = await getStillReferencedTeamWorkspacePaths(supabaseAdmin, candidatePaths);
    const removablePaths = candidatePaths.filter((path) => !referencedPaths.has(path));
    if (removablePaths.length === 0) {
      return;
    }

    const { error } = await supabaseAdmin.storage.from('admin_files').remove(removablePaths);
    if (error) {
      console.error('[teamWorkspaceRetention] storage cleanup failed:', error);
      await recordTeamWorkspaceCleanupFailure({
        ...auditContext,
        actionType: 'team_workspace_storage_cleanup_failed',
        detailMessage: 'Failed to remove workspace storage objects.',
        paths: removablePaths,
        error,
      });
    }
  } catch (error) {
    console.error('[teamWorkspaceRetention] storage cleanup threw unexpectedly:', error);
    await recordTeamWorkspaceCleanupFailure({
      ...auditContext,
      actionType: 'team_workspace_storage_cleanup_failed',
      detailMessage: 'Workspace storage cleanup threw unexpectedly.',
      paths: candidatePaths,
      error,
    });
  }
}

function collectDeletedTaskStoragePaths(records: DeletedTaskAssetRecord[]) {
  return uniqueStrings(
    records.flatMap((record) => [
      ...extractAdminFilePathsFromMarkdown(typeof record.task_content === 'string' ? record.task_content : ''),
      ...normalizeCommentImageUrls(record.comment_image_urls).map((value) => extractAdminFilePathFromUrl(value)),
    ])
  );
}

function collectDeletedCommentStoragePaths(records: DeletedCommentAssetRecord[]) {
  return uniqueStrings(records.map((record) => extractAdminFilePathFromUrl(record.image_url)));
}

async function tryPruneTeamWorkspaceTasksViaRpc(
  supabaseAdmin: TeamWorkspaceAdminClient,
  auditContext: CleanupAuditContext
) {
  const { data, error } = await supabaseAdmin
    .rpc(TEAM_WORKSPACE_TASK_PRUNE_RPC, {
      p_keep_limit: TEAM_WORKSPACE_TASK_RETENTION_LIMIT,
    });

  if (error) {
    if (isMissingTeamWorkspaceRpcError(error, TEAM_WORKSPACE_TASK_PRUNE_RPC)) {
      return { kind: 'missing' as const };
    }

    console.error('[teamWorkspaceRetention] task prune RPC failed:', error);
    throw error;
  }

  const deletedRows = Array.isArray(data) ? (data as DeletedTaskAssetRecord[]) : [];
  await cleanupTeamWorkspaceStoragePaths(supabaseAdmin, collectDeletedTaskStoragePaths(deletedRows), auditContext);

  return {
    kind: 'success' as const,
    deletedCount: deletedRows.length,
  };
}

async function tryPruneTeamWorkspaceCommentsViaRpc(
  supabaseAdmin: TeamWorkspaceAdminClient,
  taskId: string,
  auditContext: CleanupAuditContext
) {
  const { data, error } = await supabaseAdmin
    .rpc(TEAM_WORKSPACE_COMMENT_PRUNE_RPC, {
      p_task_id: taskId,
      p_keep_limit: TEAM_WORKSPACE_COMMENT_RETENTION_LIMIT,
    });

  if (error) {
    if (isMissingTeamWorkspaceRpcError(error, TEAM_WORKSPACE_COMMENT_PRUNE_RPC)) {
      return { kind: 'missing' as const };
    }

    console.error('[teamWorkspaceRetention] comment prune RPC failed:', error);
    throw error;
  }

  const deletedRows = Array.isArray(data) ? (data as DeletedCommentAssetRecord[]) : [];
  await cleanupTeamWorkspaceStoragePaths(supabaseAdmin, collectDeletedCommentStoragePaths(deletedRows), auditContext);

  return {
    kind: 'success' as const,
    deletedCount: deletedRows.length,
  };
}

async function fetchOverflowTaskCandidates(supabaseAdmin: TeamWorkspaceAdminClient) {
  const { data, error } = await supabaseAdmin
    .from('admin_tasks')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(
      TEAM_WORKSPACE_TASK_RETENTION_LIMIT,
      TEAM_WORKSPACE_TASK_RETENTION_LIMIT + TEAM_WORKSPACE_RETENTION_BATCH_SIZE - 1
    );

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({ id: row.id, created_at: row.created_at as string }));
}

async function fetchOverflowCommentCandidates(
  supabaseAdmin: TeamWorkspaceAdminClient,
  taskId: string
) {
  const { data, error } = await supabaseAdmin
    .from('admin_task_comments')
    .select('id, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(
      TEAM_WORKSPACE_COMMENT_RETENTION_LIMIT,
      TEAM_WORKSPACE_COMMENT_RETENTION_LIMIT + TEAM_WORKSPACE_RETENTION_BATCH_SIZE - 1
    );

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({ id: row.id, created_at: row.created_at as string }));
}

export async function deleteTeamWorkspaceTaskCascade(
  supabaseAdmin: TeamWorkspaceAdminClient,
  taskId: string,
  auditContext: CleanupAuditContext
): Promise<DeleteTeamWorkspaceTaskResult> {
  const { data: task, error: taskError } = await supabaseAdmin
    .from('admin_tasks')
    .select('id, type, content')
    .eq('id', taskId)
    .maybeSingle<TaskCleanupCandidate>();

  if (taskError) {
    console.error('[teamWorkspaceRetention] task fetch before delete failed:', taskError);
    throw taskError;
  }

  if (!task) {
    return { deleted: false, notFound: true };
  }

  const { data: taskComments, error: commentsError } = await supabaseAdmin
    .from('admin_task_comments')
    .select('id, metadata')
    .eq('task_id', taskId);

  if (commentsError) {
    console.error('[teamWorkspaceRetention] comment fetch before delete failed:', commentsError);
  }

  const storagePaths = uniqueStrings([
    ...extractAdminFilePathsFromMarkdown(typeof task.content === 'string' ? task.content : ''),
    ...((taskComments || []) as TaskCommentCleanupCandidate[]).flatMap((comment) =>
      extractAdminFilePathsFromCommentMetadata(comment.metadata)
    ),
  ]);

  const deleteTaskRow = async () =>
    supabaseAdmin
      .from('admin_tasks')
      .delete()
      .eq('id', taskId);

  const firstDeleteResult = await deleteTaskRow();
  if (firstDeleteResult.error) {
    if (!isForeignKeyDeleteError(firstDeleteResult.error)) {
      console.error('[teamWorkspaceRetention] task delete failed:', firstDeleteResult.error);
      throw firstDeleteResult.error;
    }

    const { error: deleteCommentsError } = await supabaseAdmin
      .from('admin_task_comments')
      .delete()
      .eq('task_id', taskId);

    if (deleteCommentsError) {
      console.error('[teamWorkspaceRetention] pre-delete comment cleanup failed:', deleteCommentsError);
      throw deleteCommentsError;
    }

    const retryDeleteResult = await deleteTaskRow();
    if (retryDeleteResult.error) {
      console.error('[teamWorkspaceRetention] task delete retry failed:', retryDeleteResult.error);
      throw retryDeleteResult.error;
    }
  }

  const { error: orphanCommentCleanupError } = await supabaseAdmin
    .from('admin_task_comments')
    .delete()
    .eq('task_id', taskId);

  if (orphanCommentCleanupError) {
    console.error('[teamWorkspaceRetention] orphan comment cleanup failed:', orphanCommentCleanupError);
    await recordTeamWorkspaceCleanupFailure({
      ...auditContext,
      actionType: 'team_workspace_db_cleanup_failed',
      detailMessage: 'Task delete succeeded but comment cleanup failed.',
      error: orphanCommentCleanupError,
    });
  }

  await cleanupTeamWorkspaceStoragePaths(supabaseAdmin, storagePaths, {
    ...auditContext,
    targetTaskId: taskId,
  });

  return { deleted: true };
}

export async function pruneTeamWorkspaceTasks(
  supabaseAdmin: TeamWorkspaceAdminClient,
  auditContext: CleanupAuditContext
) {
  try {
    const rpcResult = await tryPruneTeamWorkspaceTasksViaRpc(supabaseAdmin, auditContext);
    if (rpcResult.kind === 'success') {
      return rpcResult.deletedCount;
    }
  } catch (error) {
    console.error('[teamWorkspaceRetention] task prune RPC path failed, falling back:', error);
  }

  let deletedCount = 0;

  for (let pass = 0; pass < TEAM_WORKSPACE_TASK_PRUNE_FALLBACK_MAX_PASSES; pass += 1) {
    const overflowTasks = await fetchOverflowTaskCandidates(supabaseAdmin);
    if (overflowTasks.length === 0) {
      break;
    }

    const orderedOverflowTasks = [...overflowTasks].sort((left, right) => {
      if (left.created_at === right.created_at) {
        return left.id.localeCompare(right.id);
      }
      return left.created_at.localeCompare(right.created_at);
    });

    for (const task of orderedOverflowTasks) {
      try {
        const result = await deleteTeamWorkspaceTaskCascade(supabaseAdmin, task.id, {
          ...auditContext,
          targetTaskId: task.id,
        });
        if (result.deleted) {
          deletedCount += 1;
        }
      } catch (error) {
        console.error('[teamWorkspaceRetention] fallback task prune delete failed:', error);
        await recordTeamWorkspaceCleanupFailure({
          ...auditContext,
          actionType: 'team_workspace_db_cleanup_failed',
          detailMessage: 'Fallback task prune delete failed.',
          error,
          targetTaskId: task.id,
        });
      }
    }
  }

  return deletedCount;
}

export async function pruneTeamWorkspaceComments(
  supabaseAdmin: TeamWorkspaceAdminClient,
  taskId: string,
  auditContext: CleanupAuditContext
) {
  try {
    const rpcResult = await tryPruneTeamWorkspaceCommentsViaRpc(supabaseAdmin, taskId, auditContext);
    if (rpcResult.kind === 'success') {
      return rpcResult.deletedCount;
    }
  } catch (error) {
    console.error('[teamWorkspaceRetention] comment prune RPC path failed, falling back:', error);
  }

  let deletedCount = 0;

  for (let pass = 0; pass < TEAM_WORKSPACE_COMMENT_PRUNE_FALLBACK_MAX_PASSES; pass += 1) {
    const overflowComments = await fetchOverflowCommentCandidates(supabaseAdmin, taskId);
    if (overflowComments.length === 0) {
      break;
    }

    const { data: commentsToDelete, error: commentsToDeleteError } = await supabaseAdmin
      .from('admin_task_comments')
      .select('id, metadata')
      .in(
        'id',
        overflowComments.map((comment) => comment.id)
      );

    if (commentsToDeleteError) {
      throw commentsToDeleteError;
    }

    const storagePaths = uniqueStrings(
      ((commentsToDelete || []) as TaskCommentCleanupCandidate[]).flatMap((comment) =>
        extractAdminFilePathsFromCommentMetadata(comment.metadata)
      )
    );

    const { error: deleteCommentsError, count } = await supabaseAdmin
      .from('admin_task_comments')
      .delete({ count: 'exact' })
      .in(
        'id',
        overflowComments.map((comment) => comment.id)
      );

    if (deleteCommentsError) {
      throw deleteCommentsError;
    }

    deletedCount += count || 0;
    await cleanupTeamWorkspaceStoragePaths(supabaseAdmin, storagePaths, {
      ...auditContext,
      targetTaskId: taskId,
    });
  }

  return deletedCount;
}
