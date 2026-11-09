import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { RoutingPage } from "./routing-page";
import { SessionsPage } from "./sessions-page";

type RecordValue = Record<string, unknown>;
const obj = (v: unknown): RecordValue => v && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : {};
const arr = (v: unknown): RecordValue[] => Array.isArray(v) ? v.map(obj) : [];
const say = (v: unknown) => typeof v === "string" || typeof v === "number" ? String(v) : "";
export function SecondaryPage({ page, data, colors: c, act }: {
  page: string; data: unknown; colors: { text: string; muted: string; card: string; line: string; pill: string; green: string };
  act: (path: string, body: unknown) => Promise<void>;
}) {
  const [tab, setTab] = useState("agents");
  const [query, setQuery] = useState("");
  const [operationError, setOperationError] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const d = obj(data);
  const label = { color: c.text, fontSize: 14 };
  const note = { color: c.muted, fontSize: 13, lineHeight: 20 };
  const card = { borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, overflow: "hidden" as const };
  const row = { padding: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: c.line };
  const tabs = (items: [string, string][]) => <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{items.map(([id, title]) => <Pressable key={id} onPress={() => setTab(id)} style={{ padding: 10, borderRadius: 7, backgroundColor: tab === id ? c.card : c.pill }}><Text style={label}>{title}</Text></Pressable>)}</ScrollView>;
  const empty = (title: string, sub: string) => <View style={{ ...card, padding: 36, gap: 10, alignItems: "center" }}><Text style={label}>{title}</Text><Text style={{ ...note, textAlign: "center" }}>{sub}</Text></View>;
  const list = (items: RecordValue[], title: (v: RecordValue) => string, sub: (v: RecordValue) => string, none: string) => !items.length ? empty(none, "刷新后显示本机 Magpie 的最新数据") : <View style={card}>{items.map((v, i) => <View key={say(v.id) || String(i)} style={row}><Text style={{ ...label, fontWeight: "600" }}>{title(v)}</Text><Text selectable style={note}>{sub(v)}</Text></View>)}</View>;
  const stats = (items: [string, unknown][]) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{items.map(([name, value]) => <View key={name} style={{ ...card, padding: 20, flexGrow: 1, minWidth: 130 }}><Text style={note}>{name}</Text><Text style={{ ...label, fontSize: 26, marginTop: 8 }}>{say(value) || "0"}</Text></View>)}</View>;
  if (data == null) return <Text style={note}>正在读取官方接口…</Text>;
  if (page === "sessions") return <SessionsPage data={data} colors={c} />;
  if (page === "library") return <View style={{ gap: 16 }}>{tabs([["agents", "Agent"], ["servers", "MCP 服务器"], ["skills", "技能"], ["hooks", "Hooks"], ["subagents", "子 Agent"]])}{list(arr(d[tab]), v => say(v.name || v.id), v => [v.instructions, v.skills, v.command, v.description, v.path].map(say).filter(Boolean).join("\n"), "暂无项目")}<Text style={note}>当前为资源列表；编辑、分发与安装操作尚未接入。</Text></View>;
  if (page === "routing") return <RoutingPage data={data} colors={c} act={act} />;
  if (page === "legacy-routing") return <View style={{ gap: 16 }}>{tabs([["agents", "路由组"], ["templates", "模板"]])}{list(arr(tab === "templates" ? d.templates : d.groups), v => say(v.name || v.id || obj(v.group).name || v.kind), v => say(v.why) || `${say(v.routing)} · ${Array.isArray(v.members) ? v.members.length : 0} 个成员`, tab === "templates" ? "暂无模板" : "暂无路由组")}<Text style={note}>当前为路由组和模板列表；路由追踪、规则编辑尚未接入。</Text></View>;
  if (page === "gateway") return <View style={{ gap: 16 }}>{stats([["供应商", Object.keys(obj(d.providers)).length], ["厂商", Array.isArray(d.vendors) ? d.vendors.length : 0]])}{list(Object.entries(obj(d.providers)).map(([id, v]) => ({ id, ...obj(v) })), v => say(v.name || v.id), v => say(v.status || v.url), "暂无上游状态")}<Text style={note}>当前为上游状态；网关密钥管理、最近请求与监听设置尚未接入。</Text></View>;
  if (page === "usage") {
    const rows = Array.isArray(data) ? arr(data) : arr(d.quotas || d.accounts);
    return <View style={{ gap: 16 }}>{stats([["配额条目", rows.length]])}{!rows.length && empty("暂无配额数据", "添加供应商后，此处显示订阅窗口或账户余额。")}{rows.map((v, i) => <View key={`${say(v.provider)}:${say(v.user)}:${i}`} style={{ ...card, padding: 18, gap: 12 }}><Text style={{ ...label, fontWeight: "600" }}>{say(v.name || v.provider)}</Text><Text style={note}>{say(v.plan || v.kind)} {say(v.user)}</Text>{!!v.balance && <Text style={{ ...label, fontSize: 24 }}>{say(v.balance)}</Text>}{arr(v.windows).map((w, j) => <View key={j} style={{ gap: 6 }}><Text style={note}>{say(w.name)} · {w.unlimited ? "不限量" : say(w.display) || `已用 ${say(w.used)}% · 剩余 ${say(w.remaining)}%`}</Text><View style={{ height: 5, backgroundColor: c.pill, borderRadius: 3 }}><View style={{ height: 5, width: `${Math.max(0, Math.min(100, Number(w.used) || 0))}%`, backgroundColor: c.green, borderRadius: 3 }} /></View>{!!w.resetsAt && <Text style={note}>重置：{say(w.resetsAt)}</Text>}</View>)}{!!v.error && <Text style={{ color: "#d54949" }}>{say(v.error)}</Text>}<Pressable disabled={refreshing !== null} onPress={async () => { const id = say(v.provider); setRefreshing(`${id}:${i}`); setOperationError(""); try { await act(`usage/quotas/refresh?provider=${encodeURIComponent(id)}${v.user ? `&user=${encodeURIComponent(say(v.user))}` : ""}`, {}); } catch (e) { setOperationError(String(e)); } finally { setRefreshing(null); } }} style={{ backgroundColor: c.pill, borderRadius: 7, padding: 10 }}><Text style={label}>{refreshing === `${say(v.provider)}:${i}` ? "刷新中…" : "刷新此账户"}</Text></Pressable></View>)}{!!operationError && <Text style={{ color: "#d54949" }}>{operationError}</Text>}<Text style={note}>用量统计图和请求明细尚未接入。</Text></View>;
  }
  if (page === "masking") return <View style={{ gap: 16 }}>{stats([["请求", d.requests], ["替换次数", d.n], ["不同值", d.distinct]])}<View style={{ ...card, padding: 20, gap: 12 }}><Text style={label}>最近 24 小时</Text><View style={{ height: 90, flexDirection: "row", gap: 3, alignItems: "flex-end" }}>{(Array.isArray(d.hours) ? d.hours : []).map((v, i) => <View key={i} accessibilityLabel={`${i} 时：${say(v)}`} style={{ flex: 1, minHeight: 2, height: Math.max(2, Number(v) / Math.max(1, ...((d.hours as number[]) || [])) * 80), backgroundColor: c.green, borderRadius: 2 }} />)}</View></View>{list(arr(d.kinds), v => say(v.kind || v.name), v => say(v.n || v.count), "尚无脱敏记录")}<Text style={note}>当前为统计视图；规则编辑和记录详情尚未接入。</Text></View>;
  if (page === "plugins") return <View style={{ gap: 16 }}><Text style={note}>这里显示 Magpie 自身的插件，不是 Paseo 插件列表。</Text>{list(arr(d.plugins), v => say(v.name || v.id), v => [v.version, v.description, v.state].map(say).filter(Boolean).join(" · "), "尚未安装 Magpie 插件")}<Text style={note}>插件安装、更新和开关尚未接入。</Text></View>;
  if (page === "settings") return <View style={{ gap: 16 }}><View style={card}>{[["版本", d.version], ["配置目录", d.dir], ["网关地址", d.gateway], ["语言", d.lang], ["货币", d.currency]].map(([name, value]) => <View key={say(name)} style={row}><Text style={note}>{say(name)}</Text><Text selectable style={label}>{say(value)}</Text></View>)}</View><Text style={note}>内置功能</Text>{list(arr(d.builtins), v => say(v.name || v.id), v => `${v.on ? "已开启" : "已关闭"} · ${say(v.sub)}`, "暂无内置功能")}<Text style={note}>当前为设置读取；除插件外观外，配置修改尚未接入。</Text></View>;
  return null;
}
