import {expect,test} from '@playwright/test';
test('current public homepage renders a real experience with a loaded image',async({page})=>{
  const requests: {method:string;url:string}[]=[];
  await page.route('**/*',async route=>{
    const req=route.request();
    if(!['GET','HEAD'].includes(req.method())) return route.abort();
    requests.push({method:req.method(),url:req.url()});
    return route.continue();
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const announcement=page.getByTestId('global-site-announcement-primary');
  if(await announcement.isVisible()) await announcement.click();
  const card=page.locator('a[href^="/experiences/"]:visible').filter({has:page.locator('img')}).first();
  await expect(card).toBeVisible({timeout:30000});
  await expect.poll(()=>card.locator('img').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:30000}).toBe(true);
  await test.info().attach('public-image-evidence',{body:JSON.stringify({href:await card.getAttribute('href'),image:await card.locator('img').first().getAttribute('src'),homeApiRequests:requests.filter(r=>r.url.includes('/api/home/experiences')).length,writeRequestsSent:0}),contentType:'application/json'});
  await test.info().attach('public-dom',{body:await page.content(),contentType:'text/html'});
});
