'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteExperienceDraft,
  ExperienceDraftConflictError,
  isExperienceDraftQuotaError,
  isMeaningfulExperienceDraft,
  loadExperienceDraft,
  saveExperienceDraft,
  type ExperienceDraftData,
  type ExperienceDraftMedia,
  type LoadedExperienceDraft,
} from './experienceDraftStorage';

export type ExperienceDraftSaveStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'text-only'
  | 'error'
  | 'conflict'
  | 'unavailable';

type UseExperienceDraftOptions = {
  data: ExperienceDraftData;
  media: ExperienceDraftMedia;
  enabled: boolean;
  ownerId: string | null;
  authResolved: boolean;
  onRestore: (draft: LoadedExperienceDraft, previewUrls: {
    hero: string[];
    itinerary: (string | null)[];
  }) => void;
};

export function useExperienceDraft({
  data,
  media,
  enabled,
  ownerId,
  authResolved,
  onRestore,
}: UseExperienceDraftOptions) {
  const [status, setStatus] = useState<ExperienceDraftSaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pendingDraft, setPendingDraft] = useState<LoadedExperienceDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const latestDataRef = useRef(data);
  const latestMediaRef = useRef(media);
  const onRestoreRef = useRef(onRestore);
  const expectedRevisionRef = useRef(0);
  const mediaDirtyRef = useRef(false);
  const previousMediaRef = useRef(media);
  const changeVersionRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const objectUrlsRef = useRef<string[]>([]);
  const suppressNextAutosaveRef = useRef(false);
  const statusRef = useRef(status);
  const hasPendingChangesRef = useRef(false);

  const updateStatus = useCallback((nextStatus: ExperienceDraftSaveStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    latestDataRef.current = data;
    latestMediaRef.current = media;
    onRestoreRef.current = onRestore;
    statusRef.current = status;
  }, [data, media, onRestore, status]);

  const revokeDraftObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  const releaseDraftObjectUrl = useCallback((url?: string | null) => {
    if (!url || !objectUrlsRef.current.includes(url)) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
  }, []);

  useEffect(() => revokeDraftObjectUrls, [revokeDraftObjectUrls]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!authResolved) return;
      try {
        revokeDraftObjectUrls();
        if (!ownerId) {
          setUserId(null);
          setPendingDraft(null);
          expectedRevisionRef.current = 0;
          updateStatus('unavailable');
          setReady(true);
          return;
        }

        setReady(false);
        setPendingDraft(null);
        updateStatus('idle');
        setUserId(ownerId);
        const draft = await loadExperienceDraft(ownerId);
        if (cancelled) return;

        if (draft) {
          expectedRevisionRef.current = draft.revision;
          setSavedAt(draft.updatedAt);
          setPendingDraft(draft);
        } else {
          expectedRevisionRef.current = 0;
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          updateStatus('unavailable');
          setReady(true);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [authResolved, ownerId, revokeDraftObjectUrls, updateStatus]);

  useEffect(() => {
    if (!ready || !enabled) return;
    if (previousMediaRef.current !== media) {
      previousMediaRef.current = media;
      mediaDirtyRef.current = true;
    }
  }, [enabled, media, ready]);

  const performSave = useCallback(async () => {
    if (!ready || !enabled || !userId || statusRef.current === 'conflict') return;

    const snapshot = latestDataRef.current;
    const mediaSnapshot = latestMediaRef.current;
    if (!isMeaningfulExperienceDraft(snapshot, mediaSnapshot)) return;

    const savingVersion = changeVersionRef.current;
    const includeMedia = mediaDirtyRef.current || expectedRevisionRef.current === 0;
    updateStatus('saving');

    try {
      const result = await saveExperienceDraft({
        userId,
        data: snapshot,
        media: includeMedia ? mediaSnapshot : undefined,
        expectedRevision: expectedRevisionRef.current,
      });
      expectedRevisionRef.current = result.revision;
      if (includeMedia) mediaDirtyRef.current = false;
      setSavedAt(result.updatedAt);
      updateStatus('saved');
      if (savingVersion === changeVersionRef.current) hasPendingChangesRef.current = false;
    } catch (error) {
      if (error instanceof ExperienceDraftConflictError) {
        updateStatus('conflict');
        return;
      }

      if (includeMedia && isExperienceDraftQuotaError(error)) {
        try {
          const result = await saveExperienceDraft({
            userId,
            data: snapshot,
            expectedRevision: expectedRevisionRef.current,
            clearMedia: true,
          });
          expectedRevisionRef.current = result.revision;
          mediaDirtyRef.current = false;
          setSavedAt(result.updatedAt);
          updateStatus('text-only');
          if (savingVersion === changeVersionRef.current) hasPendingChangesRef.current = false;
          return;
        } catch (fallbackError) {
          if (fallbackError instanceof ExperienceDraftConflictError) {
            updateStatus('conflict');
            return;
          }
        }
      }

      updateStatus('error');
    }
  }, [enabled, ready, updateStatus, userId]);

  const saveNow = useCallback(() => {
    saveChainRef.current = saveChainRef.current.then(performSave, performSave);
    return saveChainRef.current;
  }, [performSave]);

  const saveBeforeExit = useCallback(async () => {
    await saveNow();
    return statusRef.current !== 'error' && statusRef.current !== 'conflict';
  }, [saveNow]);

  useEffect(() => {
    if (!ready || !enabled || !userId || statusRef.current === 'conflict') return;
    if (suppressNextAutosaveRef.current) {
      suppressNextAutosaveRef.current = false;
      return;
    }

    const meaningful = isMeaningfulExperienceDraft(data, media);
    if (!meaningful) return;

    changeVersionRef.current += 1;
    hasPendingChangesRef.current = true;
    const timeout = window.setTimeout(() => void saveNow(), 1500);
    return () => window.clearTimeout(timeout);
  }, [data, enabled, media, ready, saveNow, userId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingChangesRef.current || statusRef.current === 'conflict') return;
      event.preventDefault();
      event.returnValue = '';
    };
    const flushWhenHidden = () => {
      if (hasPendingChangesRef.current && document.visibilityState === 'hidden') void saveNow();
    };
    const flushOnPageHide = () => {
      if (hasPendingChangesRef.current) void saveNow();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flushOnPageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flushOnPageHide);
    };
  }, [saveNow]);

  const continueDraft = useCallback(() => {
    if (!pendingDraft) return;
    revokeDraftObjectUrls();

    const hero = pendingDraft.media.heroFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return url;
    });
    const itinerary = pendingDraft.media.itineraryFiles.map((file) => {
      if (!file) return null;
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return url;
    });

    suppressNextAutosaveRef.current = true;
    onRestoreRef.current(pendingDraft, { hero, itinerary });
    previousMediaRef.current = pendingDraft.media;
    setPendingDraft(null);
    updateStatus('saved');
    setReady(true);
  }, [pendingDraft, revokeDraftObjectUrls, updateStatus]);

  const startNew = useCallback(async () => {
    if (!userId) return;
    try {
      await deleteExperienceDraft(userId);
      expectedRevisionRef.current = 0;
      setSavedAt(null);
      setPendingDraft(null);
      updateStatus('idle');
      setReady(true);
    } catch {
      updateStatus('error');
    }
  }, [updateStatus, userId]);

  const clearDraft = useCallback(async () => {
    if (!userId) return;
    await saveChainRef.current.catch(() => undefined);
    await deleteExperienceDraft(userId);
    expectedRevisionRef.current = 0;
    hasPendingChangesRef.current = false;
    revokeDraftObjectUrls();
  }, [revokeDraftObjectUrls, userId]);

  return {
    status,
    savedAt,
    pendingDraft,
    ready,
    saveNow,
    saveBeforeExit,
    continueDraft,
    startNew,
    clearDraft,
    releaseDraftObjectUrl,
  };
}
