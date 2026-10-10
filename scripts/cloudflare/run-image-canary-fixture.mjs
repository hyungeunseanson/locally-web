// Isolated Next app: test data can never become a Production route or server flag.
import {mkdtemp,cp,writeFile,symlink,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
await mkdir('.tmp',{recursive:true});
const dir=await mkdtemp(path.join(root,'.tmp/image-canary-'));
await cp('tests/fixtures/image-canary',dir,{recursive:true});
await symlink(path.join(root,'node_modules'),path.join(dir,'node_modules'));
await writeFile(path.join(dir,'package.json'),JSON.stringify({private:true}));
await writeFile(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','esnext'],jsx:'react-jsx',module:'esnext',moduleResolution:'bundler',esModuleInterop:true,allowJs:true,skipLibCheck:true,paths:{'@/*':[root+'/*']}},exclude:['node_modules']}));
await writeFile(path.join(dir,'next.config.mjs'),`export default {devIndicators:false,webpack(config){config.resolve.alias['@']=${JSON.stringify(root)};return config;}};`);
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',dir,'--webpack','--hostname','127.0.0.1','--port','3117'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL:'https://media-canary.locally-travel.com',NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',async code=>{await rm(dir,{recursive:true,force:true});process.exit(code??1);});
