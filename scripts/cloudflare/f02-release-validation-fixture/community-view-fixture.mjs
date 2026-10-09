// Local read-only page fixture, never an allowance to send this DB write.
export async function isolateCommunityView(context, origin, postId) {
 const receipts=[];
 await context.route('**/*', async route=>{
  const request=route.request(),url=new URL(request.url());
  let body,frame;try{body=JSON.parse(request.postData()??'');frame=new URL(request.frame().url())}catch{}
  if(url.origin!==origin||url.pathname!=='/api/community/views'||url.search||request.method()!=='POST'||frame?.origin!==origin||frame?.pathname!=='/community/'+postId||body?.postId!==postId||Object.keys(body).sort().join(',')!=='knownViewCount,postId'||!Number.isSafeInteger(body.knownViewCount)||body.knownViewCount<1) return route.fallback();
  receipts.push({pathname:url.pathname,postId,method:'POST',classification:'EXACT_LOCAL_VIEW_COUNTER_FIXTURE',forwarded:false});
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,counted:false,viewCount:body.knownViewCount,fixture:true})});
 });
 return receipts;
}
