import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { RoutingEditor, type EditableGroup, type EditorCatalog } from "./routing-editor";
import { RoutingInspector, RoutingHistory, canceled, failed, routeStatus, type Route } from "./routing-inspector";
type Group = { id: string; name: string; members: string[]; routing?: string; disabled?: boolean; auto?: boolean; ref?: string; [key: string]: unknown };
type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };
type Trace = Route;
const templateLabels: Record<string, { name: string; description: string }> = {
  smart: { name: "难题用强模型，简单用便宜模型", description: "按任务难度分流，兼顾能力与成本。" },
  thrifty: { name: "低价优先", description: "先尝试低价模型，失败后切换到强模型。" },
  steady: { name: "稳定兜底", description: "组合不同供应商的强模型，故障时自动切换。" },
};
const strategies = [["", "智能"], ["order", "按顺序"], ["rotate", "轮转"], ["usage", "最低用量"], ["pace", "到期优先"], ["weight", "按权重"], ["free", "免费优先"], ["fast", "速度优先"], ["cheap", "最低成本"], ["drain", "用尽切换"], ["expiring", "免费配额到期"], ["manual", "手动"]];
export function RoutingPage({ data, colors: c, act, read }: { data: unknown; colors: Colors; act: (path: string, body: unknown) => Promise<void>; read: (path: string) => Promise<unknown> }) {
  const d = data as { groups?: Group[]; found?: boolean; skip?: string[]; skippable?: { id: string; name: string }[]; templates?: { kind: string; group: Group; why?: string; need?: string; of?: string }[] };
  const [originalId, setOriginalId] = useState("");
  const [draft, setDraft] = useState<Group | null>(null), [members, setMembers] = useState(""), [remove, setRemove] = useState<Group | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [trace, setTrace] = useState<Trace[]>([]), [selected, setSelected] = useState<Trace | null>(null), [live, setLive] = useState(true);
  const text = { color: c.text, fontSize: 14 }, note = { color: c.muted, fontSize: 13, lineHeight: 19 };
  const card = { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 16, gap: 12 };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{ padding: 10, borderRadius: 7, backgroundColor: c.pill, opacity: busy ? .5 : 1 }}><Text style={text}>{label}</Text></Pressable>;
  useEffect(() => {
    if (!live) return;
    let alive = true, after = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        // Magpie treats any nonempty wait value (including "0") as a 25s wait.
        const raw = await read(`gateway/trace?after=${after}`) as { routes?: Trace[]; seq?: number } | null;
        if (!alive) return;
        if (Array.isArray(raw?.routes)) setTrace(old => {
          const merged = new Map(old.map(r => [r.id, r]));
          for (const route of raw.routes!) merged.set(route.id, route);
          return [...merged.values()].slice(-80);
        });
        if (typeof raw?.seq === "number") after = raw.seq;
        setError("");
      } catch (e) { if (alive) setError(String(e)); }
      finally { if (alive) timer = setTimeout(() => void poll(), 2500); }
    };
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [live, read]);
  const stats = useMemo(() => ({ requests: trace.length, done: trace.filter(r => r.done).length, errors: trace.filter(failed).length, canceled: trace.filter(canceled).length, rerouted: trace.filter(r => (r.tries?.length ?? 0) > 1 || !!r.moved).length }), [trace]);
  const editTemplate = (g: Group, name: string) => {
    const base = g.id || "routing-group";
    let id = base, suffix = 2;
    while (d.groups?.some(existing => existing.id === id)) id = `${base}-${suffix++}`;
    edit({ ...g, id, name, members: [...(g.members ?? [])] });
    setOriginalId("");
  };
  const edit = (g: Group) => { setDraft(g); setOriginalId(d.groups?.some(v => v.id === g.id) ? g.id : ""); setMembers(g.members.join("\n")); setError(""); };
  const submit = async (path: string, body: unknown, close: () => void) => { setBusy(true); setError(""); try { await act(path, body); close(); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  return <View style={{ gap: 16 }}>
    <View style={{ ...card, gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}><Text style={{ ...text, fontWeight: "600", flex: 1 }}>实时路由决策</Text>{button(live ? "● 实时中" : "实时已暂停", () => setLive(v => !v))}{button("清空历史", () => { setTrace([]); setSelected(null); })}</View><Text style={note}>网关 trace 原样读取：请求、首选成员、重试链、失败原因和最终落点。</Text><View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>{[["请求", stats.requests], ["已完成", stats.done], ["重路由", stats.rerouted], ["错误", stats.errors], ["取消", stats.canceled]].map(([k, v]) => <View key={String(k)} style={{ backgroundColor: c.pill, borderRadius: 8, padding: 10, minWidth: 78 }}><Text style={note}>{k}</Text><Text style={{ ...text, fontSize: 21, fontWeight: "600" }}>{v}</Text></View>)}</View>{!trace.length && <Text style={note}>暂无实时请求。通过网关调用后，这里会显示真实决策。</Text>}</View>
    {!!trace.length && <View style={card}><Text style={{ ...text, fontWeight: "600" }}>请求历史</Text><ScrollView style={{ maxHeight: 360 }}>{[...trace].reverse().map((r, i) => <Pressable key={`${r.id ?? i}:${r.seq ?? i}`} onPress={() => setSelected(selected?.id === r.id ? null : r)} style={{ paddingVertical: 11, borderTopWidth: 1, borderColor: c.line, gap: 4 }}><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Text style={text}>{r.model || "未命名模型"}</Text><Text style={{ color: r.error ? "#d54949" : r.done ? c.green : c.muted }}>{routeStatus(r)}</Text><Text style={note}>{r.time ? new Date(r.time).toLocaleTimeString() : ""}</Text></View><Text style={note}>{r.agent || "Agent"} → {r.provider || r.group?.name || "等待决策"} · {r.tries?.length || 0} 次尝试</Text>{selected?.id === r.id && <RoutingInspector route={r} colors={c} read={read} />}</Pressable>)}</ScrollView></View>}
    <View style={card}><RoutingHistory colors={c} read={read} /></View>
    <View style={card}><Text style={{ ...text, fontWeight: "600" }}>自动路由组</Text><Text style={note}>把多个供应商的同名模型合成一个入口；关闭时 Magpie 会调整正在引用自动组的 Agent。</Text>{button(d.found ? "● 自动发现已开启" : "自动发现已关闭", () => void submit("groups/found", { on: !d.found }, () => {}))}{d.skippable?.map(p => <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ ...note, flex: 1 }}>{p.name}</Text>{button(d.skip?.includes(p.id) ? "已排除 · 点击纳入" : "已纳入 · 点击排除", () => void submit("groups/skip", { skip: d.skip?.includes(p.id) ? d.skip.filter(id => id !== p.id) : [...(d.skip ?? []), p.id] }, () => {}))}</View>)}</View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}><Text style={{ ...text, fontWeight: "600" }}>路由组</Text>{button("＋ 添加路由组", () => edit({ id: "", name: "", members: [], routing: "order" }))}</View>
    {!d.groups?.length && <View style={card}><Text style={text}>暂无路由组</Text><Text style={note}>将多个 provider/model 组合成一个入口，在成员之间分配请求或故障切换。</Text></View>}
    {d.groups?.map(g => <View key={g.id} style={card}><View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}><View style={{ flex: 1, minWidth: 130 }}><Text style={{ ...text, fontWeight: "600" }}>{g.name || g.id}</Text><Text selectable style={note}>{g.ref || `group/${g.id}`} · {strategies.find(([id]) => id === g.routing)?.[1] || g.routing || "智能"}</Text></View>{!g.auto && <>{button("编辑", () => edit(g))}{button("删除", () => { setRemove(g); setError(""); })}</>}</View>{g.members.map((m, i) => <Text key={`${m}:${i}`} selectable style={note}>{i + 1}. {m}</Text>)}</View>)}
    {!!d.templates?.length && <><Text style={note}>三种标配模板</Text>{d.templates.map(t => { const label = templateLabels[t.kind]; const reason = t.need === "provider" ? "请先添加可用的模型供应商。" : t.need === "providers" ? `请再添加一个供应商，当前只有 ${t.of || "一个供应商"}。` : t.need === "cheap" ? `请添加比 ${t.of || "当前强模型"} 更便宜的模型。` : "当前模型配置尚未满足此模板的创建条件。"; return <View key={t.kind} style={card}><Text style={text}>{label?.name || t.group.name}</Text>{label && <Text style={note}>{label.description}</Text>}{t.group.members?.length > 0 && <Text style={note}>{t.group.members.join(" → ")}</Text>}{t.why || t.need ? <Text style={note}>{reason}</Text> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{button("添加", () => void submit("groups/template", { kind: t.kind, name: label?.name || t.group.name }, () => {}))}{button("先编辑", () => editTemplate(t.group, label?.name || t.group.name))}</View>}</View>; })}</>}
    {!!error && <Text accessibilityRole="alert" style={{ color: "#d54949" }}>{error}</Text>}
    <Modal visible={!!draft || !!remove} transparent animationType="fade" onRequestClose={() => { if (!busy) { setDraft(null); setRemove(null); } }}><View style={{ flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(0,0,0,.35)" }}><View style={{ ...card, maxWidth: 920, width: "100%", maxHeight: "90%", alignSelf: "center" }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}><Text style={{ ...text, fontWeight: "600", fontSize: 18 }}>{remove ? "删除路由组" : originalId ? "编辑路由组" : "添加路由组"}</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭路由编辑窗口" disabled={busy} onPress={() => { setDraft(null); setRemove(null); }} hitSlop={8} style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: c.pill, opacity: busy ? .5 : 1 }}><Text style={{ ...text, fontSize: 24 }}>×</Text></Pressable></View><ScrollView contentContainerStyle={{ gap: 12 }}>{draft && <><Text style={{ ...text, fontWeight: "600", fontSize: 19 }}>{originalId ? "编辑路由组" : "添加路由组"}</Text><RoutingEditor draft={draft as EditableGroup} catalog={d as EditorCatalog} colors={c} busy={busy} change={value => { setDraft(value); setMembers(value.members.join("\n")); }} />{button("保存路由组", () => { if (!/^[a-z0-9][a-z0-9.-]*$/.test(draft.id) || !draft.name.trim() || (!draft.members.length && !(draft.match as string[] | undefined)?.length)) { setError("请填写名称、有效 ID 和至少一个模型或匹配模式"); return; } if (d.groups?.some(g => g.id === draft.id && g.id !== originalId)) { setError("此 ID 已存在，请使用另一个 ID"); return; } void submit("groups/save", { ...draft, from: originalId || undefined }, () => setDraft(null)); })}</>}{remove && <><Text style={text}>删除路由组 {remove.name || remove.id}？</Text><Text style={note}>引用此组的 Agent 配置会受影响。</Text>{button("确认删除路由组", () => void submit("groups/delete", { id: remove.id }, () => setRemove(null)))}</>}{!!error && <Text style={{ color: "#d54949" }}>{error}</Text>}{button("取消", () => { setDraft(null); setRemove(null); })}</ScrollView></View></View></Modal>
  </View>;
}
