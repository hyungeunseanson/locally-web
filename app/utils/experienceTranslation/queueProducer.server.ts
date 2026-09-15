import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { scheduleExperienceTranslationWake, type ExperienceTranslationProducerLog } from './queueProducer';
function log(entry: ExperienceTranslationProducerLog) { const serialized = JSON.stringify(entry); if (entry.status === 'enqueue_failed') console.error(serialized); else console.log(serialized); }
export function scheduleExperienceTranslationProducer() { try { return scheduleExperienceTranslationWake({ loadRuntime: () => getCloudflareContext() as never, log }); } catch { return { status: 'context_unavailable' } as const; } }
