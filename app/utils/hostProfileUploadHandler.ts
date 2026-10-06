import type { SupabaseClient } from '@supabase/supabase-js';
import type { HostProfileEnvironment } from './hostProfileMedia.server';
import { HOST_PROFILE_MAX_BYTES, hostProfileWriteAuthority } from './hostProfileMediaContract.mjs';
import { HostProfileMediaError, prepareHostProfileAsset, validateHostProfileImage } from './hostProfileMedia';
export function createHostProfileUploadHandler(deps: {createClient(): Promise<SupabaseClient>; createAdminClient(): SupabaseClient; loadRuntime(): HostProfileEnvironment | null}) {
  return async (request: Request) => {
    try {
      if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'host_profile_origin_required'},{status:403});
      const client=await deps.createClient(), {data:{user},error}=await client.auth.getUser();
      if(error||!user)return Response.json({error:'host_profile_auth_required'},{status:401});
      const env=deps.loadRuntime(),authority=hostProfileWriteAuthority(env,process.env.HOST_PROFILE_R2_SOURCE_ENABLED);
      const length=Number(request.headers.get('content-length'));
      if(!Number.isSafeInteger(length)||length<=0||length>HOST_PROFILE_MAX_BYTES+8192)return Response.json({error:'host_profile_size_invalid'},{status:413});
      const owned=await client.from('profiles').select('id').eq('id',user.id).single();
      if(owned.error||owned.data?.id!==user.id)return Response.json({error:'host_profile_owner_required'},{status:403});
      const form=await request.formData(), file=form.get('file');
      if([...form.keys()].some(k=>k!=='file')||form.getAll('file').length!==1||!(file instanceof File)||/\.(heic|heif)$/i.test(file.name))return Response.json({error:'host_profile_image_invalid'},{status:400});
      const bytes=new Uint8Array(await file.arrayBuffer()),mime=validateHostProfileImage(bytes,file.type);
      if(authority==='r2') {
        const asset=await prepareHostProfileAsset({registry:deps.createAdminClient(),binding:env!.PUBLIC_HOST_PROFILE_SOURCE_R2!,actorId:user.id,ownerId:user.id,bytes,contentType:mime});
        return Response.json({publicUrl:asset.public_url,assetId:asset.id,authority});
      }
      const key=`profile/${user.id}_${Date.now()}`;
      const uploaded=await client.storage.from('images').upload(key,bytes,{contentType:mime,upsert:false});
      if(uploaded.error)throw new HostProfileMediaError('host_profile_provider_unavailable');
      return Response.json({publicUrl:client.storage.from('images').getPublicUrl(key).data.publicUrl,authority});
    }catch(e){return Response.json({error:e instanceof HostProfileMediaError?e.code:e instanceof Error&&e.message==='host_profile_r2_unavailable'?e.message:'host_profile_upload_failed'},{status:e instanceof HostProfileMediaError?e.status:503});}
  };
}
