import type { TargetContext } from "../../types";

export const ADMIN_PATHS=["/admin","/admin/","/admin/login","/admin/login/","/login","/login/","/signin","/signin/","/auth","/auth/login","/dashboard","/manage","/management","/administrator","/administrator/","/user/login","/account/login","/controlpanel","/cpanel","/backend","/wp-admin/","/wp-login.php","/ghost/","/adminpanel"] as const;
export const ADMIN_CONCURRENCY=2;
export type AdminClassification="LIKELY"|"PROTECTED"|"REDIRECT"|"UNLIKELY"|"NOT_FOUND"|"ERROR";
export interface AdminResult {path:string;url:string;finalUrl:string;status:number|null;classification:AdminClassification;confidence:"High"|"Medium"|"Low";title?:string;evidence:string[]}
type Fingerprint={status:number;finalUrl:string;finalPath:string;title:string;contentType:string;body:string;bucket:number;password:boolean;loginMarker:boolean};
const normalize=(text:string)=>text.toLowerCase().replace(/[\da-f]{8,}/g,"#").replace(/\s+/g," ").trim().slice(0,4096);
const fingerprint=async(response:Response):Promise<Fingerprint>=>{const text=(await response.text()).slice(0,65536);const source=text.trim()?text:"<!doctype html><html><head></head><body></body></html>";const doc=new DOMParser().parseFromString(source,"text/html");const title=(doc.querySelector("title")?.textContent??"").trim().slice(0,200);const body=normalize(text);return{status:response.status,finalUrl:response.url,finalPath:new URL(response.url).pathname,title,contentType:response.headers.get("content-type")??"",body,bucket:Math.round(body.length/256),password:Boolean(doc.querySelector('input[type="password"]')),loginMarker:/admin|log[ -]?in|sign[ -]?in|authentication/i.test(`${title} ${body.slice(0,1500)}`)}};
const read=async(url:string,signal:AbortSignal,fetcher:typeof fetch)=>{let response=await fetcher(url,{method:"HEAD",credentials:"omit",cache:"no-store",redirect:"follow",signal});if([405,501].includes(response.status)||/text\/html/i.test(response.headers.get("content-type")??""))response=await fetcher(url,{method:"GET",credentials:"omit",cache:"no-store",redirect:"follow",signal});return fingerprint(response)};
const same=(a:Fingerprint,b:Fingerprint)=>a.status===b.status&&a.bucket===b.bucket&&a.body===b.body;
export function adminUrl(target:TargetContext,path:string){const url=new URL(path,target.origin);if(url.origin!==target.origin)throw new Error("TARGET_UNAVAILABLE");return url.href}
export function classifyAdmin(path:string,value:Fingerprint,baseline:Fingerprint,origin:string):AdminResult{
  const url=new URL(path,origin).href, external=new URL(value.finalUrl).origin!==new URL(origin).origin;
  const redirected=value.finalPath!==new URL(url).pathname;
  if(value.status===401||value.status===403)return{path,url,finalUrl:value.finalUrl,status:value.status,classification:"PROTECTED",confidence:"High",evidence:[`HTTP ${value.status}`]};
  if(value.status===404||value.status===410)return{path,url,finalUrl:url,status:value.status,classification:"NOT_FOUND",confidence:"High",evidence:[`HTTP ${value.status}`]};
  if(same(value,baseline))return{path,url,finalUrl:value.finalUrl,status:value.status,classification:"UNLIKELY",confidence:"High",evidence:["Response matches catch-all baseline"]};
  if(redirected||external)return{path,url,finalUrl:value.finalUrl,status:value.status,classification:"REDIRECT",confidence:"Medium",evidence:[external?"External redirect":"Redirected path"]};
  if(value.status>=200&&value.status<300&&(value.password||value.loginMarker))return{path,url,finalUrl:url,status:value.status,classification:"LIKELY",confidence:value.password&&value.loginMarker?"High":"Medium",title:value.title,evidence:[...(value.password?["Password form"]:[]),...(value.loginMarker?["Administration/login marker"]:[]),"Unique response"]};
  return{path,url,finalUrl:url,status:value.status,classification:"UNLIKELY",confidence:"Low",title:value.title,evidence:[`HTTP ${value.status} without strong login evidence`]};
}
export async function scanAdminSurfaces(target:TargetContext,options:{signal:AbortSignal;fetcher?:typeof fetch;paths?:readonly string[];onProgress?:(done:number,total:number)=>void;probe?:string}):Promise<AdminResult[]>{
  const fetcher=options.fetcher??fetch, paths=options.paths??ADMIN_PATHS, probe=options.probe??`/.kagetarget-probe-${crypto.randomUUID()}`;
  const baseline=await read(adminUrl(target,probe),options.signal,fetcher);let cursor=0,done=0;const results:AdminResult[]=[];
  const worker=async()=>{while(cursor<paths.length){const path=paths[cursor++];try{const value=await read(adminUrl(target,path),options.signal,fetcher);results.push(classifyAdmin(path,value,baseline,target.origin));}catch(error){if(options.signal.aborted)throw error;results.push({path,url:adminUrl(target,path),finalUrl:adminUrl(target,path),status:null,classification:"ERROR",confidence:"Low",evidence:["NETWORK_FAILED"]});}options.onProgress?.(++done,paths.length)}};
  await Promise.all(Array.from({length:Math.min(ADMIN_CONCURRENCY,paths.length)},worker));return results.sort((a,b)=>paths.indexOf(a.path)-paths.indexOf(b.path));
}
