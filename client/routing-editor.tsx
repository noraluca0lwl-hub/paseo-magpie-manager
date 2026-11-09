import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { Palette } from "./routing-inspector";
export type EditableGroup = { id: string; name: string; members: string[]; routing?: string; off?: string[]; fast?: string[]; weights?: Record<string, number>; accounts?: string[]; match?: string[]; unlists?: boolean; affinity?: string; firstToken?: number; patience?: number; context?: number; classifier?: string; rules?: unknown[]; [key: string]: unknown };
type Model = { id: string; name?: string; providerName?: string; context?: number; efforts?: string[]; canFast?: boolean };
export type EditorCatalog = { models?: Model[]; groups?: (EditableGroup & { holds?: string[] })[]; accounts?: Record<string, { id: string; name: string; plan?: string }[]> };
const modes = [["", "智能"], ["order", "按顺序"], ["rotate", "轮转"], ["usage", "最低用量"], ["pace", "到期优先"], ["weight", "按权重"], ["free", "免费优先"], ["fast", "速度优先"], ["cheap", "最低成本"], ["drain", "用尽切换"], ["expiring", "免费配额到期"], ["manual", "手动"]];
export function RoutingEditor({ draft: g, change, catalog, colors: c, busy }: { draft: EditableGroup; change: (v: EditableGroup) => void; catalog: EditorCatalog; colors: Palette; busy: boolean }) {
 const [query, setQuery] = useState(""), [picker, setPicker] = useState(false), [pattern, setPattern] = useState(""), [advanced, setAdvanced] = useState(false), [rules, setRules] = useState(JSON.stringify(g.rules ?? [], null, 2)), [ruleError, setRuleError] = useState("");
 const text = { color: c.text, fontSize: 14 }, note = { color: c.muted, fontSize: 12, lineHeight: 19 }, input = { ...text, padding: 11, borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: c.pill };
 const patch = (v: Partial<EditableGroup>) => change({ ...g, ...v });
 const button = (label: string, run: () => void, active = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={run} style={{ padding: 9, borderWidth: 1, borderColor: active ? c.green : c.line, borderRadius: 7, backgroundColor: active ? c.pill : c.card }}><Text style={text}>{label}</Text></Pressable>;
 const title = (label: string, help?: string) => <View style={{ gap: 4, paddingTop: 10 }}><Text style={{ ...text, fontWeight: "600" }}>{label}</Text>{help && <Text style={note}>{help}</Text>}</View>;
 const toggle = (field: "off" | "fast" | "accounts", value: string) => patch({ [field]: g[field]?.includes(value) ? g[field]!.filter(v => v !== value) : [...(g[field] ?? []), value] });
 const remove = (id: string) => { const weights = { ...g.weights }; delete weights[id]; patch({ members: g.members.filter(v => v !== id), off: g.off?.filter(v => v !== id), fast: g.fast?.filter(v => v !== id), weights }); };
 const choices: Model[] = [...(catalog.models ?? []), ...(catalog.groups ?? []).filter(v => v.id !== g.id && !v.holds?.includes(g.id)).map(v => ({ id: v.ref as string || `group/${v.id}`, name: v.name, providerName: "路由组" }))];
 return <View style={{ gap: 10 }}>
 {title("基本信息", "保存后，Agent 可通过 group/ID 使用此路由组。")}
 <Text style={note}>名称</Text><TextInput accessibilityLabel="路由组名称" value={g.name} onChangeText={name => patch({ name })} style={input} />
 <Text style={note}>ID（小写字母、数字、点、短横线）</Text><TextInput accessibilityLabel="路由组 ID" value={g.id} autoCapitalize="none" onChangeText={id => patch({ id })} style={input} /><Text selectable style={note}>Agent 用途：group/{g.id || "[ID]"}</Text>
 {title("成员模型", "按顺序模式从上往下尝试；关闭成员会保留配置，但暂停向它分发请求。")}
 {!g.members.length && <Text style={note}>尚未添加成员，请从模型目录选择。</Text>}
 {g.members.map((id, index) => { const model = choices.find(v => v.id === id); return <View key={id} style={{ padding: 12, gap: 9, borderWidth: 1, borderColor: c.line, borderRadius: 10, opacity: g.off?.includes(id) ? .6 : 1 }}>
 <Text style={{ ...text, fontWeight: "600" }}>{index + 1}. {model?.name || id}</Text><Text selectable style={note}>{id} · {model?.providerName || id.split("/")[0]}{model?.context ? ` · ${(model.context / 1000).toFixed(0)}K 上下文` : ""}</Text>
 <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{button(g.off?.includes(id) ? "已停用" : "已启用", () => toggle("off", id), !g.off?.includes(id))}{index > 0 && button("上移", () => { const members = [...g.members]; [members[index - 1], members[index]] = [members[index], members[index - 1]]; patch({ members }); })}{index < g.members.length - 1 && button("下移", () => { const members = [...g.members]; [members[index + 1], members[index]] = [members[index], members[index + 1]]; patch({ members }); })}{button("移除", () => remove(id))}{model?.canFast && button(g.fast?.includes(id) ? "快速模式" : "标准速度", () => toggle("fast", id), g.fast?.includes(id))}</View>
 {g.routing === "weight" && <><Text style={note}>分配权重</Text><TextInput accessibilityLabel={`成员权重 ${id}`} keyboardType="numeric" value={String(g.weights?.[id] ?? 1)} onChangeText={value => { if (/^\d+$/.test(value) && Number(value) > 0) patch({ weights: { ...g.weights, [id]: Number(value) } }); }} style={input} /></>}
 {g.routing === "manual" && button(g.pick === id ? "● 当前指定成员" : "指定此成员", () => patch({ pick: id }), g.pick === id)}
 </View>; })}
 {button(picker ? "收起模型目录" : "＋ 添加模型或路由组", () => setPicker(!picker))}
 {picker && <View style={{ gap: 8, padding: 12, backgroundColor: c.pill, borderRadius: 10 }}><TextInput accessibilityLabel="搜索路由成员" placeholder="搜索模型或供应商" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={input} />{choices.filter(m => !g.members.includes(m.id) && `${m.id} ${m.name} ${m.providerName}`.toLowerCase().includes(query.toLowerCase())).map(m => <View key={m.id}>{button(`${m.name || m.id} · ${m.providerName || m.id.split("/")[0]}`, () => patch({ members: [...g.members, m.id] }))}</View>)}{!choices.length && <Text style={note}>目录暂无模型，请先在供应商中配置模型。</Text>}</View>}
 {title("路由策略")}
 <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{modes.map(([id, label]) => <View key={id}>{button(label, () => patch({ routing: id }), (g.routing ?? "") === id)}</View>)}</View>
 {title("账号限制", "未选择账号的供应商使用全部账号；选择后，该供应商只使用勾选账号。")}
 {Object.entries(catalog.accounts ?? {}).map(([provider, accounts]) => <View key={provider} style={{ gap: 7 }}><Text style={text}>{provider}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{button("任一账号", () => patch({ accounts: g.accounts?.filter(id => !accounts.some(a => a.id === id)) }), !g.accounts?.some(id => accounts.some(a => a.id === id)))}{accounts.map(a => <View key={a.id}>{button(`${g.accounts?.includes(a.id) ? "✓ " : ""}${a.name}${a.plan ? ` · ${a.plan}` : ""}`, () => toggle("accounts", a.id), g.accounts?.includes(a.id))}</View>)}</View></View>)}
 {!Object.keys(catalog.accounts ?? {}).length && <Text style={note}>当前供应商没有可单独限制的账号。</Text>}
 {title("模式匹配", "支持 provider/* 通配符和 re: 正则；匹配新出现的模型时自动纳入。")}
 {(g.match ?? []).map((v, i) => <View key={`${i}:${v}`} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}><Text selectable style={{ ...text, flex: 1 }}>{v}</Text>{button("移除模式", () => patch({ match: g.match?.filter((_, index) => index !== i) }))}</View>)}
 <TextInput accessibilityLabel="路由匹配模式" value={pattern} onChangeText={setPattern} placeholder="例如 openrouter/*:free 或 re:…" placeholderTextColor={c.muted} style={input} />{button("添加模式", () => { const v = pattern.trim(); if (!v) return; if (v.startsWith("re:")) { try { new RegExp(v.slice(3)); } catch { setRuleError("正则表达式格式错误"); return; } } patch({ match: [...new Set([...(g.match ?? []), v])] }); setPattern(""); setRuleError(""); })}
 {title("模型列表")}
 <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{button("也列出成员模型", () => patch({ unlists: false }), !g.unlists)}{button("只列出本组", () => patch({ unlists: true }), g.unlists)}</View>
 {title("故障切换", "0 跟随全局默认值；首 Token 为 -1 时持续等待，重试等待为 -1 时失败即返回。")}
 {([['firstToken', '首 Token 等待秒数'], ['patience', '失败后重试等待秒数'], ['context', '对外上下文 Token 数（0 自动）']] as const).map(([key, label]) => <View key={key} style={{ gap: 5 }}><Text style={note}>{label}</Text><TextInput accessibilityLabel={label} value={String(g[key] ?? 0)} keyboardType="numbers-and-punctuation" onChangeText={v => { if (/^-?\d*$/.test(v)) patch({ [key]: Number(v) }); }} style={input} /></View>)}
 {button(advanced ? "收起高级规则" : "高级规则与分类器", () => setAdvanced(!advanced))}
 {advanced && <><Text style={note}>分类器模型 ID</Text><TextInput accessibilityLabel="路由分类器" value={g.classifier ?? ""} onChangeText={classifier => patch({ classifier })} style={input} /><Text style={note}>规则 JSON（原有规则完整保留；点击应用后写入草稿）</Text><TextInput accessibilityLabel="路由规则 JSON" multiline value={rules} onChangeText={setRules} style={{ ...input, minHeight: 150 }} />{button("应用规则", () => { try { const parsed: unknown = JSON.parse(rules); if (!Array.isArray(parsed) || parsed.some(v => !v || typeof v !== "object" || Array.isArray(v))) throw new Error(); patch({ rules: parsed }); setRuleError(""); } catch { setRuleError("规则须为 JSON 对象数组"); } })}</>}
 {!!ruleError && <Text accessibilityRole="alert" style={{ color: "#d54949" }}>{ruleError}</Text>}
 </View>;
}
