export type Activity='LOCAL'|'PAGE READ'|'DIRECT REQUEST';
export type TargetMode='LIVE_TAB'|'REMOTE_URL';
export interface TargetContext {originalInput:string;normalizedUrl:string;protocol:'http:'|'https:';origin:string;hostname:string;port:string|null;pathname:string;search:string;isCurrentTab:boolean;sourceTabId?:number}
export interface PageSnapshot {url:string;title:string;canonical:string|null;robots:string|null;generator:string|null;links:number;scripts:number;forms:number;iframes:number}
export interface PageLink {href:string;text:string;category:'internal'|'external'|'mail'|'telephone'|'hash'|'javascript'|'other'}
export interface PageResource {kind:'script'|'stylesheet'|'image'|'iframe';url:string;details:string}
export interface PageForm {method:string;action:string;inputs:number;types:Record<string,number>}
export interface HttpResult {status:number;statusText:string;finalUrl:string;headers:[string,string][]}
export interface HeaderObservation {name:string;status:'Present'|'Missing'|'Not Applicable';value?:string}
export interface TechnologyHint {name:string;source:string;confidence:'High'|'Medium'|'Low'}
export interface PublicFileResult {path:string;status:number|null;contentType:string;body:string;truncated:boolean;error?:string}
