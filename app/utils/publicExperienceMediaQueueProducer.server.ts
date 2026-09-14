import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  schedulePublicExperienceMediaAfterWrite,
  type PublicExperienceMediaAfterWrite,
  type PublicExperienceMediaProducerLog,
} from './publicExperienceMediaQueueProducer';

function writeProducerLog(entry: PublicExperienceMediaProducerLog) {
  const serialized = JSON.stringify(entry);
  if (entry.status === 'enqueue_failed') {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}

export function schedulePublicExperienceMediaProducer(
  input: PublicExperienceMediaAfterWrite
) {
  try {
    return schedulePublicExperienceMediaAfterWrite(input, {
      loadRuntime: () => getCloudflareContext(),
      log: writeProducerLog,
    });
  } catch {
    return { status: 'context_unavailable' } as const;
  }
}
