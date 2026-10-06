// Offline operator decoder: pinned Miniflare Images uses this same sharp dependency.
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.resolve('miniflare'))('sharp');
async function read(stream){return Buffer.from(await new Response(stream).arrayBuffer());}
export const communityLocalDecoder={
 async info(stream){return sharp(await read(stream),{failOn:'warning',limitInputPixels:100000000}).metadata();},
 input(stream){return {transform(options){return {async output(){const bytes=await sharp(await read(stream),{failOn:'warning',limitInputPixels:100000000}).resize(options.width,options.height,{fit:options.fit}).png().toBuffer();return {response:()=>new Response(bytes,{headers:{'content-type':'image/png'}})};}};}};}
};
