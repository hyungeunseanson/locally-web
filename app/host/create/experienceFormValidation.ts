import { isValidSoloGuaranteePrice } from '@/app/constants/soloGuarantee';
import { getManualLocalesFromLanguageLevels } from '@/app/utils/experienceTranslation';
import { MAX_EXPERIENCE_PHOTOS } from './config';
import type { ExperienceFormState } from './experienceFormState';

export type ExperienceFormIssueCode =
  | 'city_required'
  | 'category_required'
  | 'languages_required'
  | 'language_level_invalid'
  | 'source_locale_invalid'
  | 'title_too_short'
  | 'photos_required'
  | 'photos_too_many'
  | 'meeting_point_required'
  | 'location_required'
  | 'itinerary_title_required'
  | 'description_too_short'
  | 'inclusions_required'
  | 'inclusion_too_short'
  | 'inclusion_duplicate'
  | 'exclusion_too_short'
  | 'exclusion_duplicate'
  | 'supplies_too_short'
  | 'duration_invalid'
  | 'max_guests_invalid'
  | 'age_limit_required'
  | 'price_invalid'
  | 'solo_guarantee_price_invalid'
  | 'private_price_required';

export type ExperienceFormIssue = {
  step: number;
  field: string;
  code: ExperienceFormIssueCode;
};

export type ExperienceListDraftResult = {
  formData: ExperienceFormState;
  tempInclusion: string;
  tempExclusion: string;
  issues: ExperienceFormIssue[];
};

