import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import { officialApi } from "../shared/contracts";
type Session = { id: string; agent: string; name?: string; title: string; cwd?: string; last?: string; resume?: string; transcript?: boolean; cost?: number; gateway?: boolean; deletable?: boolean; size?: number; models?: { model?: string; tokens?: number; cost?: number }[]; via?: { model?: string; provider?: string; reasoning?: string }[] };
type Manage = { sessions?: Session[]; agents?: { agent: string; name?: string; count?: number }[]; agent?: string; trash?: { key: string; agent?: string; id?: string; title?: string; cwd?: string; deleted?: string; items?: { from?: string }[] }[]; trashDir?: string; recording?: boolean; recorded?: boolean; home?: string; reads?: { asked?: boolean; gateway?: boolean } };
type Part = { role: string; kind: string; name?: string; text: string; model?: string; cut?: number };
type Transcript = { parts: Part[]; cut?: boolean; source?: string };
type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };
export function SessionsPage({ data, colors: c }: { data: unknown; colors: Colors }) {
  const rpc = useRpc(officialApi);
  const [snapshot, setSnapshot] = useState<Manage>((data as Manage) ?? {});
  useEffect(() => setSnapshot((data as Manage) ?? {}), [data]);
  const sessions = snapshot.sessions ?? [];
  const agents = snapshot.agents ?? [];
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState("");
  const [selected, setSelected] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const close = () => { generation.current++; setSelected(null); setTranscript(null); setLoading(false); setError(""); };
  const open = async (s: Session) => {
    const g = ++generation.current;
    setSelected(s); setTranscript(null); setError(""); setMessageQuery(""); setLoading(true);
    try {
      const r = await rpc({ path: `sessions/transcript?agent=${encodeURIComponent(s.agent)}&id=${encodeURIComponent(s.id)}`, method: "GET" });
      if (g !== generation.current) return;
      if (!r.ok) throw new Error(r.error ?? "会话读取失败");
      const result = r.data as Transcript;
      if (!Array.isArray(result?.parts)) throw new Error("会话接口缺少消息列表");
      setTranscript(result);
    } catch (e) { if (g === generation.current) setError(String(e)); }
    finally { if (g === generation.current) setLoading(false); }
  };
  const text = { color: c.text, fontSize: 14 };
  const note = { color: c.muted, fontSize: 13, lineHeight: 20 };
  const box = { borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 16, gap: 8 };
  const input = { ...text, backgroundColor: c.pill, borderRadius: 8, padding: 12 };
  const button = (label: string, fn: () => void) => <Pressable accessibilityRole="button" onPress={fn} style={{ padding: 10, borderRadius: 7, backgroundColor: c.pill }}><Text style={text}>{label}</Text></Pressable>;
  const rows = sessions.filter(s => (!agent || s.agent === agent) && `${s.title} ${s.name} ${s.agent} ${s.cwd} ${(s.models ?? []).map(m => m.model).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const reload = async (name = agent) => { const r = await rpc({ path: `sessions/manage${name ? `?agent=${encodeURIComponent(name)}` : ""}`, method: "GET" }); if (!r.ok) throw new Error(r.error ?? "会话刷新失败"); setSnapshot((r.data as Manage) ?? {}); setNotice("会话已刷新"); };
  const searchRemote = async () => { if (!query.trim() || !agent) return; const r = await rpc({ path: `sessions/search?agent=${encodeURIComponent(agent)}&q=${encodeURIComponent(query.trim())}`, method: "GET" }); if (!r.ok) setError(r.error ?? "会话搜索失败"); else setNotice(`搜索完成：${((r.data as { hits?: unknown[] })?.hits ?? []).length} 个匹配`); };
  const post = async (path: string, body: unknown) => { setRecordingBusy(true); setError(""); try { const r = await rpc({ path, method: "POST", body }); if (!r.ok) throw new Error(r.error ?? "操作失败"); setNotice("操作已完成"); } catch (e) { setError(String(e)); } finally { setRecordingBusy(false); } };
  const trash = snapshot.trash ?? [];
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {button("刷新", () => void reload().catch(e => setError(String(e))))}
      {button(showTrash ? "返回会话" : `回收站${trash.length ? ` (${trash.length})` : ""}`, () => setShowTrash(v => !v))}
      {snapshot.recording !== undefined && button(snapshot.recording ? "停止记录网关会话" : "记录网关会话", () => void post("sessions/recording", { on: !snapshot.recording }).then(() => reload()))}
      {!!notice && <Text style={note}>{notice}</Text>}
    </View>
    {!showTrash && <>
      <TextInput accessibilityLabel="搜索会话" value={query} onChangeText={setQuery} onSubmitEditing={() => void searchRemote()} placeholder="搜索标题、Agent、工作目录或消息内容" placeholderTextColor={c.muted} style={input} />
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{button(`${!agent ? "● " : ""}全部`, () => setAgent(""))}{(agents.length ? agents.map(a => a.agent) : [...new Set(sessions.map(s => s.agent))]).map(id => <View key={id}>{button(`${agent === id ? "● " : ""}${agents.find(a => a.agent === id)?.name || id}`, () => setAgent(id))}</View>)}</ScrollView>
      {!!agent && !!query.trim() && button("搜索消息内容", () => void searchRemote())}
    </>}
    {showTrash && <View style={{ gap: 10 }}>{!trash.length && <View style={{ ...box, padding: 36 }}><Text style={text}>回收站为空</Text></View>}{trash.map(t => <View key={t.key} style={box}><Text style={{ ...text, fontWeight: "600" }}>{t.title || t.id || t.key}</Text><Text style={note}>{t.agent} · {t.cwd || ""}</Text><View style={{ flexDirection: "row", gap: 8 }}>{button("恢复", () => void post("sessions/restore", { key: t.key }).then(() => reload()))}{button("永久删除", () => void post("sessions/purge", { keys: [t.key] }).then(() => reload()))}</View></View>)}</View>}
    {!showTrash && <>
    {!!snapshot.reads && snapshot.reads.asked === false && <View style={box}><Text style={text}>尚未允许读取 Agent 会话</Text><Text style={note}>当前只显示网关记录；请在 Magpie 隐私设置中允许读取本机 Agent 会话。</Text></View>}
    {!!snapshot.recording && <Text style={note}>网关会话记录已开启；文本保存在本机，列表中的网关会话可查看完整对话。</Text>}
    {!rows.length && <View style={{ ...box, padding: 36 }}><Text style={text}>{sessions.length ? "没有匹配会话" : "还没有会话"}</Text><Text style={note}>显示服务器本机 Magpie 已读取的 Agent 会话。</Text></View>}
    {rows.map(s => <Pressable key={`${s.agent}:${s.id}`} accessibilityRole="button" accessibilityLabel={`阅读会话 ${s.title || s.id}`} onPress={() => void open(s)} style={box}><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Text numberOfLines={2} style={{ ...text, flex: 1, fontWeight: "600" }}>{s.title || s.id}</Text><Text style={note}>阅读 ›</Text></View><Text style={note}>{s.name || s.agent} · {s.last ? new Date(s.last).toLocaleString() : ""}</Text><Text numberOfLines={1} style={note}>{s.cwd}</Text>{typeof s.cost === "number" && <Text style={note}>${s.cost.toFixed(4)}</Text>}</Pressable>)}
    <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={close}><View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", padding: 12, justifyContent: "center" }}><View style={{ ...box, width: "100%", maxWidth: 960, height: "94%", alignSelf: "center" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text numberOfLines={2} style={{ ...text, flex: 1, fontWeight: "600" }}>{selected?.title || "会话"}</Text>{button("关闭", close)}</View>
      <TextInput accessibilityLabel="搜索会话消息" placeholder="搜索会话消息" placeholderTextColor={c.muted} value={messageQuery} onChangeText={setMessageQuery} style={input} />
      {loading && <ActivityIndicator color={c.green} />}{!!error && <View style={{ gap: 8 }}><Text accessibilityRole="alert" selectable style={{ color: "#d54949" }}>{error}</Text>{button("重试读取", () => selected && void open(selected))}</View>}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
        {transcript?.cut && <Text style={note}>官方接口已截断此会话，当前显示其保留的内容。</Text>}
        {transcript?.parts.filter(p => `${p.text} ${p.name || ""}`.toLowerCase().includes(messageQuery.toLowerCase())).map((p, i) => <View key={i} style={{ padding: 14, borderRadius: 10, backgroundColor: p.role === "user" ? c.pill : c.card, borderWidth: 1, borderColor: c.line, gap: 8 }}><Text style={{ ...note, fontWeight: "600" }}>{({ user: "用户", assistant: "助手", tool: "工具" } as Record<string, string>)[p.role] || p.role} · {p.name || p.kind}{p.model ? ` · ${p.model}` : ""}</Text><Text selectable style={{ ...text, lineHeight: 23 }}>{p.text || (p.kind === "image" ? "图片消息（当前未渲染附件）" : "空消息")}</Text>{!!p.cut && <Text style={note}>此消息另有 {p.cut} 个字符被上游截断</Text>}</View>)}
        {transcript && !transcript.parts.length && <Text style={note}>此会话暂无可读取的消息。</Text>}
        {!!selected?.resume && <View style={{ ...box, backgroundColor: c.pill }}><Text style={note}>服务器上的继续命令（长按复制；不会自动执行）</Text><Text selectable style={text}>{selected.resume}</Text></View>}
      </ScrollView>
    </View></View></Modal></>}
  </View>;
}
