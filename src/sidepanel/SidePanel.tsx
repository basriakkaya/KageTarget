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
import { parseTarget, permissionPattern } from "../core/target";
import { readPage, type PageData } from "../core/page";
import { fetchHead, fetchTextLimited } from "../core/network";
import {
  evaluateSecurityHeaders,
  parseCsp,
  technologyHints,
} from "../core/security";
import { calculateSubnet } from "../core/subnet";
import {
  clearAll,
  clearSession,
  loadLanguage,
  saveLanguage,
} from "../core/storage";
import { translate, type Language, type TranslationKey } from "../i18n";
import { fetchRemotePage } from "../core/remote-page";
type Category = "snapshot" | "web" | "page" | "utils";
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
  | "subnet";
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
];
const Icon = ({ name }: { name: string }) => (
  <span className="tool-icon" aria-hidden="true">
    {{ snapshot: "⌾", web: "◎", page: "⌁", utils: "⌗" }[name] ?? "·"}
  </span>
);
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
}: {
  children: ReactNode;
  className?: string;
}) => <section className={`card ${className}`}>{children}</section>;
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
  const op = useRef(0);
  const detect = async (initial = false) => {
    const next = await resolveActiveTarget();
    setActive(next);
    if (initial) {
      setTarget(next);
      setManualValue(next?.normalizedUrl ?? "");
    } else if (next?.normalizedUrl !== target?.normalizedUrl) setPending(true);
  };
  useEffect(() => {
    void loadLanguage().then(setLanguage);
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
  const reset = () => {
    op.current++;
    setPage(null);
    setHttp(null);
    setFiles([]);
    setError("");
    setSearch("");
    setFilter("all");
  };
  const analyze = async (next = active) => {
    if (!next) {
      setError(t("restricted"));
      return;
    }
    reset();
    const id = ++op.current;
    setTarget(next);
    setMode("LIVE_TAB");
    setPending(false);
    setLoading(true);
    try {
      const data = await readPage(next.sourceTabId!);
      if (id === op.current) setPage(data);
    } catch {
      if (id === op.current) setError(t("scriptFailed"));
    } finally {
      if (id === op.current) setLoading(false);
    }
  };
  const permissionFor = async (value: TargetContext) =>
    chrome.permissions.contains({ origins: [permissionPattern(value)] }).then(
      (granted) =>
        granted ||
        chrome.permissions.request({
          origins: [permissionPattern(value)],
        }),
    );
  const analyzeManual = async () => {
    try {
      const x = parseTarget(manualValue);
      reset();
      const id = ++op.current;
      setTarget(x);
      setMode("REMOTE_URL");
      setPending(false);
      setLoading(true);
      if (!(await permissionFor(x))) throw new Error("permission");
      const data = await fetchRemotePage(x);
      if (id === op.current) setPage(data);
    } catch {
      setError(t("invalidTarget"));
    } finally {
      setLoading(false);
    }
  };
  const permission = async () =>
    target
      ? chrome.permissions
          .contains({ origins: [permissionPattern(target)] })
          .then(
            (x) =>
              x ||
              chrome.permissions.request({
                origins: [permissionPattern(target)],
              }),
          )
      : false;
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
      <header>
        <div className="brand">
          <img src={logo} />
          <b>
            Kage<span>Target</span>
          </b>
        </div>
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
          <button aria-label={t("settings")} onClick={() => setSettings(true)}>
            ⚙
          </button>
        </div>
      </header>
      <main>
        <Card className="target-card">
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
                  void (mode === "LIVE_TAB" ? analyze(active) : analyzeManual())
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
          <button className="manual-toggle" onClick={() => setManual(!manual)}>
            <span>
              <b>+</b> {t("manualTarget")}
            </span>
            <span className={manual ? "chevron open" : "chevron"}>⌄</span>
          </button>
          {manual && (
            <div className="manual-panel">
              <div className="manual-label">{t("manualTarget")}</div>
              <p>{t("manualTargetHint")}</p>
              <div className="manual">
                <input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={t("manualPlaceholder")}
                  aria-label={t("manualTarget")}
                />
                <button onClick={() => void analyzeManual()}>
                  {t("analyze")}
                </button>
              </div>
            </div>
          )}
        </Card>
        <nav className="categories" aria-label="Tool categories">
          {(["snapshot", "web", "page", "utils"] as Category[]).map((x) => (
            <button
              key={x}
              className={category === x ? "active" : ""}
              onClick={() => {
                setCategory(x);
                setTool(registry.find((y) => y.category === x)!.id);
              }}
            >
              <Icon name={x} />
              {t(x)}
            </button>
          ))}
        </nav>
        <div className="tool-strip">
          {tools.map((x) => (
            <button
              className={tool === x.id ? "active" : ""}
              key={x.id}
              onClick={() => setTool(x.id)}
            >
              {t(x.key)}
            </button>
          ))}
        </div>
        <div className="tool-title">
          <div>
            <span>&gt; {target?.hostname ?? "NO_TARGET"}</span>
            <h2>{t(registry.find((x) => x.id === tool)!.key)}</h2>
          </div>
          <Badge className={loading ? "running" : ""}>
            {loading
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
          }}
        />
      </main>
      {settings && (
        <div className="overlay" onMouseDown={() => setSettings(false)}>
          <aside className="settings" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSettings(false)}>
              ×
            </button>
            <h2>{t("settings")}</h2>
            <label>
              {t("language")}
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value as Language)}
              >
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </label>
            <button onClick={() => void clearSessionNow()}>
              {t("clearSession")}
            </button>
            <button className="danger" onClick={() => setConfirm(true)}>
              {t("clearAll")}
            </button>
            <hr />
            <h3>{t("about")}</h3>
            <p>{t("aboutText")}</p>
            <small>{t("version")}</small>
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
    const hints = technologyHints(
      p.page!.snapshot,
      p.page!.resources.map((x) => x.url),
      p.http ?? undefined,
    );
    return hints.length ? (
      <>
        {hints.map((x) => (
          <Card key={x.name}>
            <h3>{x.name}</h3>
            <p>{x.source}</p>
            <Badge>{x.confidence}</Badge>
          </Card>
        ))}
      </>
    ) : (
      <Empty text={p.t("notDetected")} />
    );
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
