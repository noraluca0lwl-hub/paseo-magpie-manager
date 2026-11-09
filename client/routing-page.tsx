import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
type Group = { id: string; name: string; members: string[]; routing?: string; disabled?: boolean; [key: string]: unknown };
type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };
const strategies = [["", "智能"], ["order", "按顺序"], ["rotate", "轮转"], ["usage", "最低用量"], ["pace", "到期优先"], ["weight", "按权重"], ["free", "免费优先"], ["fast", "速度优先"], ["drain", "用尽切换"], ["manual", "手动"]];
export function RoutingPage({ data, colors: c, act }: { data: unknown; colors: Colors; act: (path: string, body: unknown) => Promise<void> }) {
  const d = data as { groups?: Group[]; templates?: { kind: string; group: Group; why?: string }[] };
  const [draft, setDraft] = useState<Group | null>(null);
  const [members, setMembers] = useState("");
  const [remove, setRemove] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const text = { color: c.text, fontSize: 14 };
  const note = { color: c.muted, fontSize: 13 };
  const card = { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 16, gap: 12 };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{ padding: 10, borderRadius: 7, backgroundColor: c.pill, opacity: busy ? .5 : 1 }}><Text style={text}>{label}</Text></Pressable>;
  const submit = async (path: string, body: unknown, close: () => void) => {
    setBusy(true); setError(""); try { await act(path, body); close(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const edit = (g: Group) => { setDraft(g); setMembers(g.members.join("\n")); setError(""); };
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ ...text, fontWeight: "600" }}>路由组</Text>{button("＋ 添加路由组", () => edit({ id: "", name: "", members: [], routing: "order" }))}</View>
    {!d.groups?.length && <View style={card}><Text style={text}>暂无路由组</Text><Text style={note}>将多个 provider/model 组合成一个入口，在成员之间分配请求或故障切换。</Text></View>}
    {d.groups?.map(g => <View key={g.id} style={card}><View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}><View style={{ flex: 1, minWidth: 130 }}><Text style={{ ...text, fontWeight: "600" }}>{g.name || g.id}</Text><Text selectable style={note}>group/{g.id} · {strategies.find(([id]) => id === g.routing)?.[1] || g.routing || "智能"}</Text></View>{button("编辑", () => edit(g))}{button("删除", () => { setRemove(g); setError(""); })}</View>{g.members.map((m, i) => <Text key={`${m}:${i}`} selectable style={note}>{i + 1}. {m}</Text>)}</View>)}
    {!!d.templates?.length && <><Text style={note}>快速创建</Text>{d.templates.map(t => <View key={t.kind} style={card}><Text style={text}>{t.group.name}</Text>{t.why ? <Text style={note}>{t.why}</Text> : button("使用模板", () => void submit("groups/template", { kind: t.kind, name: t.group.name }, () => {}))}</View>)}</>}
    {!!error && <Text accessibilityRole="alert" style={{ color: "#d54949" }}>{error}</Text>}
    <Modal visible={!!draft || !!remove} transparent animationType="fade" onRequestClose={() => { if (!busy) { setDraft(null); setRemove(null); } }}><View style={{ flex: 1, padding: 16, justifyContent: "center", backgroundColor: "rgba(0,0,0,.35)" }}><View style={{ ...card, maxWidth: 640, width: "100%", maxHeight: "90%", alignSelf: "center" }}><ScrollView contentContainerStyle={{ gap: 12 }}>
      {draft && <><Text style={{ ...text, fontWeight: "600" }}>{draft.id ? "编辑路由组" : "添加路由组"}</Text><Text style={note}>ID（小写字母、数字、点、短横线）</Text><TextInput accessibilityLabel="路由组 ID" value={draft.id} autoCapitalize="none" onChangeText={id => setDraft({ ...draft, id })} style={{ ...text, padding: 12, borderRadius: 7, backgroundColor: c.pill }} /><Text style={note}>名称</Text><TextInput accessibilityLabel="路由组名称" value={draft.name} onChangeText={name => setDraft({ ...draft, name })} style={{ ...text, padding: 12, backgroundColor: c.pill, borderRadius: 7 }} /><Text style={note}>成员（每行一个 provider/model 或 group/id）</Text><TextInput accessibilityLabel="路由组成员" multiline value={members} autoCapitalize="none" onChangeText={setMembers} style={{ ...text, minHeight: 100, padding: 12, backgroundColor: c.pill, borderRadius: 7 }} /><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{strategies.map(([id, label]) => <View key={id}>{button(`${draft.routing === id ? "● " : ""}${label}`, () => setDraft({ ...draft, routing: id }))}</View>)}</View>{button("保存路由组", () => { if (!/^[a-z0-9][a-z0-9.-]*$/.test(draft.id) || !members.trim()) { setError("请填写有效 ID 和至少一个成员"); return; } void submit("groups/save", { ...draft, members: members.split(/[\n,]/).map(s => s.trim()).filter(Boolean) }, () => setDraft(null)); })}</>}
      {remove && <><Text style={text}>删除路由组 {remove.name || remove.id}？</Text><Text style={note}>引用此组的 Agent 配置会受影响。</Text>{button("确认删除路由组", () => void submit("groups/delete", { id: remove.id }, () => setRemove(null)))}</>}
      {!!error && <Text style={{ color: "#d54949" }}>{error}</Text>}{button("取消", () => { setDraft(null); setRemove(null); })}
    </ScrollView></View></View></Modal>
  </View>;
}
