import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ExperienceItineraryTranslationItem,
  ExperienceLocale,
  ExperienceRulesTranslationInput,
} from '@/app/utils/experienceTranslation';

export type TranslationRequest = {
  sourceLocale: ExperienceLocale;
  targetLocale: ExperienceLocale;
  title: string;
  description: string;
  category: string;
  meetingPoint: string;
  supplies: string;
  inclusions: string[];
  exclusions: string[];
  itinerary: ExperienceItineraryTranslationItem[];
  rules: ExperienceRulesTranslationInput;
  model: string;
};

export type TranslationResult = {
  title: string;
  description: string;
  meetingPoint: string;
  supplies: string;
  inclusions: string[];
  exclusions: string[];
  itinerary: ExperienceItineraryTranslationItem[];
  rules: ExperienceRulesTranslationInput;
  totalTokens: number;
};

type ParsedProviderError = {
  status: number | null;
  retryable: boolean;
  quota: boolean;
  cooldownSeconds: number | null;
};

export class TranslationProviderError extends Error {
  provider: 'gemini' | 'grok';
  retryable: boolean;
  quota: boolean;
  cooldownSeconds: number | null;

  constructor(params: {
    provider: 'gemini' | 'grok';
    message: string;
    retryable: boolean;
    quota?: boolean;
    cooldownSeconds?: number | null;
  }) {
    super(params.message);
    this.provider = params.provider;
    this.retryable = params.retryable;
    this.quota = Boolean(params.quota);
    this.cooldownSeconds = params.cooldownSeconds ?? null;
  }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const localeLabelMap: Record<ExperienceLocale, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

function buildTranslationPrompt(request: TranslationRequest) {
  const sourceLabel = localeLabelMap[request.sourceLocale];
  const targetLabel = localeLabelMap[request.targetLocale];

  return `
You translate travel experience listings for a marketplace similar to Airbnb Experiences.

Task:
- Translate every guest-facing content field from ${sourceLabel} to ${targetLabel}.
- Keep the tone warm, inviting, polished, and host-like.
- Do not invent facts, places, inclusions, restrictions, or promises that are not in the source.
- Preserve proper nouns, neighborhood names, station names, and brand names unless a natural localized form is clearly standard.
- For exact addresses or map-oriented wording, keep the place precise and usable.
- The title should feel attractive and natural, but never clickbait.
- The description should sound like a confident local host introducing a real experience.

Output rules:
- Return JSON only.
- JSON schema:
{
  "title": "translated title",
  "description": "translated description",
  "meeting_point": "translated meeting point",
  "supplies": "translated what to bring",
  "inclusions": ["translated inclusion 1"],
  "exclusions": ["translated exclusion 1"],
  "itinerary": [
    {
      "title": "translated stop title",
      "description": "translated stop description"
    }
  ],
  "rules": {
    "age_limit": "translated age limit",
    "activity_level": "translated activity level",
    "refund_policy": "translated refund policy"
  }
}

Source category:
${request.category}

Source title:
${request.title}

Source description:
${request.description}

Source meeting point:
${request.meetingPoint}

Source inclusions:
${JSON.stringify(request.inclusions, null, 2)}

Source exclusions:
${JSON.stringify(request.exclusions, null, 2)}

Source supplies:
${request.supplies}

Source itinerary:
${JSON.stringify(
    request.itinerary.map((item) => ({
      title: item.title,
      description: item.description,
    })),
    null,
    2
  )}

Source rules:
${JSON.stringify(request.rules, null, 2)}
`;
}

function stripJsonCodeFence(raw: string) {
  let text = raw.trim();

  if (text.startsWith('```json')) {
    text = text.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return text;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => asTrimmedString(entry))
    .filter(Boolean);
}

function parseItinerary(
  value: unknown,
  source: ExperienceItineraryTranslationItem[]
) {
  const rawItems = Array.isArray(value) ? value : [];

  return source.map((sourceItem, index) => {
    const raw = rawItems[index];
    const next = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    return {
      title: asTrimmedString(next.title) || sourceItem.title,
      description: asTrimmedString(next.description) || sourceItem.description,
      type: sourceItem.type,
      image_url: sourceItem.image_url,
    };
  });
}

function parseRules(
  value: unknown,
  source: ExperienceRulesTranslationInput
): ExperienceRulesTranslationInput {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    age_limit: asTrimmedString(raw.age_limit) || source.age_limit,
    activity_level: asTrimmedString(raw.activity_level) || source.activity_level,
    refund_policy: asTrimmedString(raw.refund_policy) || source.refund_policy,
  };
}

