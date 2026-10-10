/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preload must use CommonJS before ESM tests load. */
const net=require('node:net');
const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const x=args[0];const host=typeof x==='object'&&!Array.isArray(x)?x.host:typeof args[1]==='string'?args[1]:null;if(host&&!['localhost','127.0.0.1','::1'].includes(host))throw new Error('AUDIT_EXTERNAL_NETWORK_BLOCKED');return originalConnect.apply(this,args);};
globalThis.fetch=async()=>{throw new Error('AUDIT_UNMOCKED_FETCH_BLOCKED');};
const Module=require('node:module');
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){if(request==='server-only')return {};return originalLoad.call(this,request,parent,isMain);};
Module.__locallyServerOnlyShimInstalled=true;
