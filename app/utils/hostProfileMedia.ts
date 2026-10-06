import { HOST_PROFILE_BASE_URL, HOST_PROFILE_BUCKET, HOST_PROFILE_CACHE_CONTROL, HOST_PROFILE_MAX_BYTES, hostProfileKey, hostProfileMime, hostProfileOwnerScope } from './hostProfileMediaContract.mjs';
import { hasExpectedExperienceImageMagic } from './experienceMediaSource';
import { mediaByteSha } from './mediaLifecycle';
type HostProfileR2Object = {size:number;httpMetadata?:{contentType?:string;cacheControl?:string;contentDisposition?:string};customMetadata?:Record<string,string>};
export type HostProfileSourceR2 = {
 head(key:string):Promise<HostProfileR2Object|null>;
 get?(key:string):Promise<(HostProfileR2Object & {arrayBuffer():Promise<ArrayBuffer>})|null>;
 put(key:string,value:Uint8Array,options:{onlyIf:{etagDoesNotMatch:'*'};httpMetadata:{contentType:string;cacheControl:string;contentDisposition?:string};customMetadata:Record<string,string>;sha256:string}):Promise<HostProfileR2Object|null>;
};
export class HostProfileMediaError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}
export type HostProfileRegistry = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}> };
export type HostProfileAsset = { id: string; owner_id: string; business_scope: string; parent_type: string; parent_id: string; bucket: string; provider: string; object_key: string; public_url: string; expected_sha256: string; expected_size: number; mime: string; state: string; uploaded_at?: string; verified_at?: string };
export function validateHostProfileImage(bytes: Uint8Array, value: string) {
  let mime: string;
  try { mime = hostProfileMime(value); } catch { throw new HostProfileMediaError('host_profile_mime_invalid',400); }
  if (!bytes.length || bytes.length > HOST_PROFILE_MAX_BYTES) throw new HostProfileMediaError('host_profile_size_invalid',413);
  const raster = ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
  const avif = mime !== 'image/avif' || (bytes.length >= 16 && new TextDecoder().decode(bytes.slice(4,8)) === 'ftyp' && /avif|avis/.test(new TextDecoder().decode(bytes.slice(8,Math.min(bytes.length,64)))));
  if (raster.includes(mime) && (!hasExpectedExperienceImageMagic(bytes,mime) || !avif)) throw new HostProfileMediaError('host_profile_magic_invalid',400);
  return mime;
}
async function rpc(registry: HostProfileRegistry, name: string, args: Record<string, unknown>) {
  const {data,error} = await registry.rpc(name,args);
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row !== 'object' || !('id' in row)) throw new HostProfileMediaError('host_profile_registry_conflict',409);
  return row as HostProfileAsset;
}
function assertAsset(asset: HostProfileAsset, owner: string, sha: string, size: number, mime: string) {
  if (asset.owner_id !== owner || asset.business_scope !== 'host_profile' || asset.provider !== 'r2' || asset.bucket !== HOST_PROFILE_BUCKET
    || asset.parent_type !== 'host_profile_owner' || asset.parent_id !== owner || asset.expected_sha256 !== sha || Number(asset.expected_size) !== size || asset.mime !== mime
    || !['pending','committed'].includes(asset.state) || asset.object_key !== hostProfileKey(owner,asset.id) || asset.public_url !== HOST_PROFILE_BASE_URL+'/'+asset.object_key) throw new HostProfileMediaError('host_profile_identity_mismatch',409);
}
export async function verifyHostProfileBytes(binding: HostProfileSourceR2, asset: HostProfileAsset) {
  const metadata = {schema:'host-profile-source-v1',asset_id:asset.id,owner_scope_sha256:hostProfileOwnerScope(asset.owner_id),source_authority:'r2',source_byte_sha256:asset.expected_sha256};
  const exact = (o: Awaited<ReturnType<HostProfileSourceR2['head']>>) => o && o.size === Number(asset.expected_size) && o.httpMetadata?.contentType === asset.mime && o.httpMetadata?.cacheControl === HOST_PROFILE_CACHE_CONTROL && (asset.mime !== 'image/svg+xml' || o.httpMetadata?.contentDisposition === 'attachment') && Object.entries(metadata).every(([k,v])=>o.customMetadata?.[k]===v);
  if (!exact(await binding.head(asset.object_key)) || !binding.get) throw new HostProfileMediaError('host_profile_head_mismatch');
  const object = await binding.get(asset.object_key);
  if (!object || !exact(object)) throw new HostProfileMediaError('host_profile_get_mismatch');
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.length !== Number(asset.expected_size) || await mediaByteSha(bytes) !== asset.expected_sha256) throw new HostProfileMediaError('host_profile_byte_mismatch');
}
/** Upload prepares owned bytes; only the later Host application save attaches a reference. */
export async function prepareHostProfileAsset(input: {registry: HostProfileRegistry; binding: HostProfileSourceR2; actorId: string; ownerId: string; bytes: Uint8Array; contentType: string; assetId?: string; idempotencyKey?: string}) {
  if (input.actorId !== input.ownerId) throw new HostProfileMediaError('host_profile_owner_required',403);
  const mime = validateHostProfileImage(input.bytes,input.contentType), sha = await mediaByteSha(input.bytes), id = input.assetId ?? crypto.randomUUID();
  const key = hostProfileKey(input.ownerId,id), token = input.idempotencyKey ?? await mediaByteSha(new TextEncoder().encode('host-profile-upload:'+input.ownerId+':'+id));
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HostProfileMediaError('host_profile_token_invalid',400);
  const asset = await rpc(input.registry,'begin_host_profile_media_asset',{p_id:id,p_owner_id:input.ownerId,p_key:key,p_url:HOST_PROFILE_BASE_URL+'/'+key,p_sha256:sha,p_size:input.bytes.length,p_mime:mime,p_idempotency_key:token});
  assertAsset(asset,input.ownerId,sha,input.bytes.length,mime);
  try {
    if (!await input.binding.head(key)) await input.binding.put(key,input.bytes,{onlyIf:{etagDoesNotMatch:'*'},sha256:sha,httpMetadata:{contentType:mime,cacheControl:HOST_PROFILE_CACHE_CONTROL,...(mime==='image/svg+xml'?{contentDisposition:'attachment'}:{})},customMetadata:{schema:'host-profile-source-v1',asset_id:id,owner_scope_sha256:hostProfileOwnerScope(input.ownerId),source_authority:'r2',source_byte_sha256:sha}});
    await verifyHostProfileBytes(input.binding,asset);
  } catch(e) { if(e instanceof HostProfileMediaError)throw e;throw new HostProfileMediaError('host_profile_provider_unavailable'); }
  const verified = await rpc(input.registry,'verify_host_profile_media_asset',{p_id:id,p_owner_id:input.ownerId,p_sha256:sha,p_size:input.bytes.length,p_mime:mime});
  assertAsset(verified,input.ownerId,sha,input.bytes.length,mime);
  if(!verified.verified_at||!verified.uploaded_at)throw new HostProfileMediaError('host_profile_not_verified');
  return verified;
}
