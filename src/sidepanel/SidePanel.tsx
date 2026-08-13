import { useEffect, useRef, useState, type ReactNode } from "react";
import logo from "../assets/brand/kagetarget-mark.svg";
import type {
  HeaderObservation,
  HttpResult,
  PageLink,
  PublicFileResult,
  TargetContext,
  TargetMode,
} from "../types";
import { resolveActiveTarget } from "../core/active-target";
import { parseTarget } from "../core/target";
import { readPage, type PageData } from "../core/page";
import { fetchHead, fetchTextLimited } from "../core/network";
import {
  evaluateSecurityHeaders,
  parseCsp,
} from "../core/security";
import { calculateSubnet } from "../core/subnet";
import {
  clearAll,
  clearSession,
  loadLanguage,
  loadLimitedMode,
  saveLanguage,
  saveLimitedMode,
} from "../core/storage";
import { hasAllSiteAccess, requestFirstRunAccess, requestHostAccess, type PermissionState } from "../core/permissions";
import { translate, type Language, type TranslationKey } from "../i18n";
import { fetchRemotePage } from "../core/remote-page";
import { detectTechnologies, type TechnologyMatch } from "../features/technology/engine";
import { ADMIN_PATHS, scanAdminSurfaces, type AdminResult } from "../features/admin/admin-surface";
import { targetPanelTransition, type TargetPanelState } from "../features/target-focus/state";
import { MainToolNavigation } from "./MainToolNavigation";
import type { Category } from "./main-navigation";
type Tool =
  | "snapshot"
  | "http"
  | "security"
  | "csp"
  | "public"
  | "links"
  | "resources"
  | "forms"
  | "technology"
  | "url"
  | "subnet"
  | "admin-surface";
