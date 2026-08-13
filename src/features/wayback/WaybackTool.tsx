import {useEffect,useMemo,useRef,useState} from "react";
import type {TargetContext} from "../../types";
import type {TranslationKey} from "../../i18n";
import {hasWaybackAccess,requestWaybackAccess} from "../../core/permissions";
import {archiveUrl,copyRecords,dedupeRecords,fetchWaybackPage,filterWayback,summarizeWayback,type WaybackFilters,type WaybackRecord,type WaybackScope,type WaybackType} from "./wayback";

type T=(key:TranslationKey)=>string;
const PAGE_SIZE=100;
const EMPTY_FILTERS:WaybackFilters={search:"",status:"all",type:"ALL",interesting:false,params:false,sort:"path"};
const ERROR_KEYS:Record<string,TranslationKey>={timeout:"waybackTimeout","rate-limit":"waybackRateLimit",unavailable:"waybackUnavailable",invalid:"waybackInvalid",cancelled:"waybackCancelled",network:"waybackNetwork"};
const WAYBACK_SESSION_CACHE=new Map<string,{records:WaybackRecord[];page:number;hasMore:boolean}>();

export function WaybackTool({target,t,onCopy}:{target:TargetContext;t:T;onCopy:(value:string)=>void}){
  const [scope,setScope]=useState<WaybackScope>("host");
  const [status,setStatus]=useState<"idle"|"permission"|"loading"|"done"|"error"|"cancelled">("idle");
  const [records,setRecords]=useState<WaybackRecord[]>([]);
  const [filters,setFilters]=useState<WaybackFilters>(EMPTY_FILTERS);
  const [visible,setVisible]=useState(PAGE_SIZE);
  const [page,setPage]=useState(0);
  const [hasMoreRemote,setHasMoreRemote]=useState(false);
  const [error,setError]=useState<TranslationKey>("waybackNetwork");
  const abort=useRef<AbortController|null>(null),operation=useRef(0);
  const filtered=useMemo(()=>filterWayback(records,filters),[records,filters]);
  const summary=useMemo(()=>summarizeWayback(records),[records]);
  const targetKey=target.normalizedUrl;
  useEffect(()=>{operation.current++;abort.current?.abort();setStatus("idle");setRecords([]);setPage(0);setHasMoreRemote(false);setVisible(PAGE_SIZE);setFilters(EMPTY_FILTERS)},[targetKey]);
  const run=async(nextPage=0,permissionGranted=false)=>{
    const key=`${targetKey}|${scope}`,cached=WAYBACK_SESSION_CACHE.get(key);
    if(nextPage===0&&cached){setRecords(cached.records);setPage(cached.page);setHasMoreRemote(cached.hasMore);setStatus("done");return}
    if(!permissionGranted&&!(await hasWaybackAccess())){setStatus("permission");return}
    abort.current?.abort();const controller=new AbortController(),id=++operation.current;abort.current=controller;setStatus("loading");
    try{const result=await fetchWaybackPage(target,scope,nextPage,controller.signal);if(id!==operation.current||target.normalizedUrl!==targetKey)return;const merged=dedupeRecords(nextPage? [...records,...result.records]:result.records);setRecords(merged);setPage(nextPage);setHasMoreRemote(result.hasMore);setVisible(nextPage?Math.max(visible,merged.length):PAGE_SIZE);setStatus("done");WAYBACK_SESSION_CACHE.set(key,{records:merged,page:nextPage,hasMore:result.hasMore})}
    catch(reason){if(id!==operation.current)return;const code=reason instanceof Error?reason.message:"network";setError(ERROR_KEYS[code]??"waybackNetwork");setStatus(code==="cancelled"?"cancelled":"error")}
    finally{if(abort.current===controller)abort.current=null}
  };
  const grant=async()=>{if(await requestWaybackAccess())void run(0,true);else setStatus("permission")};
  const changeScope=(next:WaybackScope)=>{operation.current++;abort.current?.abort();setScope(next);setStatus("idle");setRecords([]);setPage(0);setHasMoreRemote(false);setVisible(PAGE_SIZE);setFilters(EMPTY_FILTERS)};
  const update=<K extends keyof WaybackFilters>(key:K,value:WaybackFilters[K])=>{setFilters(current=>({...current,[key]:value}));setVisible(PAGE_SIZE)};
  const openArchive=(record:WaybackRecord)=>void chrome.tabs.create({url:archiveUrl(record)});
  const statusClass=(value:number|null)=>value===null?"missing":value<300?"present":value<400?"":value<500?"running":"error";
  const typeOptions:["ALL"|WaybackType,TranslationKey][]=[["ALL","all"],["HTML","waybackHtml"],["JS","waybackJs"],["JSON","waybackJson"],["CSS","waybackCss"],["API","waybackApi"],["DOCS","waybackDocs"],["IMAGES","waybackImages"],["OTHER","waybackOther"]];
  return <div className="wayback-workspace">
    <section className="wayback-header">
      <div><div className="eyebrow">{t("waybackTitle")}</div><p>{t("waybackDescription")}</p><strong>{target.hostname}</strong></div>
      <div className="wayback-source" title={t("waybackSourceInfo")}><span>{t("externalSource")}</span><b>Internet Archive</b></div>
      <div className="wayback-query-row"><div className="wayback-scope" role="group" aria-label={t("waybackScope")}><button className={scope==="host"?"active":""} aria-pressed={scope==="host"} onClick={()=>changeScope("host")}>{t("currentHost")}</button><button className={scope==="root"?"active":""} aria-pressed={scope==="root"} onClick={()=>changeScope("root")}>{t("rootDomain")}</button></div><button className="primary" disabled={status==="loading"} onClick={()=>void run()}>{t("queryArchive")}</button></div>
    </section>
    {status==="permission"&&<section className="card wayback-message"><b>{t("waybackPermissionTitle")}</b><p>{t("waybackPermissionBody")}</p><button className="primary" onClick={()=>void grant()}>{t("grantAccess")}</button></section>}
    {status==="loading"&&<section className="card wayback-message"><div className="progress-status"><span>{t("queryingArchive")}</span><span>{records.length?`${records.length} ${t("loaded")}`:""}</span></div><p>{t("fetchingArchived")}</p><div className="indeterminate-track"><span /></div><button className="secondary-action" onClick={()=>abort.current?.abort()}>{t("cancel")}</button></section>}
    {(status==="error"||status==="cancelled")&&<section className="card error wayback-message"><b>{t(error)}</b><button className="secondary-action" onClick={()=>void run()}>{t("retry")}</button></section>}
    {status==="done"&&records.length===0&&<section className="card wayback-message"><p>{t("waybackEmpty")}</p>{scope==="host"&&<button className="secondary-action" onClick={()=>changeScope("root")}>{t("changeScope")}</button>}</section>}
    {status==="done"&&records.length>0&&<>
      <section className="wayback-summary" aria-label={t("waybackSummary")}><span><b>{summary.total}</b>{t("uniqueUrls")}</span><span><b>{summary.js}</b>JS</span><span><b>{summary.api}</b>{t("apiLike")}</span><span><b>{summary.params}</b>{t("params")}</span><span><b>{summary.range}</b>{t("captureRange")}</span></section>
      <section className="wayback-filters"><input aria-label={t("waybackSearch")} placeholder={t("waybackSearch")} value={filters.search} onChange={event=>update("search",event.target.value)}/><select aria-label={t("status")} value={filters.status} onChange={event=>update("status",event.target.value as WaybackFilters["status"])}>{["all","2xx","3xx","4xx","5xx","unknown"].map(value=><option key={value} value={value}>{value==="all"?t("all"):value.toUpperCase()}</option>)}</select><select aria-label={t("waybackType")} value={filters.type} onChange={event=>update("type",event.target.value as WaybackFilters["type"])}>{typeOptions.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select><select aria-label={t("sort")} value={filters.sort} onChange={event=>update("sort",event.target.value as WaybackFilters["sort"])}><option value="path">{t("pathAz")}</option><option value="newest">{t("newest")}</option><option value="oldest">{t("oldest")}</option><option value="status">{t("status")}</option><option value="type">{t("waybackType")}</option></select><div className="wayback-quick"><button className={filters.params?"active":""} aria-pressed={filters.params} title={t("paramsHint")} onClick={()=>update("params",!filters.params)}>PARAMS</button><button className={filters.interesting?"active":""} aria-pressed={filters.interesting} onClick={()=>update("interesting",!filters.interesting)}>{t("interesting")}</button><button aria-label={t("copyFiltered")} onClick={()=>onCopy(copyRecords(filtered))}>{t("copyFiltered")}</button><button aria-label={t("copyAll")} onClick={()=>onCopy(copyRecords(records))}>{t("copyAll")} ({records.length})</button></div></section>
      <div className="wayback-count">{t("shownCount").replace("{shown}",String(Math.min(filtered.length,visible))).replace("{total}",String(filtered.length))}</div>
      <div className="wayback-results">{filtered.slice(0,visible).map(record=><article className="wayback-row" key={`${record.timestamp}-${record.original}`}><div className="wayback-badges"><span className={`status ${statusClass(record.status)}`}>{record.status??"?"}</span><span className="status">{record.type}</span>{record.isInteresting&&<span className="wayback-interest">{t("interestingPath")}</span>}</div><div className="wayback-path" title={record.original}>{record.path}</div><time title={record.timestamp}>{record.date}</time><div className="wayback-actions"><button aria-label={t("copyUrl")} onClick={()=>onCopy(record.original)}>⧉</button><button aria-label={t("openArchive")} onClick={()=>openArchive(record)}>↗</button></div></article>)}</div>
      {(visible<filtered.length||hasMoreRemote)&&<button className="wayback-load secondary-action" onClick={()=>visible<filtered.length?setVisible(value=>value+PAGE_SIZE):void run(page+1)}>{t("loadMore")}</button>}
    </>}
  </div>
}
