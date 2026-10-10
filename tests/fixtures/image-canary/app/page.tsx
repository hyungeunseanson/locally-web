import Client from './client';
import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '@/app/data/publicExperienceCardImages';
const fixtureSnapshotAt = Date.now();
export const dynamic = 'force-dynamic';
export default async function Page() {
  const [id, image] = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)[0]!;
  return <Client initialExperiences={[{id:Number(id), title:'SSR image canary', card_image_url:image.originUrl, public_image_r2_eligible:true, wishlist_count:0}]} updatedAt={fixtureSnapshotAt} />;
}