const registry: { id: Tool; category: Category; key: TranslationKey }[] = [
  { id: "snapshot", category: "snapshot", key: "quickSnapshot" },
  { id: "http", category: "web", key: "httpHeaders" },
  { id: "security", category: "web", key: "securityHeaders" },
  { id: "csp", category: "web", key: "csp" },
  { id: "public", category: "web", key: "publicFiles" },
  { id: "links", category: "page", key: "links" },
  { id: "resources", category: "page", key: "resources" },
  { id: "forms", category: "page", key: "forms" },
  { id: "technology", category: "page", key: "technology" },
  { id: "url", category: "utils", key: "urlInspector" },
  { id: "subnet", category: "utils", key: "subnet" },
  { id: "admin-surface", category: "utils", key: "adminSurface" },
];
const Badge = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <span className={`status ${className}`}>{children}</span>;
const Card = ({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) => <section id={id} className={`card ${className}`}>{children}</section>;
const KV = ({
  rows,
  copyLabel,
  onCopy,
}: {
  rows: [string, ReactNode][];
  copyLabel: string;
  onCopy: (x: string) => void;
}) => (
  <div className="kv">
    {rows.map(([k, v]) => (
      <div className="kv-row" key={k}>
        <span>{k}</span>
        <strong>{v || "—"}</strong>
        {typeof v === "string" && (
          <button
            className="mini"
            aria-label={`${copyLabel} ${k}`}
            onClick={() => onCopy(v)}
          >
            ⧉
          </button>
        )}
      </div>
    ))}
  </div>
);
export function SidePanel() {
  const [language, setLanguage] = useState<Language>("en");
  const t = (k: TranslationKey) => translate(language, k);
  const [active, setActive] = useState<TargetContext | null>(null);
  const [target, setTarget] = useState<TargetContext | null>(null);
  const [mode, setMode] = useState<TargetMode>("LIVE_TAB");
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<Category>("snapshot");
  const [tool, setTool] = useState<Tool>("snapshot");
  const [page, setPage] = useState<PageData | null>(null);
  const [http, setHttp] = useState<HttpResult | null>(null);
  const [files, setFiles] = useState<PublicFileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [subnet, setSubnet] = useState("192.168.1.10/24");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [accessState, setAccessState] = useState<PermissionState>("checking");
  const [targetPanelState, setTargetPanelState] = useState<TargetPanelState>("expanded");
  const [adminResults, setAdminResults] = useState<AdminResult[]>([]);
  const [adminProgress, setAdminProgress] = useState<[number, number]>([0, ADMIN_PATHS.length]);
  const [adminStatus, setAdminStatus] = useState<"idle"|"running"|"completed"|"cancelled"|"error">("idle");
  const [technologyStatus, setTechnologyStatus] = useState<"idle"|"running"|"completed"|"error">("idle");
  const [technologyResults, setTechnologyResults] = useState<TechnologyMatch[]>([]);
  const [technologyError, setTechnologyError] = useState("");
  const adminAbort = useRef<AbortController | null>(null);
  const manualDialog = useRef<HTMLDivElement | null>(null);
  const settingsDialog = useRef<HTMLElement | null>(null);
  const op = useRef(0);
  const detect = async (initial = false) => {
    const next = await resolveActiveTarget();
    setActive(next);
    if (initial) {
      setTarget(next);
      setManualValue(next?.normalizedUrl ?? "");
    } else if (next?.normalizedUrl !== target?.normalizedUrl) {
      op.current++;
      setTargetPanelState("expanded");
      adminAbort.current?.abort();
      setAdminResults([]);
      setPage(null);
      setHttp(null);
      setFiles([]);
      setPending(true);
    }
  };
  useEffect(() => {
    void loadLanguage().then(setLanguage);
    void Promise.all([hasAllSiteAccess(),loadLimitedMode()]).then(([granted,limited])=>setAccessState(granted?"ready":limited?"limited":"needs-activation")).catch(()=>setAccessState("error"));
    void detect(true);
    const tab = () => {
      void detect(false);
    };
    const update = (_id: number, info: { url?: string }) => {
      if (info.url) void detect(false);
    };
    chrome.tabs.onActivated.addListener(tab);
    chrome.tabs.onUpdated.addListener(update);
    return () => {
      chrome.tabs.onActivated.removeListener(tab);
      chrome.tabs.onUpdated.removeListener(update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const x = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(x);
  }, [toast]);
  useEffect(() => {
    if (!manual) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setManual(false);
      if (event.key === "Tab") {
        const items = [...(manualDialog.current?.querySelectorAll<HTMLElement>('button,input') ?? [])];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    requestAnimationFrame(() => manualDialog.current?.querySelector<HTMLInputElement>("input")?.focus());
    return () => document.removeEventListener("keydown", key);
  }, [manual]);
  useEffect(() => {
    if (!settings) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettings(false);
      if (event.key === "Tab") {
        const items = [...(settingsDialog.current?.querySelectorAll<HTMLElement>('button,select') ?? [])];
        if (!items.length) return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    };
    document.addEventListener("keydown",key);
    requestAnimationFrame(()=>settingsDialog.current?.querySelector<HTMLElement>("button")?.focus());
    return()=>document.removeEventListener("keydown",key);
  },[settings]);
  const activateAccess=async()=>{setAccessState("requesting");try{const granted=await requestFirstRunAccess();if(granted){await saveLimitedMode(false);setAccessState("ready");}else setAccessState("denied");}catch{setAccessState("error")}};
  const continueLimited=async()=>{await saveLimitedMode(true);setAccessState("limited")};
  const openSettings=async()=>{try{setAccessState((await hasAllSiteAccess())?"ready":(await loadLimitedMode())?"limited":"needs-activation");}catch{setAccessState("error")}setSettings(true)};
  const reset = () => {
    op.current++;
    setPage(null);
    setHttp(null);
    setFiles([]);
    setError("");
    setSearch("");
    setFilter("all");
    adminAbort.current?.abort();
    adminAbort.current = null;
    setAdminResults([]);
    setAdminProgress([0, ADMIN_PATHS.length]);
    setAdminStatus("idle");
    setTechnologyStatus("idle");
    setTechnologyResults([]);
    setTechnologyError("");
  };
  const analyze = async (next = active) => {
    if (!next) {
      setError(t("restricted"));
      return;
    }
    reset();
    setTargetPanelState("expanded");
    const id = ++op.current;
    setTarget(next);
    setMode("LIVE_TAB");
    setPending(false);
    setLoading(true);
    try {
      const data = await readPage(next.sourceTabId!);
      if (id === op.current) {
        setPage(data);
        setTargetPanelState("collapsed");
      }
    } catch {
      if (id === op.current) setError(t("scriptFailed"));
    } finally {
      if (id === op.current) setLoading(false);
    }
  };
  const analyzeManual = async () => {
    try {
      const x = parseTarget(manualValue);
      reset();
      setTargetPanelState("expanded");
      const id = ++op.current;
      setTarget(x);
      setMode("REMOTE_URL");
      setPending(false);
      setLoading(true);
      if (!(await requestHostAccess(x))) throw new Error("permission");
      const data = await fetchRemotePage(x);
      if (id === op.current) {
        setPage(data);
        setTargetPanelState("collapsed");
      }
      return true;
    } catch {
      setError(t("invalidTarget"));
      return false;
    } finally {
      setLoading(false);
    }
  };
  const permission = async () => target ? requestHostAccess(target) : false;
  const runHttp = async () => {
    if (!target) return;
    const id = ++op.current;
    setLoading(true);
    setError("");
    try {
      if (!(await permission())) throw new Error("permission");
      const x = await fetchHead(target);
      if (id === op.current) setHttp(x);
    } catch (e) {
      if (id === op.current)
        setError(
          e instanceof Error && e.message === "permission"
            ? t("permissionDenied")
            : t("networkFailed"),
        );
    } finally {
      if (id === op.current) setLoading(false);
    }
  };
  const runFiles = async () => {
    if (!target) return;
    const id = ++op.current;
    setLoading(true);
    setError("");
    try {
      if (!(await permission())) throw new Error("permission");
      const paths = [
          "/robots.txt",
          "/.well-known/security.txt",
          "/security.txt",
          "/sitemap.xml",
        ],
        out: PublicFileResult[] = [];
      for (let i = 0; i < paths.length; i += 3)
        out.push(
          ...(await Promise.all(
            paths
              .slice(i, i + 3)
              .map((x) => fetchTextLimited(target.origin, x)),
          )),
        );
      if (id === op.current) setFiles(out);
    } catch {
      if (id === op.current) setError(t("networkFailed"));
    } finally {
      if (id === op.current) setLoading(false);
    }
  };
  const runAdmin = async () => {
    if (!target || loading) return;
    setError("");
    if (!(await permission())) { setError(t("permissionDenied")); return; }
    const controller = new AbortController(); adminAbort.current = controller; setLoading(true); setAdminStatus("running"); setAdminResults([]); setAdminProgress([0, ADMIN_PATHS.length]);
    try { setAdminResults(await scanAdminSurfaces(target,{signal:controller.signal,onProgress:(done,total)=>setAdminProgress([done,total])})); setAdminStatus("completed"); }
    catch { if (controller.signal.aborted) setAdminStatus("cancelled"); else { setAdminStatus("error"); setError(t("networkFailed")); } }
    finally { if (adminAbort.current===controller) { adminAbort.current=null; setLoading(false); } }
  };
  const cancelAdmin=()=>{adminAbort.current?.abort();setAdminStatus("cancelled")};
  const runTechnology=async()=>{
    if(!target||!page)return;
    const requestedTarget=target.normalizedUrl,id=++op.current;
    setTechnologyStatus("running");setTechnologyError("");
    const pageMatches=detectTechnologies({snapshot:page.snapshot,resources:page.resources,markers:page.markers,http:http??undefined});
    setTechnologyResults(pageMatches);
    try{
      if(!(await permission()))throw new Error("permission");
      const headers=await fetchHead(target);
      if(id!==op.current||target.normalizedUrl!==requestedTarget)return;
      setHttp(headers);
      setTechnologyResults(detectTechnologies({snapshot:page.snapshot,resources:page.resources,markers:page.markers,http:headers}));
      setTechnologyStatus("completed");
    }catch(error){
      if(id!==op.current)return;
      if(pageMatches.length){setTechnologyResults(pageMatches);setTechnologyStatus("completed");}
      else {setTechnologyStatus("error");setTechnologyError(error instanceof Error&&error.message==="permission"?t("permissionDenied"):t("technologyFailed"));}
    }
  };
  const selectTool=(nextTool:Tool)=>{setTool(nextTool);if(nextTool==="technology")void runTechnology()};
  const copy = (x: string) =>
    void navigator.clipboard.writeText(x).then(() => setToast(t("copied")));
  const changeLanguage = (x: Language) => {
    setLanguage(x);
    void saveLanguage(x);
  };
  const clearSessionNow = async () => {
    reset();
    setTarget(active);
    setMode("LIVE_TAB");
    setTargetPanelState("expanded");
    await clearSession();
    setToast(t("sessionCleared"));
  };
  const clearAllNow = async () => {
    reset();
    await clearAll();
    setLanguage("en");
    setConfirm(false);
    setSettings(false);
    setToast(translate("en", "allCleared"));
  };
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  };
  const tools = registry.filter((x) => x.category === category);
  return (
    <div className="panel">
      <header className="top-shell">
        <div className="brand">
          <img src={logo} />
          <b>
            Kage<span>Target</span>
          </b>
        </div>
        <MainToolNavigation active={category} label={t} onSelect={(nextCategory) => {
          setCategory(nextCategory);
          selectTool(registry.find((item) => item.category === nextCategory)!.id);
        }} />
        <div className="head-actions">
          <button
            aria-label={t("language")}
            onClick={() => changeLanguage(language === "en" ? "tr" : "en")}
          >
            {language.toUpperCase()}
          </button>
          <button
            aria-label={t("clearSession")}
            onClick={() => void clearSessionNow()}
          >
            ⌫
          </button>
          <button
            aria-label={t("openSidePanel")}
            onClick={() => void openSidePanel()}
          >
            ⧉
          </button>
          <button aria-label={t("settings")} onClick={() => void openSettings()}>
            ⚙
          </button>
        </div>
      </header>
      {!["ready","limited"].includes(accessState) && <section className="activation-view" aria-live="polite">
        <div className="activation-card">
          <div className="eyebrow">{t("requiredAccess")}</div><h1>{t("activateTitle")}</h1><p>{t("activateBody")}</p>
          <ul><li>{t("accessPage")}</li><li>{t("accessTargets")}</li><li>{t("accessLocal")}</li></ul>
          <div className="privacy-note"><b>{t("privacyPromise")}</b><p>{t("privacyPromiseBody")}</p></div>
          {(accessState==="denied"||accessState==="error")&&<div className="access-error"><b>{t("accessDenied")}</b><p>{t("accessDeniedBody")}</p></div>}
          <button className="primary activation-primary" disabled={accessState==="checking"||accessState==="requesting"} onClick={()=>void activateAccess()}>{accessState==="requesting"?t("activating"):accessState==="denied"||accessState==="error"?t("retry"):t("activate")}</button>
          <button className="activation-skip" disabled={accessState==="checking"||accessState==="requesting"} onClick={()=>void continueLimited()}>{accessState==="denied"?t("continueLimited"):t("skipNow")}</button>
        </div>
      </section>}
      <main>
        <div className="panel-controls">
          {targetPanelState === "expanded" ? <Card id="target-expanded-panel" className="target-card compact-target target-expanded">
            <div className="eyebrow">{pending ? t("newTab") : t("target")}</div>
            {target ? (
              <>
                <div className="target-line">
                  <div>
                    <h1>{target.hostname}</h1>
                    <p title={target.normalizedUrl}>{target.normalizedUrl}</p>
                  </div>
                  <Badge>
                    {mode === "LIVE_TAB" ? t("livePage") : t("staticHtml")}
                  </Badge>
                </div>
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() =>
                    void (mode === "LIVE_TAB"
                      ? analyze(active)
                      : analyzeManual())
                  }
                >
                  {loading ? t("analyzing") : t("analyze")}
                </button>
              </>
            ) : (
              <>
                <h1>{t("noTarget")}</h1>
                <p>{t("restrictedDetail")}</p>
              </>
            )}
            <button className="manual-toggle" onClick={() => setManual(true)}><b>+</b> {t("manualTarget")}</button>
          </Card> : <section className={`target-focus-bar ${targetPanelState}`} aria-label={t("targetLocked")}>
            <button className="focus-identity" aria-expanded="false" aria-controls="target-expanded-panel" onClick={()=>setTargetPanelState(targetPanelTransition(targetPanelState,"EXPAND"))} onMouseEnter={()=>setTargetPanelState(targetPanelTransition(targetPanelState,"PEEK_START"))} onMouseLeave={()=>setTargetPanelState(targetPanelTransition(targetPanelState,"PEEK_END"))} onFocus={()=>setTargetPanelState(targetPanelTransition(targetPanelState,"PEEK_START"))} onBlur={()=>setTargetPanelState(targetPanelTransition(targetPanelState,"PEEK_END"))}>
              <span>{t("targetLocked")}</span><strong title={target?.hostname}>{target?.hostname}</strong><small title={target?.normalizedUrl}>{target?.normalizedUrl}</small>
            </button>
            <Badge>{mode === "LIVE_TAB" ? t("livePage") : t("staticHtml")}</Badge>
            <button className="focus-action" aria-label={t("expand")} onClick={()=>setTargetPanelState("expanded")}>↗ {t("expand")}</button>
            <button className="focus-action" onClick={()=>setManual(true)}>+ {t("manualTarget")}</button>
          </section>}
        </div>
        <div className="content-region">
          <div className="tool-strip" role="tablist" aria-label={`${t(category)} tools`}>
            {tools.map((x) => (
              <button
                className={tool === x.id ? "active" : ""}
                aria-controls="tool-content"
                aria-selected={tool === x.id}
                key={x.id}
                onClick={() => selectTool(x.id)}
                role="tab"
              >
                {t(x.key)}
              </button>
            ))}
          </div>
        <section className="tool-content" id="tool-content" aria-live="polite">
          <div className="tool-title">
            <div>
              <span>&gt; {target?.hostname ?? "NO_TARGET"}</span>
              <h2>{t(registry.find((x) => x.id === tool)!.key)}</h2>
            </div>
            <Badge className={loading || (tool==="technology"&&technologyStatus==="running") ? "running" : ""}>
              {loading || (tool==="technology"&&technologyStatus==="running")
                ? t("running")
                : error
                  ? t("error")
                  : page || http || files.length
                    ? t("done")
                    : t("ready")}
            </Badge>
          </div>
          {error && (
            <Card className="error">
              <b>{t("error")}</b>
              <p>{error}</p>
            </Card>
          )}
          <ToolView
            {...{
              tool,
              target,
              page,
              http,
              files,
              runHttp,
              runFiles,
              loading,
              subnet,
              setSubnet,
              search,
              setSearch,
              filter,
              setFilter,
              t,
              copy,
              mode,
              runAdmin,
              adminResults,
              adminProgress,
              adminStatus,
              cancelAdmin,
              technologyStatus,
              technologyResults,
              technologyError,
              runTechnology,
            }}
          />
        </section>
        </div>
      </main>
      {manual && (
        <div className="overlay manual-overlay" role="presentation" onMouseDown={() => setManual(false)}>
          <div className="dialog manual-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-title" ref={manualDialog} onMouseDown={(e)=>e.stopPropagation()}>
            <button className="close" aria-label={t("cancel")} onClick={()=>setManual(false)}>×</button>
            <h2 id="manual-title">{t("manualTarget")}</h2><p>{t("manualTargetHint")}</p>
            <input value={manualValue} onChange={(e)=>setManualValue(e.target.value)} placeholder={t("manualPlaceholder")} aria-label={t("manualTarget")} />
            <div><button onClick={()=>setManual(false)}>{t("cancel")}</button><button className="primary" onClick={()=>void analyzeManual().then((valid)=>valid&&setManual(false))}>{t("analyze")}</button></div>
          </div>
        </div>
      )}
      {settings && (
        <div className="overlay" onMouseDown={() => setSettings(false)}>
          <aside className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" ref={settingsDialog} onMouseDown={(e) => e.stopPropagation()}>
            <div className="settings-header"><div><span>{t("controlSurface")}</span><h2 id="settings-title">{t("settings")}</h2></div><button className="close" aria-label={t("closeSettings")} onClick={() => setSettings(false)}>×</button></div>
            <section className="settings-section"><div className="settings-section-title"><span>01</span><div><h3>{t("language")}</h3><p>{t("languageHint")}</p></div></div><label>
              <span>{t("interfaceLanguage")}</span>
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value as Language)}
              >
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </label></section>
            <section className="settings-section"><div className="settings-section-title"><span>02</span><div><h3>{t("session")}</h3><p>{t("sessionHint")}</p></div></div><button onClick={() => void clearSessionNow()}>
              {t("clearSession")}
            </button></section>
            <section className="settings-section"><div className="settings-section-title"><span>03</span><div><h3>{t("data")}</h3><p>{t("dataHint")}</p></div></div>
            <button className="danger" onClick={() => setConfirm(true)}>
              {t("clearAll")}
            </button></section>
            <section className="settings-section"><div className="settings-section-title"><span>04</span><div><h3>{t("access")}</h3><p>{t("accessHint")}</p></div></div><div className="settings-state"><span>{t("hostAccess")}</span><Badge className={accessState==="ready"?"present":"missing"}>{accessState==="ready"?t("enabled"):t("notEnabled")}</Badge></div>{accessState!=="ready"&&<button onClick={()=>void activateAccess()}>{t("grantAccess")}</button>}</section>
            <section className="settings-section settings-about"><div className="settings-section-title"><span>05</span><div><h3>{t("about")}</h3><p>{t("aboutText")}</p></div></div><small>{t("version")}</small><small>{t("privacySummary")}</small></section>
          </aside>
        </div>
      )}
      {confirm && (
        <div className="overlay">
          <div className="dialog">
            <h2>{t("clearAllTitle")}</h2>
            <p>{t("clearAllBody")}</p>
            <div>
              <button onClick={() => setConfirm(false)}>{t("cancel")}</button>
              <button className="danger" onClick={() => void clearAllNow()}>
                {t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}
type T = (k: TranslationKey) => string;
type ViewProps = {
  tool: Tool;
  target: TargetContext | null;
  page: PageData | null;
  http: HttpResult | null;
  files: PublicFileResult[];
  runHttp: () => Promise<void>;
  runFiles: () => Promise<void>;
  loading: boolean;
  subnet: string;
  setSubnet: (x: string) => void;
  search: string;
  setSearch: (x: string) => void;
  filter: string;
  setFilter: (x: string) => void;
  t: T;
  copy: (x: string) => void;
  mode: TargetMode;
  runAdmin: () => Promise<void>;
  adminResults: AdminResult[];
  adminProgress: [number, number];
  adminStatus: "idle"|"running"|"completed"|"cancelled"|"error";
  cancelAdmin: () => void;
  technologyStatus: "idle"|"running"|"completed"|"error";
  technologyResults: TechnologyMatch[];
  technologyError: string;
  runTechnology: () => Promise<void>;
};
function ToolView(p: ViewProps) {
  if (!p.target) return <Empty text={p.t("noTargetBody")} />;
  const kv = (rows: [string, ReactNode][]) => (
    <KV rows={rows} copyLabel={p.t("copy")} onCopy={p.copy} />
  );
  if (p.tool === "snapshot")
    return p.page ? (
      <>
        <div className="metrics">
          {[
            [p.t("links"), p.page.snapshot.links],
            [p.t("scripts"), p.page.snapshot.scripts],
            [p.t("forms"), p.page.snapshot.forms],
            [p.t("iframes"), p.page.snapshot.iframes],
          ].map(([k, v]) => (
            <Card key={String(k)}>
              <span>{k}</span>
              <strong>{v}</strong>
            </Card>
          ))}
        </div>
        <Card>
          {kv([
            [p.t("title"), p.page.snapshot.title],
            [p.t("protocol"), p.target.protocol.toUpperCase()],
            [p.t("canonical"), p.page.snapshot.canonical ?? p.t("notDetected")],
            [p.t("robots"), p.page.snapshot.robots ?? p.t("notDetected")],
            [p.t("generator"), p.page.snapshot.generator ?? p.t("notDetected")],
          ])}
        </Card>
      </>
    ) : (
      <Empty text={p.t("noResults")} />
    );
  if (p.tool === "http")
    return (
      <>
        <Run onClick={p.runHttp} loading={p.loading} t={p.t} />
        {p.http && (
          <Card>
            {kv([
              [p.t("status"), `${p.http.status} ${p.http.statusText}`],
              [p.t("finalUrl"), p.http.finalUrl],
              ...p.http.headers,
            ])}
          </Card>
        )}
      </>
    );
  if (p.tool === "security" || p.tool === "csp") {
    if (!p.http)
      return (
        <>
          <Run onClick={p.runHttp} loading={p.loading} t={p.t} />
          <Empty text={p.t("noResults")} />
        </>
      );
    const observations = evaluateSecurityHeaders(p.http.headers);
    if (p.tool === "security")
      return (
        <Card>
          {observations.map((x: HeaderObservation) => (
            <div className="observation" key={x.name}>
              <span>{x.name}</span>
              <Badge className={x.status === "Present" ? "present" : "missing"}>
                {x.status === "Present" ? p.t("present") : p.t("missing")}
              </Badge>
              {x.value && <code>{x.value}</code>}
            </div>
          ))}
        </Card>
      );
    const csp = observations.find(
      (x) => x.name === "Content-Security-Policy",
    )?.value;
    return csp ? (
      <Card>
        {parseCsp(csp).map((x) => (
          <div className="directive" key={x.directive}>
            <b>{x.directive}</b>
            <code>{x.values.join(" ")}</code>
          </div>
        ))}
      </Card>
    ) : (
      <Empty text={p.t("notDetected")} />
    );
  }
  if (p.tool === "public")
    return (
      <>
        <Run onClick={p.runFiles} loading={p.loading} t={p.t} />
        {p.files.map((x) => (
          <Card key={x.path}>
            <h3>{x.path}</h3>
            <Badge>{x.status ?? p.t("notAvailable")}</Badge>
            <pre>{x.body.slice(0, 12000) || x.error || "—"}</pre>
            {x.truncated && <p>{p.t("observation")}: 256 KB limit</p>}
          </Card>
        ))}
      </>
    );
  if (!p.page && ["links", "resources", "forms", "technology"].includes(p.tool))
    return <Empty text={p.t("noResults")} />;
  if (p.tool === "links") {
    const data = p.page!.links.filter(
      (x) =>
        (p.filter === "all" || x.category === p.filter) &&
        `${x.href} ${x.text}`.toLowerCase().includes(p.search.toLowerCase()),
    );
    return (
      <>
        <div className="filters">
          <input
            value={p.search}
            onChange={(e) => p.setSearch(e.target.value)}
            placeholder={p.t("search")}
          />
          <select
            value={p.filter}
            onChange={(e) => p.setFilter(e.target.value)}
          >
            <option value="all">{p.t("all")}</option>
            {[
              "internal",
              "external",
              "mail",
              "telephone",
              "hash",
              "javascript",
              "other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {data.map((x: PageLink, i) => (
          <Card key={`${x.href}-${i}`}>
            <Badge>{x.category}</Badge>
            <p>{x.text}</p>
            <code>{x.href}</code>
          </Card>
        ))}
      </>
    );
  }
  if (p.tool === "resources")
    return (
      <>
        {p.page!.resources.map((x, i) => (
          <Card key={`${x.url}-${i}`}>
            <Badge>{x.kind}</Badge>
            <code>{x.url}</code>
            <p>{x.details}</p>
          </Card>
        ))}
      </>
    );
  if (p.tool === "forms")
    return (
      <>
        {p.page!.forms.map((x, i) => (
          <Card key={i}>
            <h3>
              {p.t("forms")} #{i + 1}
            </h3>
            {kv([
              [p.t("method"), x.method],
              [p.t("action"), x.action],
              [p.t("input"), String(x.inputs)],
              ...Object.entries(x.types).map(
                ([k, v]) => [k, String(v)] as [string, string],
              ),
            ])}
          </Card>
        ))}
      </>
    );
  if (p.tool === "technology") {
    if(p.technologyStatus==="running")return <Card className="technology-state"><div className="progress-status"><span>{p.t("technologyAnalyzing")}</span><Badge className="running">{p.t("running")}</Badge></div><p>{p.t("technologyAnalyzingHint")}</p><div className="indeterminate-track" aria-hidden="true"><span /></div></Card>;
    if(p.technologyStatus==="error")return <Card className="technology-state error"><b>{p.t("technologyError")}</b><p>{p.technologyError}</p><button className="secondary-action" onClick={()=>void p.runTechnology()}>{p.t("retry")}</button></Card>;
    if(p.technologyStatus==="idle")return <Card className="technology-state"><p>{p.t("technologyReady")}</p><button className="primary" onClick={()=>void p.runTechnology()}>{p.t("detectTechnology")}</button></Card>;
    return p.technologyResults.length ? (
      <>
        {p.technologyResults.map((x) => (
          <Card key={x.id} className="technology-card">
            <div className="result-heading"><div><span>{x.category}</span><h3>{x.name}{x.version ? ` ${x.version}` : ""}</h3></div><Badge className={x.confidence.toLowerCase()}>{x.confidence}</Badge></div>
            <details><summary>{p.t("evidence")}</summary><ul>{x.evidence.map(item=><li key={item}>{item}</li>)}</ul></details>
          </Card>
        ))}
      </>
    ) : (
      <Empty text={p.t("notDetected")} />
    );
  }
  if (p.tool === "admin-surface") {
    const counts=Object.fromEntries(["LIKELY","PROTECTED","REDIRECT","UNLIKELY","NOT_FOUND","ERROR"].map(x=>[x,p.adminResults.filter(y=>y.classification===x).length]));
    const done=p.adminProgress[0],total=p.adminProgress[1],percent=Math.round(done/total*100),remaining=Math.max(0,total-done);
    return <><Card className={`admin-intro progress-panel ${p.adminStatus}`}><p>{p.t("adminDescription")}</p><div className="safety">{p.t("adminSafety")}</div><div className="admin-facts"><span>{p.t("sameOrigin")}</span><span>{p.t("noAuth")}</span><span>{ADMIN_PATHS.length} {p.t("paths")}</span></div>{p.adminStatus==="idle"?<button className="primary run" onClick={()=>void p.runAdmin()}>{p.t("runCheck")}</button>:<><div className="progress-status"><span>{p.adminStatus==="running"?p.t("scanRunning"):p.adminStatus==="completed"?p.t("scanCompleted"):p.adminStatus==="cancelled"?p.t("scanCancelled"):p.t("scanError")}</span><Badge className={p.adminStatus==="running"?"running":""}>{percent}%</Badge></div><div className="progress-track" role="progressbar" aria-label={p.t("scanProgress")} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{width:`${percent}%`}} /></div><div className="progress-meta"><strong>{done} / {total} {p.t("complete")}</strong><span>{p.t("remaining")}: {remaining}</span></div>{p.adminStatus==="running"?<button className="secondary-action" onClick={p.cancelAdmin}>{p.t("cancel")}</button>:<button className="secondary-action" onClick={()=>void p.runAdmin()}>{p.t("runAgain")}</button>}</>}</Card>{p.adminResults.length>0&&<><div className="admin-summary">{Object.entries(counts).filter(([,count])=>count).map(([key,count])=><span key={key}>{key} <b>{count}</b></span>)}</div>{p.adminResults.map(result=><Card key={result.path} className="admin-result"><div className="result-heading"><h3>{result.path}</h3><Badge>{result.classification}</Badge></div><code>{result.status??"—"} {result.finalUrl}</code><p>{result.evidence.join(" · ")}</p></Card>)}</>}</>;
  }
  if (p.tool === "url") {
    const u = new URL(p.target.normalizedUrl);
    return (
      <Card>
        {kv([
          [p.t("scheme"), u.protocol.slice(0, -1)],
          [p.t("hostname"), u.hostname],
          [p.t("port"), u.port || "default"],
          [p.t("path"), u.pathname],
          [p.t("query"), u.search],
          [p.t("fragment"), u.hash],
        ])}
      </Card>
    );
  }
  let result;
  try {
    result = calculateSubnet(p.subnet);
  } catch {
    return (
      <Card>
        <input value={p.subnet} onChange={(e) => p.setSubnet(e.target.value)} />
        <p>{p.t("invalidTarget")}</p>
      </Card>
    );
  }
  return (
    <Card>
      <input value={p.subnet} onChange={(e) => p.setSubnet(e.target.value)} />
      {kv(Object.entries(result).map(([k, v]) => [k, String(v)]))}
    </Card>
  );
}
const Empty = ({ text }: { text: string }) => (
  <div className="empty">
    <span>⌾</span>
    <p>{text}</p>
  </div>
);
const Run = ({
  onClick,
  loading,
  t,
}: {
  onClick: () => Promise<void>;
  loading: boolean;
  t: T;
}) => (
  <button
    className="primary run"
    disabled={loading}
    onClick={() => void onClick()}
  >
    {loading ? t("analyzing") : t("analyze")}
  </button>
);
