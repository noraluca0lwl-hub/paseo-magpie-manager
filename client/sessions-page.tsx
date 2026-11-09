import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import { officialApi } from "../shared/contracts";
import { ProviderIcon } from "./provider-icon";
import { copyText } from '@getpaseo/plugin/client/ui';
import { SessionDetails, CarryMenu, type DetailSession, type Carry } from './session-details';

type Session = DetailSession & { id: string; agent: string; name?: string; title?: string; cwd?: string; path?: string; last?: string; start?: string; resume?: string; transcript?: boolean; gateway?: boolean; deletable?: boolean; undeletable?: string; size?: number; cost?: number; tokens?: number; messages?: number; provider?: string; uses_provider?: string; models?: { model?: string; tokens?: number; cost?: number }[]; via?: { model?: string; provider?: string; reasoning?: string }[]; carry?: Carry[]; subagents?: unknown[] };
type Trash = { key: string; agent?: string; id?: string; title?: string; cwd?: string; deleted?: string };
type Manage = { sessions?: Session[]; agents?: { agent: string; name?: string; icon?: string; count?: number; deletable?: boolean }[]; agent?: string; trash?: Trash[]; trashDir?: string; recording?: boolean; recorded?: boolean; home?: string; reads?: { asked?: boolean; gateway?: boolean } };
type Part = { role: string; kind: string; name?: string; text: string; model?: string; cut?: number };
type Transcript = { parts: Part[]; cut?: boolean };
type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };

const fmtDate = (v?: string) => { if (!v) return ""; const d = new Date(v); if (Number.isNaN(d.getTime())) return v; const ms = Date.now() - d.getTime(); const day = Math.floor(ms / 86400000); if (day < 1) return "今天"; if (day < 2) return "昨天"; if (day < 7) return `${day}天前`; if (day < 31) return `${Math.floor(day / 7)}周前`; return `${Math.floor(day / 30)}个月前`; };
const shortPath = (p?: string, home?: string) => { if (!p) return ""; if (home && p.startsWith(home)) return `~${p.slice(home.length) || ""}`; return p; };

