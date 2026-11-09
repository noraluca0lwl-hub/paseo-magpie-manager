/** Paseo-native panel. Layout reference: yetone/magpie c7ebb6f internal/gui/assets.
 * No iframe, public listener, browser-only DOM, or client-side Magpie credentials.
 */
import { type PluginAgentPanelProps, useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { officialApi, panelPreferences } from "../shared/contracts";
import { officialIcons } from "./official-icons";
import { SecondaryPage } from "./secondary-pages";
import { I_agents, I_sessions, I_providers, I_routing, I_gateway, I_usage, I_masking, I_plugins } from "./nav-icons";

type Option = { value: string; label?: string; note?: string; group?: string };
type Field = { key: string; label: string; value: string; options: Option[] };
type Agent = { id: string; name: string; icon?: string; wired?: boolean; path: string; fields: Field[]; models?: number };
type Provider = { id: string; name: string; chat?: string; anthropic?: string; responses?: string; models?: unknown[]; key?: string; preset?: string };
type State = { agents: Agent[]; profiles: { name: string }[]; settings?: Record<string, unknown> };
type Providers = { providers: Provider[]; presets: (Provider & { kind?: string })[] };
type Page = "agents" | "sessions" | "library" | "providers" | "routing" | "gateway" | "usage" | "masking" | "plugins" | "settings";
const nav: { group: string; items: { id: Page; label: string; icon: { svg: string } | string }[] }[] = [
  { group: "使用", items: [{ id: "agents", label: "Agent", icon: I_agents }, { id: "sessions", label: "会话", icon: I_sessions }, { id: "library", label: "资源库", icon: officialIcons.library }] },
  { group: "模型", items: [{ id: "providers", label: "供应商", icon: I_providers }, { id: "routing", label: "路由", icon: I_routing }, { id: "gateway", label: "网关", icon: I_gateway }] },
  { group: "观测", items: [{ id: "usage", label: "用量", icon: I_usage }, { id: "masking", label: "脱敏", icon: I_masking }] },
  { group: "扩展", items: [{ id: "plugins", label: "插件", icon: I_plugins }] },
];
const endpoints: Partial<Record<Page, string>> = { sessions: "sessions", library: "library", routing: "groups", gateway: "upstream", usage: "usage/quotas", masking: "masking/summary", plugins: "plugins", settings: "settings" };
const freshForm = { id: "", name: "", key: "", url: "", protocol: "chat", preset: "", models: "" };

export function MagpieManagerPanel({ theme }: Pick<PluginAgentPanelProps, "theme">) {
  const rpc = useRpc(officialApi);
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const [page, setPage] = useState<Page>("agents");
  const [drawer, setDrawer] = useState(false);
  const preferences = useRpc(panelPreferences);
  const [appearance, setAppearance] = useState<"system" | "light" | "dark">("system");
  useEffect(() => { void preferences({}).then(p => setAppearance(p.theme)).catch(e => setError(String(e))); }, [preferences]);
  const saveAppearance = async (value: "system" | "light" | "dark") => {
    try { const p = await preferences({ theme: value }); setAppearance(p.theme); }
    catch (e) { setError(String(e)); }
  };
  const surface = theme.colors.surface0.replace("#", "");
  const themeDark = surface.length === 6 && (parseInt(surface.slice(0, 2), 16) * .299 + parseInt(surface.slice(2, 4), 16) * .587 + parseInt(surface.slice(4, 6), 16) * .114) < 128;
  const dark = appearance === "dark" || appearance === "system" && themeDark;
  const c = { bg: dark ? "#1b1c20" : "#f2f2f5", card: dark ? "#25262c" : "#ffffff", text: dark ? "#ededf1" : "#202124", muted: dark ? "#9c9ca6" : "#83858e", line: dark ? "#34353b" : "#e4e5e9", pill: dark ? "#303139" : "#f0f0f3", purple: dark ? "#a5a0ff" : "#7662ff", green: "#16a56b", red: "#d54949" };
  const [state, setState] = useState<State | null>(null);
  const [vendors, setVendors] = useState<Providers>({ providers: [], presets: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Agent | null>(null);
  const [picker, setPicker] = useState<{ agent: Agent; field: Field } | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(freshForm);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<Agent | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [section, setSection] = useState<unknown>(null);
  const [sectionError, setSectionError] = useState("");
  const [search, setSearch] = useState("");
  const generation = useRef(0);
  const call = useCallback(async (path: string, body?: unknown) => {
    const r = await rpc({ path, method: body === undefined ? "GET" : "POST", body });
    if (!r.ok) throw new Error(r.error ?? "Magpie 请求失败");
    return r.data;
  }, [rpc]);
  const refresh = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true); setError(""); setSectionError(""); setSection(null);
    const results = await Promise.allSettled([call("state"), call("providers"), endpoints[page] ? call(endpoints[page]!) : Promise.resolve(null)]);
    if (g !== generation.current) return;
    if (results[0].status === "fulfilled") setState(results[0].value as State);
    else setError(String(results[0].reason));
    if (results[1].status === "fulfilled") setVendors(results[1].value as Providers);
    else setError(e => [e, String(results[1].status === "rejected" ? results[1].reason : "")].filter(Boolean).join("\n"));
    if (results[2].status === "fulfilled") setSection(results[2].value);
    else setSectionError(String(results[2].reason));
    setLoading(false);
  }, [call, page]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  const act = async (path: string, body: unknown, after?: () => void) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await call(path, body); after?.(); await refresh(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const secondaryAct = async (path: string, body: unknown) => {
    if (busy) throw new Error("已有操作正在执行");
    setBusy(true); setError("");
    try {
      const result = await call(path, body) as { result?: { problems?: unknown[]; gone?: string[] }; problems?: unknown[]; gone?: string[] } | null;
      const gone = result?.result?.gone ?? result?.gone;
      if (gone?.length) throw new Error(`来源已移除这些技能，未更新：${gone.join('、')}`);
      const problems = result?.result?.problems ?? result?.problems;
      if (problems?.length) throw new Error(`配置已保存但分发有异常，请检查后重试：${JSON.stringify(problems)}`);
      await refresh();
    }
    catch (e) { setError(String(e)); throw e; }
    finally { setBusy(false); }
  };
  const go = (id: Page) => { setPage(id); setDrawer(false); setSearch(""); };
  const item = nav.flatMap(g => g.items).find(i => i.id === page);
  const group = nav.find(g => g.items.some(i => i.id === page))?.group ?? "设置";
  const label = item?.label ?? "设置";
  const text = { color: c.text, fontSize: 14 };
  const muted = { color: c.muted, fontSize: 13 };
  const card = { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, overflow: "hidden" as const };
  const row = { padding: 16, gap: 12, flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const };
  const input = { color: c.text, backgroundColor: c.pill, borderRadius: 7, padding: 11, fontSize: 14, minHeight: 42 };
  const button = (title: string, action: () => void, danger = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 7, backgroundColor: c.pill, opacity: busy ? .5 : 1 }}><Text style={{ color: danger ? c.red : c.text, fontSize: 13 }}>{title}</Text></Pressable>;
  const sidebar = <View style={{ flex: 1, backgroundColor: c.bg, borderRightWidth: 1, borderRightColor: c.line }}>
    <View style={{ height: 46, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 }}><Icon icon={officialIcons.magpie} size={18} color={c.text} /><Text style={text}>magpie</Text>{compact && button("关闭", () => setDrawer(false))}</View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 20 }}>
      {nav.map(g => <View key={g.group}><Text style={{ ...muted, paddingHorizontal: 8, paddingTop: 17, paddingBottom: 6, fontSize: 12 }}>{g.group}</Text>{g.items.map(i => <Pressable key={i.id} onPress={() => go(i.id)} accessibilityRole="button" accessibilityState={{ selected: page === i.id }} style={{ height: 38, borderRadius: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: page === i.id ? c.card : "transparent", borderWidth: page === i.id ? 1 : 0, borderColor: c.line }}><Icon icon={i.icon} size={16} color={page === i.id ? c.text : c.muted} /><Text style={text}>{i.label}</Text></Pressable>)}</View>)}
    </ScrollView>
    <Pressable onPress={() => go("settings")} style={{ ...row, borderTopWidth: 1, borderTopColor: c.line }}><Icon icon={officialIcons.settings} size={16} color={c.muted} /><Text style={text}>设置</Text></Pressable>
  </View>;
  const modal = (visible: boolean, close: () => void, title: string, children: React.ReactNode) => <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center", padding: compact ? 12 : 40 }}><View style={{ ...card, width: "100%", maxWidth: 640, maxHeight: "90%", alignSelf: "center" }}><View style={row}><Text style={{ ...text, fontWeight: "600", flex: 1 }}>{title}</Text>{button("关闭", close)}</View><ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView></View></View></Modal>;
  const shown = expanded ? state?.agents ?? [] : (state?.agents ?? []).slice(0, 2);
  return <View style={{ flex: 1, flexDirection: "row", backgroundColor: c.bg }}>
    {!compact && <View style={{ width: 212 }}>{sidebar}</View>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ ...row, minHeight: 52, paddingVertical: 10 }}>
        {compact && button("☰", () => setDrawer(true))}<Text style={{ ...muted, flex: 1 }}>{group}  /  <Text style={{ color: c.text, fontWeight: "600" }}>{label}</Text></Text>
        {loading ? <ActivityIndicator color={c.purple} /> : button("刷新", () => void refresh())}
      </View>
      <ScrollView contentContainerStyle={{ padding: compact ? 14 : 32, paddingTop: 16, paddingBottom: 48, gap: 18 }}>
        {!!error && <View accessibilityRole="alert" style={{ ...card, padding: 14 }}><Text selectable style={{ color: c.red }}>{error}</Text>{button("重试", () => void refresh())}</View>}
        {page === "agents" && <>
          <Text style={{ ...muted, lineHeight: 22 }}>打开「接入」后，magpie 中配置的模型会作为 magpie 供应商出现在 agent 的模型列表里；也可在此直接选模型。</Text>
          <View style={card}>
            {shown.map((a, index) => { const field = a.fields.find(f => f.key === "model") ?? a.fields.find(f => ["large", "executor", "planner"].includes(f.label)); return <View key={a.id} style={{ ...row, minHeight: 76, borderTopWidth: index ? 1 : 0, borderTopColor: c.line }}>
              <Icon icon={officialIcons[a.icon ?? ""] ?? "Terminal"} color={a.id === "claude" ? "#d98b6d" : c.text} size={24} />
              <View style={{ flex: 1, minWidth: 140 }}><Text style={{ ...text, fontWeight: "600" }}>{a.name}</Text><Text style={{ ...muted, marginTop: 4 }}><Text style={{ color: a.wired ? c.green : c.muted }}>● </Text>{a.wired ? "已接入" : "未接入"} · {a.wired ? "模型列表已接入 magpie" : "使用 Agent 自身设置"}</Text></View>
              <Pressable onPress={() => setDetail(a)}><Text style={muted}>详情 ›</Text></Pressable>
              {field && <Pressable disabled={busy} onPress={() => { setQuery(""); setPicker({ agent: a, field }); }} style={{ backgroundColor: c.pill, borderRadius: 7, padding: 10, minWidth: compact ? 140 : 220, maxWidth: "100%" }}><Text numberOfLines={1} style={text}>{field.value || "Agent 默认模型"}  ⌄</Text></Pressable>}
              <Switch accessibilityLabel={`${a.name} 接入 Magpie`} value={!!a.wired} disabled={busy} trackColor={{ false: c.line, true: c.text }} onValueChange={on => on ? void act(`agents/connect/${a.id}`, {}) : setConfirmDisconnect(a)} />
            </View>; })}
            {!state && loading && <View style={row}><ActivityIndicator /><Text style={muted}>正在读取本机 Agent…</Text></View>}
            {state?.agents.length === 0 && <View style={row}><Text style={muted}>本机尚未发现 Agent。</Text></View>}
            {!!state && state.agents.length > 2 && <Pressable onPress={() => setExpanded(!expanded)} style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.line }}><Text style={{ ...muted, textAlign: "center" }}>{expanded ? "收起" : `显示其余 ${state.agents.length - 2} 个`} ⌄</Text></Pressable>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}><Text style={{ ...muted, fontWeight: "600" }}>方案</Text>{state?.profiles.length ? state.profiles.map(p => button(p.name, () => void act("profile/use", { name: p.name }))) : <Text style={muted}>还没有 · 保存当前设置，之后一键切回</Text>}{button("＋ 保存当前", () => setProfileName(""))}</View>
        </>}
        {page === "providers" && <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><TextInput accessibilityLabel="查找供应商" style={{ ...input, flex: 1 }} placeholder="查找供应商" placeholderTextColor={c.muted} value={search} onChangeText={setSearch} />{button("＋ 添加供应商", () => { setForm(freshForm); setEditing(true); })}</View>
          <View style={card}>{vendors.providers.filter(p => `${p.name} ${p.id}`.toLowerCase().includes(search.toLowerCase())).map((p, i) => <View key={p.id} style={{ ...row, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}><Icon icon={I_providers} size={20} color={c.muted} /><View style={{ flex: 1, minWidth: 120 }}><Text style={{ ...text, fontWeight: "600" }}>{p.name || p.id}</Text><Text numberOfLines={1} style={muted}>{p.chat || p.anthropic || p.responses || p.preset || p.id}</Text></View>{button("编辑", () => { setForm({ ...freshForm, id: p.id, name: p.name, url: p.chat || p.anthropic || p.responses || "", protocol: p.anthropic ? "anthropic" : p.responses ? "responses" : "chat", preset: p.preset ?? "" }); setEditing(true); })}{button("测试", () => void act("provider/test", { id: p.id }))}{button("删除", () => setConfirmDelete(p), true)}</View>)}
            {!vendors.providers.length && !loading && <View style={{ padding: 40, gap: 10, alignItems: "center" }}><Text style={text}>尚未添加供应商</Text><Text style={muted}>添加订阅供应商或自定义中转，配置 URL 和 API Key。</Text></View>}
          </View>
        </>}
        {endpoints[page] && <>
          {!!sectionError && <Text style={{ color: c.red }}>{sectionError}</Text>}
          {page === "settings" && <View style={{ ...card, ...row }}><Text style={{ ...text, flex: 1 }}>插件外观</Text>{([ ["system", "跟随 Paseo"], ["light", "浅色"], ["dark", "暗色"] ] as const).map(([value, title]) => <View key={value}>{button(`${appearance === value ? "● " : ""}${title}`, () => void saveAppearance(value))}</View>)}</View>}
          {!sectionError && <SecondaryPage key={page} page={page} data={section} colors={c} act={secondaryAct} />}
        </>}
      </ScrollView>
    </View>
    <Modal visible={compact && drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}><View style={{ flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,.35)" }}><View style={{ width: 260 }}>{sidebar}</View><Pressable accessibilityLabel="关闭导航" style={{ flex: 1 }} onPress={() => setDrawer(false)} /></View></Modal>
    {modal(!!picker, () => setPicker(null), `选择模型 · ${picker?.agent.name ?? ""}`, <><TextInput value={query} onChangeText={setQuery} style={input} placeholder="搜索模型" placeholderTextColor={c.muted} />{button("Agent 默认", () => picker && void act("set", { agent: picker.agent.id, field: picker.field.key, value: "" }, () => setPicker(null)))}{picker?.field.options.filter(o => `${o.label} ${o.value} ${o.group}`.toLowerCase().includes(query.toLowerCase())).map(o => <Pressable key={o.value} disabled={busy} onPress={() => void act("set", { agent: picker.agent.id, field: picker.field.key, value: o.value }, () => setPicker(null))} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: c.line }}><Text style={text}>{o.label || o.value}</Text><Text style={muted}>{o.group || o.note}</Text></Pressable>)}</>)}
    {modal(!!detail, () => setDetail(null), `${detail?.name ?? ""} · 详情`, <><Text selectable style={muted}>{detail?.path}</Text>{detail?.fields.map(f => <View key={f.key} style={{ gap: 6 }}><Text style={muted}>{f.label}</Text>{button(f.value || "默认", () => { setPicker({ agent: detail, field: f }); setDetail(null); })}</View>)}</>)}
    {modal(editing, () => setEditing(false), form.id ? "编辑供应商" : "添加供应商", <>
      {!form.id && <><Text style={muted}>供应商预设</Text><ScrollView horizontal contentContainerStyle={{ gap: 6 }}>{button("自定义中转", () => setForm(freshForm))}{vendors.presets.map(p => button(p.name, () => setForm({ ...freshForm, preset: p.id, name: p.name, url: p.chat || p.anthropic || p.responses || "", protocol: p.chat ? "chat" : p.anthropic ? "anthropic" : "responses" })))}</ScrollView></>}
      <Text style={muted}>名称</Text><TextInput value={form.name} onChangeText={v => setForm({ ...form, name: v })} style={input} />
      <Text style={muted}>API Key {form.id ? "（留空保留原密钥）" : ""}</Text><TextInput value={form.key} onChangeText={v => setForm({ ...form, key: v })} style={input} autoCapitalize="none" autoCorrect={false} secureTextEntry />
      <Text style={muted}>接口协议</Text><View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{["chat", "anthropic", "responses"].map(p => button(`${form.protocol === p ? "● " : ""}${p}`, () => setForm({ ...form, protocol: p })))}</View>
      <Text style={muted}>Base URL</Text><TextInput value={form.url} onChangeText={v => setForm({ ...form, url: v })} style={input} autoCapitalize="none" autoCorrect={false} placeholder="https://api.example.com/v1" placeholderTextColor={c.muted} />
      <Text style={muted}>模型 ID（逗号分隔；编辑留空保留原列表）</Text><TextInput value={form.models} onChangeText={v => setForm({ ...form, models: v })} style={input} autoCapitalize="none" />
      {button(busy ? "保存中…" : "保存", () => {
        if (!form.name.trim() || (!form.id && !form.key.trim())) { setError("名称和新供应商 API Key 为必填项"); return; }
        try { const u = new URL(form.url); if (!["https:", "http:"].includes(u.protocol)) throw new Error(); } catch { setError("请填写有效的 HTTP 或 HTTPS Base URL"); return; }
        const existing = vendors.providers.find(p => p.id === form.id);
        void act("provider/save", { ...(existing ?? {}), ...(existing ? { chat: "", anthropic: "", responses: "" } : {}), id: form.id || form.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "relay", name: form.name.trim(), key: form.key.trim(), preset: form.preset, [form.protocol]: form.url.trim(), new: !form.id, ...(form.models.trim() ? { models: form.models.split(",").map(s => s.trim()).filter(Boolean) } : {}) }, () => { setEditing(false); setForm(freshForm); });
      })}
      {!!error && <Text selectable style={{ color: c.red }}>{error}</Text>}
    </>)}
    {modal(!!confirmDelete, () => setConfirmDelete(null), "删除供应商", <><Text style={text}>删除 {confirmDelete?.name}？依赖此供应商的模型将失去此入口。</Text>{button("确认删除", () => confirmDelete && void act("provider/delete", { id: confirmDelete.id }, () => setConfirmDelete(null)), true)}</>)}
    {modal(!!confirmDisconnect, () => setConfirmDisconnect(null), "断开接入", <><Text style={text}>将 {confirmDisconnect?.name} 恢复为接入前的配置。</Text>{button("确认断开", () => confirmDisconnect && void act(`agents/disconnect/${confirmDisconnect.id}`, {}, () => setConfirmDisconnect(null)))}</>)}
    {modal(profileName !== null, () => setProfileName(null), "保存当前方案", <><TextInput style={input} value={profileName ?? ""} onChangeText={setProfileName} placeholder="方案名称" placeholderTextColor={c.muted} />{button("保存", () => profileName?.trim() && void act("profile/save", { name: profileName.trim() }, () => setProfileName(null)))}</>)}
  </View>;
}

/** Bounded structured inspector until each secondary view is implemented. Secrets are never rendered. */
function DataView({ value, color, muted, depth = 0 }: { value: unknown; color: string; muted: string; depth?: number }) {
  if (depth > 3) return <Text style={{ color: muted }}>展开结构待实现</Text>;
  if (value == null) return <Text style={{ color: muted }}>暂无数据</Text>;
  if (typeof value !== "object") return <Text selectable style={{ color, fontSize: 13 }}>{String(value)}</Text>;
  const entries = Object.entries(value).filter(([key]) => !/key|token|secret|password|cookie|authorization/i.test(key));
  return <View style={{ gap: 8 }}>{entries.slice(0, 40).map(([key, v]) => <View key={key} style={{ paddingLeft: depth * 4, gap: 3 }}><Text style={{ color: muted, fontSize: 12 }}>{key}</Text><DataView value={v} color={color} muted={muted} depth={depth + 1} /></View>)}{entries.length > 40 && <Text style={{ color: muted }}>另有 {entries.length - 40} 项，完整列表界面待实现</Text>}</View>;
}