export function normalizeExperienceListItem(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizedListItems(items: string[]) {
  return items.map((item) => normalizeExperienceListItem(item)).filter(Boolean);
}

function hasDuplicateItems(items: string[]) {
  const normalized = items.map((item) => item.toLocaleLowerCase());
  return new Set(normalized).size !== normalized.length;
}

export function prepareExperienceListDrafts(
  formData: ExperienceFormState,
  tempInclusion: string,
  tempExclusion: string
): ExperienceListDraftResult {
  const inclusion = normalizeExperienceListItem(tempInclusion);
  const exclusion = normalizeExperienceListItem(tempExclusion);
  const existingInclusions = normalizedListItems(formData.inclusions);
  const existingExclusions = normalizedListItems(formData.exclusions);
  const issues: ExperienceFormIssue[] = [];

  if (inclusion.length === 1) {
    issues.push({ step: 5, field: 'inclusion-draft', code: 'inclusion_too_short' });
  } else if (inclusion && existingInclusions.some((item) => item.toLocaleLowerCase() === inclusion.toLocaleLowerCase())) {
    issues.push({ step: 5, field: 'inclusion-draft', code: 'inclusion_duplicate' });
  }

  if (exclusion.length === 1) {
    issues.push({ step: 5, field: 'exclusion-draft', code: 'exclusion_too_short' });
  } else if (exclusion && existingExclusions.some((item) => item.toLocaleLowerCase() === exclusion.toLocaleLowerCase())) {
    issues.push({ step: 5, field: 'exclusion-draft', code: 'exclusion_duplicate' });
  }

  if (issues.length > 0) {
    return { formData, tempInclusion, tempExclusion, issues };
  }

  return {
    formData: {
      ...formData,
      inclusions: inclusion ? [...formData.inclusions, inclusion] : formData.inclusions,
      exclusions: exclusion ? [...formData.exclusions, exclusion] : formData.exclusions,
    },
    tempInclusion: inclusion ? '' : tempInclusion,
    tempExclusion: exclusion ? '' : tempExclusion,
    issues: [],
  };
}

export function validateExperienceStep(
  formData: ExperienceFormState,
  targetStep: number
): ExperienceFormIssue[] {
  const issues: ExperienceFormIssue[] = [];
  const manualLocales = getManualLocalesFromLanguageLevels(formData.language_levels || []);

  if (targetStep === 1) {
    if (!formData.city?.trim()) issues.push({ step: 1, field: 'city', code: 'city_required' });
    if (!formData.category?.trim()) issues.push({ step: 1, field: 'category', code: 'category_required' });
  }

  if (targetStep === 2) {
    if (!formData.language_levels || formData.language_levels.length === 0) {
      issues.push({ step: 2, field: 'languages', code: 'languages_required' });
    } else {
      if (formData.language_levels.some((entry) => !entry?.level || entry.level < 1 || entry.level > 5)) {
        issues.push({ step: 2, field: 'languages', code: 'language_level_invalid' });
      }
      if (!formData.source_locale || !manualLocales.includes(formData.source_locale)) {
        issues.push({ step: 2, field: 'source-locale', code: 'source_locale_invalid' });
      }
    }
  }

  if (targetStep === 3) {
    for (const locale of manualLocales) {
      const title = formData.manual_content?.[locale]?.title || '';
      if (title.trim().length < 6) {
        issues.push({ step: 3, field: `title-${locale}`, code: 'title_too_short' });
      }
    }
    if (!formData.photos || formData.photos.length < 1) {
      issues.push({ step: 3, field: 'photos', code: 'photos_required' });
    } else if (formData.photos.length > MAX_EXPERIENCE_PHOTOS) {
      issues.push({ step: 3, field: 'photos', code: 'photos_too_many' });
    }
  }

  if (targetStep === 4) {
    if (!formData.meeting_point?.trim()) {
      issues.push({ step: 4, field: 'meeting-point', code: 'meeting_point_required' });
    }
    if (!formData.location?.trim()) {
      issues.push({ step: 4, field: 'location', code: 'location_required' });
    }
    formData.itinerary.forEach((item, index) => {
      if (!item.title?.trim()) {
        issues.push({ step: 4, field: `itinerary-${index}-title`, code: 'itinerary_title_required' });
      }
    });
  }

  if (targetStep === 5) {
    for (const locale of manualLocales) {
      const description = formData.manual_content?.[locale]?.description || '';
      if (description.trim().length < 30) {
        issues.push({ step: 5, field: `description-${locale}`, code: 'description_too_short' });
      }
    }

    const inclusions = normalizedListItems(formData.inclusions);
    const exclusions = normalizedListItems(formData.exclusions);
    const supplies = formData.supplies.trim();

    if (inclusions.length === 0) {
      issues.push({ step: 5, field: 'inclusions', code: 'inclusions_required' });
    } else {
      if (inclusions.some((item) => item.length < 2)) {
        issues.push({ step: 5, field: 'inclusions', code: 'inclusion_too_short' });
      }
      if (hasDuplicateItems(inclusions)) {
        issues.push({ step: 5, field: 'inclusions', code: 'inclusion_duplicate' });
      }
    }

    if (exclusions.some((item) => item.length < 2)) {
      issues.push({ step: 5, field: 'exclusions', code: 'exclusion_too_short' });
    }
    if (exclusions.length > 0 && hasDuplicateItems(exclusions)) {
      issues.push({ step: 5, field: 'exclusions', code: 'exclusion_duplicate' });
    }
    if (supplies && supplies.length < 4) {
      issues.push({ step: 5, field: 'supplies', code: 'supplies_too_short' });
    }
  }

  if (targetStep === 6) {
    if (!Number.isFinite(formData.duration) || formData.duration <= 0) {
      issues.push({ step: 6, field: 'duration', code: 'duration_invalid' });
    }
    if (!Number.isFinite(formData.maxGuests) || formData.maxGuests <= 0) {
      issues.push({ step: 6, field: 'max-guests', code: 'max_guests_invalid' });
    }
    if (!formData.rules?.age_limit?.trim()) {
      issues.push({ step: 6, field: 'age-limit', code: 'age_limit_required' });
    }
  }

  if (targetStep === 7) {
    if (!Number.isFinite(Number(formData.price)) || Number(formData.price) <= 0) {
      issues.push({ step: 7, field: 'price', code: 'price_invalid' });
    }
    if (!isValidSoloGuaranteePrice(formData.solo_guarantee_price)) {
      issues.push({ step: 7, field: 'solo-guarantee-price', code: 'solo_guarantee_price_invalid' });
    }
    if (formData.is_private_enabled && (!Number.isFinite(Number(formData.private_price)) || Number(formData.private_price) <= 0)) {
      issues.push({ step: 7, field: 'private-price', code: 'private_price_required' });
    }
  }

  return issues;
}

export function validateExperienceForm(formData: ExperienceFormState) {
  return Array.from({ length: 7 }, (_, index) => index + 1).flatMap((step) =>
    validateExperienceStep(formData, step)
  );
}
