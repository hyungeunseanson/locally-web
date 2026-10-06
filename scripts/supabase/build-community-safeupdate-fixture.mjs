// Build the pinned upstream test-only module against PostgreSQL 17 headers.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const output=process.env.COMMUNITY_SAFEUPDATE_LIBRARY;
assert(output && output.startsWith('/'), 'absolute fixture output required');
const dir=await mkdtemp(join(tmpdir(),'community-safeupdate-build-'));
const run=(cmd,args,cwd=dir)=>{const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr || r.stdout);};
try {
  const source=resolve('tests/fixtures/pg-safeupdate/safeupdate.c');
  assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'),'986515e91c4963a81ba211cae8a02079e62e0278678a894a9660797830f30cdf');
  let headers=process.env.COMMUNITY_PG17_HEADERS;
  if (!headers) {
    const response=await fetch('https://ftp.postgresql.org/pub/source/v17.6/postgresql-17.6.tar.bz2',{redirect:'error',signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,200);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'e0630a3600aea27511715563259ec2111cd5f4353a4b040e0be827f94cd7a8b0');
    await writeFile(join(dir,'pg.tar.bz2'),bytes);
    run('tar',['-xjf','pg.tar.bz2']);
    const pg=join(dir,'postgresql-17.6');
    run('./configure',['--without-icu','--without-readline','--without-zlib'],pg);
    run('make',['-C','src/backend','generated-headers','-j2'],pg);
    headers=join(pg,'src/include');
  }
  assert.match(await readFile(join(headers,'pg_config.h'),'utf8'),/#define PG_VERSION_NUM 17\d{4}\b/);
  run(process.platform==='darwin'?'clang':'cc',[
    ...(process.platform==='darwin'?['-bundle','-undefined','dynamic_lookup']:['-fPIC','-shared']),
    '-I'+headers,'-I'+join(headers,'../backend'),source,'-o',output,
  ]);
  console.log('COMMUNITY_SAFEUPDATE_UPSTREAM_PG17_FIXTURE_BUILD PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
