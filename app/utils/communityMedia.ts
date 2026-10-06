import { COMMUNITY_BASE_URL, COMMUNITY_BUCKET, COMMUNITY_CACHE_CONTROL, communityKey, communityOwnerScope } from './communityMediaContract.mjs';
import { CommunityMediaError, validateCommunityRaster, type CommunityImageDecoder } from './communityRaster';
export { CommunityMediaError } from './communityRaster';
import { mediaByteSha } from './mediaLifecycle';
type CommunityR2Object = {size:number;httpMetadata?:{contentType?:string;cacheControl?:string;contentDisposition?:string};customMetadata?:Record<string,string>};
export type CommunitySourceR2 = {
 head(key:string):Promise<CommunityR2Object|null>;
 get?(key:string):Promise<(CommunityR2Object & {arrayBuffer():Promise<ArrayBuffer>})|null>;
 put(key:string,value:Uint8Array,options:{onlyIf:{etagDoesNotMatch:'*'};httpMetadata:{contentType:string;cacheControl:string;contentDisposition?:string};customMetadata:Record<string,string>;sha256:string}):Promise<CommunityR2Object|null>;
};
export type CommunityRegistry = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}> };
export type CommunityAsset = { id: string; owner_id: string; business_scope: string; parent_type: string; parent_id: string; bucket: string; provider: string; object_key: string; public_url: string; expected_sha256: string; expected_size: number; mime: string; state: string; uploaded_at?: string; verified_at?: string };
async function rpc(registry: CommunityRegistry, name: string, args: Record<string, unknown>) {
  const {data,error} = await registry.rpc(name,args);
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row !== 'object' || !('id' in row)) throw new CommunityMediaError('community_registry_conflict',409);
  return row as CommunityAsset;
}
function assertAsset(asset: CommunityAsset, owner: string, sha: string, size: number, mime: string) {
  if (asset.owner_id !== owner || asset.business_scope !== 'community' || asset.provider !== 'r2' || asset.bucket !== COMMUNITY_BUCKET
    || asset.parent_type !== 'community_owner' || asset.parent_id !== owner || asset.expected_sha256 !== sha || Number(asset.expected_size) !== size || asset.mime !== mime
    || !['pending','committed'].includes(asset.state) || asset.object_key !== communityKey(owner,asset.id) || asset.public_url !== COMMUNITY_BASE_URL+'/'+asset.object_key) throw new CommunityMediaError('community_identity_mismatch',409);
}
export async function verifyCommunityBytes(binding: CommunitySourceR2, asset: CommunityAsset) {
  const metadata = {schema:'community-source-v1',asset_id:asset.id,owner_scope_sha256:communityOwnerScope(asset.owner_id),source_authority:'r2',source_byte_sha256:asset.expected_sha256};
  const exact = (o: Awaited<ReturnType<CommunitySourceR2['head']>>) => o && o.size === Number(asset.expected_size) && o.httpMetadata?.contentType === asset.mime && o.httpMetadata?.cacheControl === COMMUNITY_CACHE_CONTROL && Object.entries(metadata).every(([k,v])=>o.customMetadata?.[k]===v);
  if (!exact(await binding.head(asset.object_key)) || !binding.get) throw new CommunityMediaError('community_head_mismatch');
  const object = await binding.get(asset.object_key);
  if (!object || !exact(object)) throw new CommunityMediaError('community_get_mismatch');
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length !== Number(asset.expected_size) || await mediaByteSha(bytes) !== asset.expected_sha256) throw new CommunityMediaError('community_byte_mismatch');
}
/** Upload prepares owned bytes; only the later Community post save attaches a reference. */
export async function prepareCommunityAsset(input: {registry: CommunityRegistry; binding: CommunitySourceR2; actorId: string; ownerId: string; bytes: Uint8Array; contentType: string; decoder: CommunityImageDecoder; assetId?: string; idempotencyKey?: string}) {
  if (input.actorId !== input.ownerId) throw new CommunityMediaError('community_owner_required',403);
  const mime = await validateCommunityRaster(input.bytes,input.contentType,input.decoder), sha = await mediaByteSha(input.bytes), id = input.assetId ?? crypto.randomUUID();
  const key = communityKey(input.ownerId,id), token = input.idempotencyKey ?? await mediaByteSha(new TextEncoder().encode('community-upload:'+input.ownerId+':'+id));
  if (!/^[a-f0-9]{64}$/.test(token)) throw new CommunityMediaError('community_token_invalid',400);
  const asset = await rpc(input.registry,'begin_community_media_asset',{p_id:id,p_owner_id:input.ownerId,p_key:key,p_url:COMMUNITY_BASE_URL+'/'+key,p_sha256:sha,p_size:input.bytes.length,p_mime:mime,p_idempotency_key:token});
  assertAsset(asset,input.ownerId,sha,input.bytes.length,mime);
  try {
    if (!await input.binding.head(key)) await input.binding.put(key,input.bytes,{onlyIf:{etagDoesNotMatch:'*'},sha256:sha,httpMetadata:{contentType:mime,cacheControl:COMMUNITY_CACHE_CONTROL},customMetadata:{schema:'community-source-v1',asset_id:id,owner_scope_sha256:communityOwnerScope(input.ownerId),source_authority:'r2',source_byte_sha256:sha}});
    await rpc(input.registry,'mark_community_media_uploaded',{p_id:id,p_owner_id:input.ownerId,p_sha256:sha,p_size:input.bytes.length,p_mime:mime});
    await verifyCommunityBytes(input.binding,asset);
  } catch(e) { if(e instanceof CommunityMediaError)throw e;throw new CommunityMediaError('community_provider_unavailable'); }
  const verified = await rpc(input.registry,'verify_community_media_asset',{p_id:id,p_owner_id:input.ownerId,p_sha256:sha,p_size:input.bytes.length,p_mime:mime});
  assertAsset(verified,input.ownerId,sha,input.bytes.length,mime);
  if(!verified.verified_at||!verified.uploaded_at)throw new CommunityMediaError('community_not_verified');
  return verified;
}
