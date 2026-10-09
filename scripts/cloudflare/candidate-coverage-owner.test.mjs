import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { coverageOwnerFor } from './candidate-coverage-owner.mjs';
const origin='http://127.0.0.1:31899',url=origin+'/_next/static/chunks/coverage.js';
const source='window.coverageFixture=(window.coverageFixture||0)+1;\n//# sourceURL='+url;
const sha=createHash('sha256').update(source).digest('hex');
const launch=()=>chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const positive=rows=>rows.filter(r=>r.url===url).some(r=>r.functions.some(f=>f.ranges.some(range=>range.count>0)));
const count=snapshot=>snapshot.scripts.filter(s=>s.pathname==='/_next/static/chunks/coverage.js').flatMap(s=>s.ranges).reduce((sum,r)=>sum+r.count,0);

test('old duplicate consumers lose execution counts in both orders on the same target', {timeout:15000},async()=>{
  const browser=await launch(),context=await browser.newContext(),evidence=[];
  try {
    for(const first of ['recorder','gate']){
      const page=await context.newPage();await page.goto('data:text/html,fixture');
      const sessions={recorder:await context.newCDPSession(page),gate:await context.newCDPSession(page)},audit=[];
      const send=async(caller,method,params)=>{audit.push({caller,method,ms:performance.now()});return sessions[caller].send(method,params);};
      const targets=[];
      for(const caller of ['recorder','gate']){
        targets.push((await send(caller,'Target.getTargetInfo')).targetInfo.targetId);
        await send(caller,'Debugger.enable');await send(caller,'Profiler.enable');await send(caller,'Profiler.startPreciseCoverage',{callCount:true,detailed:true});
      }
      assert.equal(targets[0],targets[1]);await send('gate','Runtime.evaluate',{expression:source});
      const second=first==='recorder'?'gate':'recorder';
      const a=await send(first,'Profiler.takePreciseCoverage'),b=await send(second,'Profiler.takePreciseCoverage');
      assert.equal(positive(a.result),true);assert.equal(positive(b.result),false);
      evidence.push({first,second,sameTarget:true,firstHasExecutedScript:true,secondLostExecution:true,audit});
      for(const session of Object.values(sessions)){await session.send('Profiler.stopPreciseCoverage').catch(()=>{});await session.detach();}
      await page.close();
    }
    if(process.env.COVERAGE_EVIDENCE_PATH)await writeFile(process.env.COVERAGE_EVIDENCE_PATH,JSON.stringify(evidence,null,2));
  }finally{await context.close();await browser.close();}
});

test('one Owner shares immutable accumulated deltas without double counting and cleans up before close',{timeout:15000},async()=>{
  const browser=await launch(),context=await browser.newContext();
  try {
    const page=await context.newPage(),owner=coverageOwnerFor(page,origin),recorder=coverageOwnerFor(page,origin),published=[];
    assert.equal(owner,recorder);assert.throws(()=>coverageOwnerFor(page,'https://other.invalid'),{code:'candidate_coverage_owner_violation'});
    const session=await owner.ready;
    assert.throws(()=>session.send('Profiler.startPreciseCoverage'),{code:'candidate_coverage_owner_violation'});
    assert.throws(()=>session.send('Profiler.takePreciseCoverage'),{code:'candidate_coverage_owner_violation'});
    assert.equal(owner.prove(url,sha),null); // Missing snapshot cannot pass.
    owner.subscribe(s=>published.push(s));
    await page.goto('data:text/html,fixture');await session.send('Runtime.evaluate',{expression:source});
    const first=await owner.collect('recorder');assert(owner.prove(url,sha));assert.equal(first,published[0]);
    const second=await owner.collect('gate');assert(owner.prove(url,sha));assert.equal(count(first),count(second));
    assert.deepEqual(owner.read(),recorder.read());assert.throws(()=>{first.scripts[0].sha256='fake';},TypeError);
    const third=await owner.collect('recorder');assert.equal(count(first),count(third));
    assert.equal(owner.read().audit.filter(r=>r.method==='Profiler.startPreciseCoverage').length,1);
    // A new execution contributes a fresh delta once, even if consumers read twice.
    await session.send('Runtime.evaluate',{expression:source});await owner.collect('gate');
    const before=count(owner.read());await owner.collect('recorder');assert.equal(count(owner.read()),before);
    assert(before>count(first));
    const generation=owner.read().generation;
    await page.goto('data:text/html,next-context');await owner.collect('gate');
    assert(owner.read().generation>generation);assert.equal(owner.prove(url,sha),null);
    await page.close();const final=owner.read();assert.equal(final.finalized,true);assert.equal(final.cleanupComplete,true);
    assert.equal(final.audit.filter(r=>r.method==='Profiler.stopPreciseCoverage').length,1);
    assert.equal(final.audit.filter(r=>r.method==='Profiler.disable').length,1);
    await assert.rejects(owner.collect('gate'),{code:'candidate_coverage_owner_violation'});
  }finally{await context.close();await browser.close();}
});

test('parsed but unexecuted, missing snapshot, wrong hash and other page/context do not prove execution',{timeout:15000},async()=>{
  const browser=await launch(),context=await browser.newContext();
  try {
    const page=await context.newPage(),owner=coverageOwnerFor(page,origin),session=await owner.ready;
    await page.goto('data:text/html,fixture');
    await session.send('Runtime.compileScript',{expression:source,sourceURL:url,persistScript:true});
    await owner.collect('gate');assert.equal(owner.prove(url,sha),null);
    await session.send('Runtime.evaluate',{expression:source});assert.equal(owner.prove(url,sha),null);
    await owner.collect('gate');assert(owner.prove(url,sha));assert.equal(owner.prove(url,'0'.repeat(64)),null);
    const other=await context.newPage(),otherOwner=coverageOwnerFor(other,origin);await otherOwner.ready;await otherOwner.collect('gate');
    assert.notEqual(owner.ownerId,otherOwner.ownerId);assert.equal(otherOwner.prove(url,sha),null);
    await context.close();assert(owner.read().finalized&&otherOwner.read().finalized);
    assert(owner.read().cleanupComplete&&otherOwner.read().cleanupComplete);
  }finally{await context.close();await browser.close();}
});

test('execution before coverage starts is not synthesized into proof', {timeout:15000},async()=>{
  const browser=await launch(),context=await browser.newContext();
  try{const page=await context.newPage();await page.goto('data:text/html,fixture');const session=await context.newCDPSession(page);
    await session.send('Runtime.evaluate',{expression:source});await session.detach();
    const owner=coverageOwnerFor(page,origin);await owner.ready;await owner.collect('gate');assert.equal(owner.prove(url,sha),null);
  }finally{await context.close();await browser.close();}
});
