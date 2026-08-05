import type { ExperienceFormState } from './experienceFormState';

const DATABASE_NAME = 'locally-host-experience-drafts';
const DATABASE_VERSION = 1;
const DRAFT_STORE = 'drafts';
const MEDIA_STORE = 'media';

export const EXPERIENCE_DRAFT_SCHEMA_VERSION = 1;
export const EXPERIENCE_DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type ExperienceDraftData = {
  step: number;
  formData: ExperienceFormState;
  isCustomCity: boolean;
  tempInclusion: string;
  tempExclusion: string;
};

export type ExperienceDraftMedia = {
  heroFiles: File[];
  itineraryFiles: (File | null)[];
};

type StoredExperienceDraft = ExperienceDraftData & {
  userId: string;
  schemaVersion: number;
  revision: number;
  updatedAt: number;
  expiresAt: number;
};

type StoredExperienceDraftMedia = ExperienceDraftMedia & {
  userId: string;
};

export type LoadedExperienceDraft = {
  data: ExperienceDraftData;
  media: ExperienceDraftMedia;
  revision: number;
  updatedAt: number;
};

export class ExperienceDraftConflictError extends Error {
  constructor() {
    super('Experience draft was changed in another tab.');
    this.name = 'ExperienceDraftConflictError';
  }
}

function isStoredExperienceDraft(value: unknown): value is StoredExperienceDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredExperienceDraft>;
  const formData = draft.formData as Partial<ExperienceFormState> | undefined;

  return (
    typeof draft.userId === 'string' &&
    typeof draft.schemaVersion === 'number' &&
    typeof draft.revision === 'number' &&
    typeof draft.updatedAt === 'number' &&
    typeof draft.expiresAt === 'number' &&
    typeof draft.step === 'number' &&
    typeof draft.isCustomCity === 'boolean' &&
    typeof draft.tempInclusion === 'string' &&
    typeof draft.tempExclusion === 'string' &&
    Boolean(formData) &&
    Array.isArray(formData?.photos) &&
    Array.isArray(formData?.itinerary) &&
    Array.isArray(formData?.language_levels) &&
    typeof formData?.manual_content === 'object' &&
    formData?.manual_content !== null
  );
}

export function isExperienceDraftQuotaError(error: unknown) {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

export function sanitizeExperienceDraftFormData(formData: ExperienceFormState): ExperienceFormState {
  return {
    ...formData,
    photos: formData.photos.map((photo) => (photo.startsWith('blob:') ? '' : photo)),
    itinerary: formData.itinerary.map((item) => ({
      ...item,
      image_url: item.image_url?.startsWith('blob:') ? '' : item.image_url,
    })),
  };
}

export function isMeaningfulExperienceDraft(
  data: ExperienceDraftData,
  media: ExperienceDraftMedia
) {
  const form = data.formData;
  return (
    data.step > 1 ||
    data.isCustomCity ||
    data.tempInclusion.trim().length > 0 ||
    data.tempExclusion.trim().length > 0 ||
    form.city.trim().length > 0 ||
    form.category.trim().length > 0 ||
    form.language_levels.length > 0 ||
    Object.values(form.manual_content).some(
      (content) => Boolean(content?.title.trim() || content?.description.trim())
    ) ||
    form.location.trim().length > 0 ||
    form.meeting_point.trim().length > 0 ||
    form.inclusions.length > 0 ||
    form.exclusions.length > 0 ||
    form.supplies.trim().length > 0 ||
    form.rules.age_limit.trim().length > 0 ||
    Boolean(form.rules.host_notice?.trim()) ||
    media.heroFiles.length > 0 ||
    media.itineraryFiles.some(Boolean)
  );
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function openDraftDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE, { keyPath: 'userId' });
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked.'));
  });
}

export async function loadExperienceDraft(userId: string): Promise<LoadedExperienceDraft | null> {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction([DRAFT_STORE, MEDIA_STORE], 'readonly');
    const done = transactionDone(transaction);
    const draftRequest = transaction.objectStore(DRAFT_STORE).get(userId);
    const mediaRequest = transaction.objectStore(MEDIA_STORE).get(userId);
    const [draft, media] = await Promise.all([
      requestResult(draftRequest) as Promise<StoredExperienceDraft | undefined>,
      requestResult(mediaRequest) as Promise<StoredExperienceDraftMedia | undefined>,
    ]);
    await done;

    if (!draft) return null;
    if (
      !isStoredExperienceDraft(draft) ||
      draft.schemaVersion !== EXPERIENCE_DRAFT_SCHEMA_VERSION ||
      draft.expiresAt <= Date.now()
    ) {
      await deleteExperienceDraft(userId);
      return null;
    }

    const heroFiles = Array.isArray(media?.heroFiles)
      ? media.heroFiles.filter((file): file is File => file instanceof File)
      : [];
    const itineraryFiles = Array.isArray(media?.itineraryFiles)
      ? media.itineraryFiles.map((file) => (file instanceof File ? file : null))
      : draft.formData.itinerary.map(() => null);

    return {
      data: {
        step: draft.step,
        formData: draft.formData,
        isCustomCity: draft.isCustomCity,
        tempInclusion: draft.tempInclusion,
        tempExclusion: draft.tempExclusion,
      },
      media: {
        heroFiles,
        itineraryFiles,
      },
      revision: draft.revision,
      updatedAt: draft.updatedAt,
    };
  } finally {
    database.close();
  }
}

type SaveExperienceDraftOptions = {
  userId: string;
  data: ExperienceDraftData;
  expectedRevision: number;
  media?: ExperienceDraftMedia;
  clearMedia?: boolean;
  now?: number;
};

export async function saveExperienceDraft({
  userId,
  data,
  expectedRevision,
  media,
  clearMedia = false,
  now = Date.now(),
}: SaveExperienceDraftOptions) {
  const database = await openDraftDatabase();
  try {
    const stores = media || clearMedia ? [DRAFT_STORE, MEDIA_STORE] : [DRAFT_STORE];
    const transaction = database.transaction(stores, 'readwrite');
    const done = transactionDone(transaction);
    const draftStore = transaction.objectStore(DRAFT_STORE);
    const existing = (await requestResult(draftStore.get(userId))) as StoredExperienceDraft | undefined;
    const currentRevision = existing?.revision ?? 0;

    if (currentRevision !== expectedRevision) {
      transaction.abort();
      await done.catch(() => undefined);
      throw new ExperienceDraftConflictError();
    }

    const revision = currentRevision + 1;
    draftStore.put({
      ...data,
      formData: sanitizeExperienceDraftFormData(data.formData),
      userId,
      schemaVersion: EXPERIENCE_DRAFT_SCHEMA_VERSION,
      revision,
      updatedAt: now,
      expiresAt: now + EXPERIENCE_DRAFT_RETENTION_MS,
    } satisfies StoredExperienceDraft);

    if (media) {
      transaction.objectStore(MEDIA_STORE).put({
        ...media,
        userId,
      } satisfies StoredExperienceDraftMedia);
    } else if (clearMedia) {
      transaction.objectStore(MEDIA_STORE).delete(userId);
    }

    await done;
    return { revision, updatedAt: now };
  } finally {
    database.close();
  }
}

export async function deleteExperienceDraft(userId: string) {
  const database = await openDraftDatabase();
  try {
    const transaction = database.transaction([DRAFT_STORE, MEDIA_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(DRAFT_STORE).delete(userId);
    transaction.objectStore(MEDIA_STORE).delete(userId);
    await done;
  } finally {
    database.close();
  }
}