export function SessionsPage({ data, colors: c }: { data: unknown; colors: Colors }) {
  const rpc = useRpc(officialApi);
  const [snapshot, setSnapshot] = useState<Manage>((data as Manage) ?? {});
  const [query, setQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [detailId, setDetailId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [agentMenu, setAgentMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => setSnapshot((data as Manage) ?? {}), [data]);
  const sessions = snapshot.sessions ?? [];
  const agents = snapshot.agents ?? [];
  const agent = selectedAgent || snapshot.agent || agents[0]?.agent || sessions[0]?.agent || "";
  const text = { color: c.text, fontSize: 14 };
  const note = { color: c.muted, fontSize: 13, lineHeight: 20 };
  const box = { borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 16, gap: 8 };
  const input = { ...text, backgroundColor: c.pill, borderRadius: 8, padding: 12 };
  const button = (label: string, fn: () => void, active = false) => <Pressable accessibilityRole="button" onPress={fn} style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? c.card : c.pill, borderWidth: active ? 1 : 0, borderColor: c.line }}><Text style={text}>{label}</Text></Pressable>;
  const reload = async (name = agent) => { const r = await rpc({ path: `sessions/manage${name ? `?agent=${encodeURIComponent(name)}` : ""}`, method: "GET" }); if (!r.ok) throw new Error(r.error ?? "会话刷新失败"); setSnapshot((r.data as Manage) ?? {}); setNotice("已刷新"); };
  const post = async (path: string, body: unknown) => { const r = await rpc({ path, method: "POST", body }); if (!r.ok) throw new Error(r.error ?? "操作失败"); return r.data; };
  const open = async (s: Session) => { const g = ++generation.current; setSelected(s); setTranscript(null); setError(""); setLoading(true); try { const r = await rpc({ path: `sessions/transcript?agent=${encodeURIComponent(s.agent)}&id=${encodeURIComponent(s.id)}`, method: "GET" }); if (g !== generation.current) return; if (!r.ok) throw new Error(r.error ?? "会话读取失败"); setTranscript(r.data as Transcript); } catch (e) { if (g === generation.current) setError(String(e)); } finally { if (g === generation.current) setLoading(false); } };
  const close = () => { generation.current++; setSelected(null); setTranscript(null); setError(""); };
  const list = sessions.filter(s => s.agent === agent && `${s.title ?? ""} ${s.cwd ?? ""} ${s.id} ${(s.models ?? []).map(m => m.model).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(list.map(s => s.cwd || ""))];
  const toggle = (key: string) => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const togglePick = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const deletePicked = async () => { if (!picked.size) return; try { await post("sessions/delete", { agent, ids: [...picked] }); setPicked(new Set()); setSelecting(false); await reload(); setNotice("已移入回收站"); } catch (e) { setError(String(e)); } };
  const copyResume = async (s: Session) => { if (!s.resume) return; try { await copyText(s.resume); setNotice("继续命令已复制"); } catch { setNotice(s.resume); } };
  const deleteOne = async (s: Session) => { if (s.undeletable || s.deletable === false) { setError("此会话为只读，无法删除"); return; } try { const result = await post("sessions/delete", { agent, ids: [s.id] }) as { deleted?: string[]; refused?: { error: string }[] }; await reload(); if (result.refused?.length) throw new Error(result.refused.map(r => r.error).join("；")); if (!result.deleted?.includes(s.id)) throw new Error("后端未确认删除此会话"); setNotice("已移入回收站"); } catch (e) { setError(String(e)); } };
  const trash = snapshot.trash ?? [];
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="选择会话 Agent" onPress={() => setAgentMenu(v => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}><ProviderIcon icon={agents.find(a => a.agent === agent)?.icon} name={agents.find(a => a.agent === agent)?.name || agent || "Agent"} color={c.text} size={18}/><Text style={text}>{agents.find(a => a.agent === agent)?.name || agent || "Agent"}</Text><Text style={note}>{agents.find(a => a.agent === agent)?.count ?? 0}</Text><Text style={note}>{agentMenu ? "⌃" : "⌄"}</Text></Pressable>
      <TextInput accessibilityLabel="搜索会话" value={query} onChangeText={setQuery} placeholder="搜索会话" placeholderTextColor={c.muted} style={{ ...input, flex: 1, minWidth: 150, maxWidth: 300 }} />
      {button("选择", () => { setSelecting(v => !v); setPicked(new Set()); })}
      {button(`回收站${trash.length ? ` ${trash.length}` : ""}`, () => setShowTrash(v => !v))}
      {button("刷新", () => void reload().catch(e => setError(String(e))))}
    </View>
    {agentMenu && <View style={{ ...box, padding: 6, maxWidth: 400 }}><Text style={{ ...note, padding: 10 }}>Agent</Text>{agents.map(a => <Pressable key={a.agent} accessibilityRole="button" accessibilityLabel={`选择 ${a.name || a.agent}`} onPress={() => { setSelectedAgent(a.agent); setAgentMenu(false); setShowTrash(false); setPicked(new Set()); setExpanded(new Set()); void reload(a.agent).catch(e => setError(String(e))); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 9, backgroundColor: agent === a.agent ? c.pill : c.card }}><Text style={{ ...text, width: 16 }}>{agent === a.agent ? "✓" : ""}</Text><ProviderIcon icon={a.icon} name={a.name || a.agent} color={c.text} size={23}/><Text style={{ ...text, flex: 1, fontWeight: "600" }}>{a.name || a.agent}</Text><Text style={note}>{a.count ?? 0}</Text></Pressable>)}</View>}
    {!showTrash && <>
      {snapshot.reads?.asked === false && <Text style={note}>本机 Agent 会话读取尚未开启；当前仅显示网关记录。</Text>}
      {!!snapshot.recording && <Text style={note}>网关会话记录已开启，文本保存在本机。</Text>}
      {list.length > 0 && <View style={{ ...box, paddingVertical: 12, backgroundColor: c.pill }}><Text style={text}>有 {list.length} 个 {agents.find(a => a.agent === agent)?.name || agent} 会话</Text>{snapshot.agents && agents.length > 1 && <Text style={note}>切换上方 Agent 可查看其他供应商创建的会话。</Text>}</View>}
      {!list.length && <View style={{ ...box, padding: 30 }}><Text style={text}>没有匹配会话</Text><Text style={note}>当前 Agent：{agent || "暂无"}</Text></View>}
      {groups.map(cwd => { const key = cwd || "(无工作目录)"; const items = list.filter(s => (s.cwd || "") === cwd); const isOpen = expanded.has(key); const newest = items[0]; return <View key={key} style={{ borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, overflow: "hidden" }}>
        <Pressable onPress={() => toggle(key)} style={{ padding: 16, flexDirection: "row", gap: 10, alignItems: "center", borderBottomWidth: isOpen ? 1 : 0, borderBottomColor: c.line }}><Text style={{ ...text, width: 16 }}>{isOpen ? "⌄" : "›"}</Text><View style={{ flex: 1, gap: 4 }}><Text style={{ ...text, fontWeight: "600" }}>{cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() : "未命名会话"} <Text style={note}>{shortPath(cwd, snapshot.home)}</Text></Text><Text numberOfLines={1} style={note}>{newest?.title || newest?.id}</Text></View><View style={{ alignItems: "flex-end", gap: 3 }}><Text style={note}>{fmtDate(newest?.last || newest?.start)}</Text><Text style={note}>{items.length} 个会话</Text></View></Pressable>
        {isOpen && items.map(s => <View key={s.id}><View style={{ padding: 12, paddingLeft: 28, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{selecting && <Pressable onPress={() => togglePick(s.id)}><Text style={{ ...text, fontSize: 20 }}>{picked.has(s.id) ? "☑" : "☐"}</Text></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={`展开会话 ${s.title || s.id}`} onPress={() => setDetailId(v => v === s.id ? '' : s.id)} style={{ flex: 1, minWidth: 180, gap: 4 }}><Text numberOfLines={1} style={{ ...text, fontWeight: "600" }}>{s.title || s.id}</Text><Text numberOfLines={2} style={note}>{[s.provider, s.models?.map(m => m.model).filter(Boolean).join(", ")].filter(Boolean).join(' · ')} {fmtDate(s.last || s.start)} · {s.messages ?? 0} 条消息 · {s.size ? `${(s.size / 1024 / 1024).toFixed(1)} MB` : ""} · {s.id.slice(0, 8)}{s.gateway ? " · 网关" : ""}</Text></Pressable>{typeof s.cost === "number" && <Text style={{ ...note, color: c.green }}>≈${s.cost.toFixed(3)}</Text>}{s.resume && button("继续", () => void copyResume(s))}{s.carry?.length ? <CarryMenu session={s} colors={c} post={post} notify={setNotice} fail={setError}/> : null}<Pressable accessibilityRole="button" accessibilityLabel="删除会话" onPress={() => setDeleteTarget(s)} style={{ padding: 8, flexDirection: "row", alignItems: "center", gap: 4, opacity: s.deletable === false ? 0.45 : 1 }}><Text style={{ color: c.muted, fontSize: 14 }}>删除</Text></Pressable></View>{detailId === s.id && <SessionDetails session={s} colors={c} post={post} notify={setNotice} fail={setError} onRead={() => void open(s)}/>}</View>)}
      </View>; })}
      {selecting && <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{button(`已选 ${picked.size} 个`, () => setPicked(new Set(list.map(s => s.id))))}{button("取消选择", () => { setSelecting(false); setPicked(new Set()); })}{button("移入回收站", () => void deletePicked())}</View>}
    </>}
    {showTrash && <View style={{ gap: 10 }}>{!trash.length && <View style={{ ...box, padding: 30 }}><Text style={text}>回收站为空</Text></View>}{trash.map(t => <View key={t.key} style={box}><Text style={{ ...text, fontWeight: "600" }}>{t.title || t.id || t.key}</Text><Text style={note}>{t.agent} · {t.cwd || ""}</Text><View style={{ flexDirection: "row", gap: 8 }}>{button("恢复", () => void post("sessions/restore", { key: t.key }).then(() => reload()).catch(e => setError(String(e))))}{button("永久删除", () => void post("sessions/purge", { keys: [t.key] }).then(() => reload()).catch(e => setError(String(e))))}</View></View>)}</View>}
    <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}><View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center", padding: 20 }}><View style={{ ...box, maxWidth: 480, width: "100%", alignSelf: "center" }}><Text style={{ ...text, fontWeight: "600" }}>删除这个会话？</Text><Text style={note}>{deleteTarget?.title || deleteTarget?.id}</Text><Text style={note}>移入 Magpie 回收站，可恢复；正在写入的会话由后端保留。</Text>{button("取消", () => setDeleteTarget(null))}{button("确认删除", () => { const target = deleteTarget; setDeleteTarget(null); if (target) void deleteOne(target); })}</View></View></Modal>
    {!!error && <Text accessibilityRole="alert" style={{ color: "#d54949" }}>{error}</Text>}
    {!!notice && <Text style={note}>{notice}</Text>}
    <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={close}><View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", padding: 12, justifyContent: "center" }}><View style={{ ...box, width: "100%", maxWidth: 960, height: "94%", alignSelf: "center" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text numberOfLines={2} style={{ ...text, flex: 1, fontWeight: "600" }}>{selected?.title || selected?.id || "会话"}</Text>{button("关闭", close)}</View><Text style={note}>{shortPath(selected?.cwd, snapshot.home)} · {selected?.agent}</Text>{loading && <ActivityIndicator color={c.green} />}<ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>{transcript?.cut && <Text style={note}>官方接口已截断此会话。</Text>}{transcript?.parts.map((p, i) => <View key={i} style={{ padding: 14, borderRadius: 10, backgroundColor: p.role === "user" ? c.pill : c.card, borderWidth: 1, borderColor: c.line, gap: 8 }}><Text style={{ ...note, fontWeight: "600" }}>{p.role} · {p.name || p.kind}{p.model ? ` · ${p.model}` : ""}</Text><Text selectable style={{ ...text, lineHeight: 23 }}>{p.text || "空消息"}</Text></View>)}{!!selected?.resume && <View style={{ ...box, backgroundColor: c.pill }}><Text style={note}>继续命令（长按复制）</Text><Text selectable style={text}>{selected.resume}</Text></View>}</ScrollView></View></View></Modal>
  </View>;
}