function parseTranslationJson(
  rawText: string,
  provider: 'gemini' | 'grok',
  request: TranslationRequest
) {
  const text = stripJsonCodeFence(rawText);

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const title = asTrimmedString(parsed.title);
    const description = asTrimmedString(parsed.description);

    if (!title || !description) {
      throw new Error('Missing translated title or description');
    }

    return {
      title,
      description,
      meetingPoint: asTrimmedString(parsed.meeting_point) || request.meetingPoint,
      supplies: asTrimmedString(parsed.supplies) || request.supplies,
      inclusions: asStringArray(parsed.inclusions).length > 0 ? asStringArray(parsed.inclusions) : request.inclusions,
      exclusions: asStringArray(parsed.exclusions).length > 0 ? asStringArray(parsed.exclusions) : request.exclusions,
      itinerary: parseItinerary(parsed.itinerary, request.itinerary),
      rules: parseRules(parsed.rules, request.rules),
    };
  } catch {
    throw new TranslationProviderError({
      provider,
      message: `${provider} returned invalid JSON`,
      retryable: true,
    });
  }
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const diffSeconds = Math.ceil((date.getTime() - Date.now()) / 1000);
    return diffSeconds > 0 ? diffSeconds : null;
  }

  return null;
}

function parseProviderError(
  provider: 'gemini' | 'grok',
  status: number | null,
  message: string,
  retryAfterSeconds?: number | null
): ParsedProviderError {
  const normalizedMessage = message.toLowerCase();
  const inferredStatus = status ?? inferStatusFromMessage(normalizedMessage);
  const isTemporaryOverload = normalizedMessage.includes('service unavailable')
    || normalizedMessage.includes('currently experiencing high demand')
    || normalizedMessage.includes('please try again later');
  const isQuota = inferredStatus === 429
    || normalizedMessage.includes('quota')
    || normalizedMessage.includes('rate limit')
    || normalizedMessage.includes('too many requests');
  const retryable = isQuota
    || isTemporaryOverload
    || inferredStatus === 408
    || inferredStatus === 409
    || inferredStatus === 425
    || inferredStatus === 500
    || inferredStatus === 502
    || inferredStatus === 503
    || inferredStatus === 504;
  const defaultCooldown = provider === 'gemini' ? 90 : 30;

  return {
    status: inferredStatus,
    retryable,
    quota: isQuota,
    cooldownSeconds: isQuota || isTemporaryOverload ? (retryAfterSeconds ?? defaultCooldown) : null,
  };
}

function inferStatusFromMessage(message: string): number | null {
  const bracketedMatch = message.match(/\[(\d{3})\b/);
  if (bracketedMatch) {
    return Number(bracketedMatch[1]);
  }

  const statusMatch = message.match(/\b(408|409|425|429|500|502|503|504)\b/);
  if (statusMatch) {
    return Number(statusMatch[1]);
  }

  return null;
}

function toProviderError(
  provider: 'gemini' | 'grok',
  status: number | null,
  message: string,
  retryAfterSeconds?: number | null
) {
  const parsed = parseProviderError(provider, status, message, retryAfterSeconds);

  return new TranslationProviderError({
    provider,
    message,
    retryable: parsed.retryable,
    quota: parsed.quota,
    cooldownSeconds: parsed.cooldownSeconds,
  });
}

export async function translateWithGemini(request: TranslationRequest): Promise<TranslationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new TranslationProviderError({
      provider: 'gemini',
      message: 'GEMINI_API_KEY is not set',
      retryable: false,
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: request.model });
    const result = await model.generateContent(buildTranslationPrompt(request));
    const response = result.response;
    const usage = response.usageMetadata;
    const text = response.text().trim();
    const parsed = parseTranslationJson(text, 'gemini', request);

    return {
      ...parsed,
      totalTokens: Number(usage?.totalTokenCount || 0),
    };
  } catch (error) {
    if (error instanceof TranslationProviderError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Gemini translation failed';
    const parsed = parseProviderError('gemini', null, message);

    throw new TranslationProviderError({
      provider: 'gemini',
      message,
      retryable: parsed.retryable,
      quota: parsed.quota,
      cooldownSeconds: parsed.cooldownSeconds,
    });
  }
}

export async function translateWithGrok(request: TranslationRequest): Promise<TranslationResult> {
  if (!process.env.XAI_API_KEY) {
    throw new TranslationProviderError({
      provider: 'grok',
      message: 'XAI_API_KEY is not set',
      retryable: false,
    });
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a senior travel copywriter who outputs valid JSON only.',
        },
        {
          role: 'user',
          content: buildTranslationPrompt(request),
        },
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw toProviderError(
      'grok',
      response.status,
      bodyText || 'Grok translation failed',
      parseRetryAfterSeconds(response.headers.get('retry-after'))
    );
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const rawText = data.choices?.[0]?.message?.content || '';
  const parsed = parseTranslationJson(rawText, 'grok', request);

  return {
    ...parsed,
    totalTokens: Number(data.usage?.total_tokens || 0),
  };
}
