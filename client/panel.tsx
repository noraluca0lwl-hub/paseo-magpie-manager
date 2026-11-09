/**
 * client/panel.tsx — Magpie Manager panel, mirroring magpie's window layout:
 * a left sidebar (grouped: Work / Models / Insights / Extend, official icons,
 * 26px rows, 12.5px labels, selected row in the text's own ink) and the open
 * view's content on the right. Design tokens are magpie's own (app.css).
 */
import { type PluginAgentPanelProps, type PluginScreenProps, useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  Image as RNImage,
} from "react-native";

import {
  listProviders, addProvider, removeProvider, testProvider, setProviderKey, presets, webUiUrl,
  quotaJson, listAgents, setAgentModel, listGroups, addGroup, removeGroup, listModels,
} from "../shared/contracts";
import { I_agents, I_sessions, I_providers, I_routing, I_groups, I_gateway, I_usage, I_masking, I_plugins } from "./nav-icons";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

function isDark(hex: string): boolean {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/** magpie app.css tokens, light and dark. */
function tokens(theme: PluginAgentPanelProps["theme"]) {
  const dark = isDark(theme.colors.surface0);
  return {
    bg: dark ? "#1a1a1e" : "#f4f4f6",
    card: dark ? "#232327" : "#ffffff",
    card2: dark ? "#1f1f23" : "#f9f9fb",
    pill: dark ? "#2d2d33" : "#f1f1f4",
    pillHover: dark ? "#36363d" : "#e9e9ee",
    line: dark ? "#333339" : "#e3e3e8",
    line2: dark ? "#2c2c32" : "#ececf0",
    fg: dark ? "#ededf1" : "#1c1c21",
    fg2: dark ? "#b9b9c1" : "#4b4b53",
    muted: dark ? "#8b8b94" : "#85858d",
    faint: dark ? "#56565f" : "#b9b9c2",
    ctlFg: dark ? "#a1a1aa" : "#63636b",
    accent: dark ? "#a5b4fc" : "#4f46e5",
    accentFg: dark ? "#14142a" : "#ffffff",
    green: dark ? "#6fd99b" : "#189a58",
    red: dark ? "#f28b82" : "#d64545",
    redSoft: dark ? "#45272a" : "#fbe9e9",
    // the sidebar's selected row: no colour of its own, the page open in the
    // text's own ink (magpie: "graphite, as a Mac sidebar is")
    sideBg: dark ? "#1b1c20" : "#f2f2f5",
    sideSel: dark ? "#25262c" : "#ffffff",
  };
}

type Prov = { id: string; name: string; host: string | null; models: number | null; usedBy: string[] };
type Preset = { label: string; id: string; group: string };
type Agent = { name: string; detail: string; detected: boolean };
type Group = { id: string; raw: string };
type PageView = "agents" | "sessions" | "providers" | "routing" | "groups" | "gateway" | "usage" | "masking" | "plugins";

type PluginScreenPropsLike = Pick<PluginAgentPanelProps, "theme"> & Partial<PluginScreenProps>;

export function MagpieManagerPanel(props: PluginAgentPanelProps | PluginScreenPropsLike) {
  const t = tokens(props.theme);
  const toast = useToast();
  const list = useRpc(listProviders);
  const add = useRpc(addProvider);
  const remove = useRpc(removeProvider);
  const test = useRpc(testProvider);
  const setKey = useRpc(setProviderKey);
  const listPresets = useRpc(presets);
  const webUi = useRpc(webUiUrl);
  const quota = useRpc(quotaJson);
  const agents = useRpc(listAgents);
  const setAgent = useRpc(setAgentModel);
  const groups = useRpc(listGroups);
  const mkGroup = useRpc(addGroup);
  const rmGroup = useRpc(removeGroup);
  const models = useRpc(listModels);

  const [view, setView] = useState<PageView>("providers");
  const [data, setData] = useState<{ providers: Prov[] } | null>(null);
  const [presetList, setPresetList] = useState<Preset[]>([]);
  const [quotaRaw, setQuotaRaw] = useState<string | null>(null);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [groupList, setGroupList] = useState<Group[]>([]);
  const [modelList, setModelList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", models: "", routing: "smart" });
  const [showGroupAdd, setShowGroupAdd] = useState(false);
  const [form, setForm] = useState({ name: "", key: "", baseUrl: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [l, q, a, g, m] = await Promise.all([
        list({}),
        quota({}).catch(() => null),
        agents({}).catch(() => null),
        groups({}).catch(() => null),
        models({}).catch(() => null),
      ]);
      setData(l);
      setQuotaRaw(q?.ok ? q.body : null);
      if (a?.ok) setAgentList(a.agents);
      if (g?.ok) setGroupList(g.groups);
      if (m?.ok) setModelList(m.models);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [list, quota, agents, groups, models]);

  useEffect(() => {
    void refresh();
    void listPresets({}).then((r) => setPresetList(r.presets)).catch(() => {});
    void webUi({}).then(() => {}).catch(() => {});
  }, [refresh, listPresets, webUi]);

  const run = useCallback(
    async (label: string, fn: () => Promise<{ ok: boolean; error?: string | null }>) => {
      setBusy(label);
      setErr(null);
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.error ?? "failed"); toast.error(`${label} failed`); }
        else toast.show(`${label} ok`);
        await refresh();
      } catch (e) {
        setErr(String(e));
        toast.error(String(e));
      } finally {
        setBusy(null);
      }
    },
    [refresh, toast],
  );

  const submitAdd = async () => {
    await run("add", () =>
      add({ name: form.name.trim(), key: form.key.trim(), baseUrl: form.baseUrl.trim() || undefined }),
    );
    setForm({ name: "", key: "", baseUrl: "" });
    setShowAdd(false);
  };

  // ---- magpie's sidebar: groups + views, official icons -------------------
  const NAV: Array<{ group: string; items: Array<{ view: PageView; label: string; icon: { svg: string } }> }> = [
    { group: "Work", items: [
      { view: "agents", label: "Agents", icon: I_agents },
      { view: "sessions", label: "Sessions", icon: I_sessions },
    ]},
    { group: "Models", items: [
      { view: "providers", label: "Providers", icon: I_providers },
      { view: "routing", label: "Routing", icon: I_routing },
      { view: "groups", label: "Routing groups", icon: I_groups },
      { view: "gateway", label: "Gateway", icon: I_gateway },
    ]},
    { group: "Insights", items: [
      { view: "usage", label: "Usage", icon: I_usage },
      { view: "masking", label: "Masking", icon: I_masking },
    ]},
    { group: "Extend", items: [
      { view: "plugins", label: "Plugins", icon: I_plugins },
    ]},
  ];

  // ---- styles (magpie app.css values) -------------------------------------
  const s = {
    screen: { flex: 1, backgroundColor: t.bg, flexDirection: "row" as const },
    sidebar: { width: 176, backgroundColor: t.sideBg, borderRightWidth: 1, borderRightColor: t.line2, paddingTop: 10 },
    brand: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, paddingHorizontal: 14, paddingBottom: 10 },
    brandText: { color: t.fg, fontSize: 13.5, fontWeight: "600" as const },
    navGl: { color: t.faint, fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.4, textTransform: "uppercase" as const, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
    navBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, height: 26, paddingHorizontal: 10, marginHorizontal: 6, borderRadius: 6 },
    navBtnOn: { backgroundColor: t.sideSel },
    navLabel: { fontSize: 12.5, color: t.ctlFg },
    navLabelOn: { fontSize: 12.5, color: t.fg, fontWeight: "500" as const },
    content: { flex: 1, backgroundColor: t.bg },
    contentScroll: { flex: 1 },
    head: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 4 },
    headRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
    title: { color: t.fg, fontSize: 15, fontWeight: "600" as const, letterSpacing: -0.2, flex: 1 },
    sub: { color: t.muted, fontSize: 11.5 },
    list: { backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 12, marginHorizontal: 12, overflow: "hidden" as const },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, minHeight: 40, paddingHorizontal: 11, paddingVertical: 5 },
    rowBorder: { borderTopWidth: 1, borderTopColor: t.line2 },
    name: { color: t.fg, fontWeight: "500" as const, fontSize: 13 },
    host: { color: t.muted, fontSize: 11.5, fontFamily: MONO, marginTop: 1 },
    meta: { color: t.faint, fontSize: 11, marginTop: 1 },
    textBtn: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: t.pill },
    textBtnLabel: { color: t.fg2, fontSize: 12 },
    primary: { backgroundColor: t.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, marginTop: 8 },
    primaryLabel: { color: t.accentFg, fontSize: 12.5, fontWeight: "600" as const },
    quiet: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: t.pill },
    quietLabel: { color: t.fg2, fontSize: 12.5, fontWeight: "500" as const },
    input: { color: t.fg, backgroundColor: t.pill, borderRadius: 6, paddingHorizontal: 8, height: 28, fontSize: 12.5, marginBottom: 6 },
    form: { marginHorizontal: 12, marginTop: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12 },
    formTitle: { color: t.fg, fontSize: 13, fontWeight: "600" as const, marginBottom: 6 },
    empty: { padding: 36, alignItems: "center" as const },
    emptyB: { color: t.fg, fontSize: 13, fontWeight: "500" as const, marginBottom: 4 },
    emptySub: { color: t.muted, fontSize: 12, textAlign: "center" as const },
    errBox: { marginHorizontal: 12, marginTop: 8, backgroundColor: t.redSoft, borderRadius: 8, padding: 8 },
    errText: { color: t.red, fontSize: 11.5 },
    modalCard: { margin: 16, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, padding: 12 },
    presetRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: t.line2 },
    presetLabel: { color: t.fg, fontSize: 12.5, flex: 1 },
    presetId: { color: t.muted, fontSize: 11, fontFamily: MONO },
    mono: { color: t.fg2, fontFamily: MONO, fontSize: 11.5, lineHeight: 18 },
  };

  const providers = data?.providers ?? [];
  const grouped = presetList.reduce<Record<string, Preset[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  return (
    <View style={s.screen}>
      {/* ---- sidebar (magpie's window layout) ---- */}
      <View style={s.sidebar}>
        <View style={s.brand}>
          <Text style={s.brandText}>magpie</Text>
        </View>
        {NAV.map((g) => (
          <View key={g.group}>
            <Text style={s.navGl}>{g.group}</Text>
            {g.items.map((it) => (
              <Pressable
                key={it.view}
                style={[s.navBtn, view === it.view && s.navBtnOn]}
                onPress={() => setView(it.view)}
              >
                <View style={{ width: 16, height: 16 }}>
                  <SvgIcon icon={it.icon} size={16} color={view === it.view ? t.fg : t.muted} />
                </View>
                <Text style={view === it.view ? s.navLabelOn : s.navLabel}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* ---- content ---- */}
      <ScrollView
        style={s.content}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.muted} />}
      >
        <View style={s.head}>
          <View style={s.headRow}>
            <Text style={s.title}>{NAV.flatMap((g) => g.items).find((i) => i.view === view)?.label}</Text>
            {view === "providers" && (
              <Pressable style={s.quiet} onPress={() => setShowAdd(true)}>
                <Text style={s.quietLabel}>+ Add</Text>
              </Pressable>
            )}
            {view === "groups" && (
              <Pressable style={s.quiet} onPress={() => setShowGroupAdd(true)}>
                <Text style={s.quietLabel}>+ Add</Text>
              </Pressable>
            )}
          </View>
        </View>

        {view === "providers" && (
          <View style={s.list}>
            {!loading && providers.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyB}>No providers yet</Text>
                <Text style={s.emptySub}>Tap “+ Add” — a preset vendor + key, or a custom relay with a base URL.</Text>
              </View>
            ) : (
              providers.map((p, i) => (
                <View key={p.id} style={[s.row, i > 0 && s.rowBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                    {p.host ? <Text style={s.host} numberOfLines={1}>{p.host}</Text> : null}
                    <Text style={s.meta} numberOfLines={1}>
                      {p.models != null ? `${p.models} models` : ""}
                      {p.models != null && p.usedBy.length > 0 ? " · " : ""}
                      {p.usedBy.length > 0 ? `used by ${p.usedBy.join(", ")}` : ""}
                    </Text>
                  </View>
                  {busy === `test:${p.id}` ? (
                    <ActivityIndicator size="small" color={t.muted} />
                  ) : (
                    <Pressable style={s.textBtn} onPress={() => run(`test:${p.id}`, () => test({ id: p.id }))}>
                      <Text style={s.textBtnLabel}>Test</Text>
                    </Pressable>
                  )}
                  <Pressable style={s.textBtn} onPress={() => { setEditId(p.id); setEditKey(""); }}>
                    <Text style={s.textBtnLabel}>Key</Text>
                  </Pressable>
                  {busy === `rm:${p.id}` ? null : (
                    <Pressable style={s.textBtn} onPress={() => run(`rm:${p.id}`, () => remove({ id: p.id }))}>
                      <Text style={{ ...s.textBtnLabel, color: t.red }}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
            {loading && data == null ? (
              <View style={[s.row, { justifyContent: "center" }]}>
                <ActivityIndicator color={t.muted} />
              </View>
            ) : null}
          </View>
        )}

        {view === "agents" && (
          <View style={s.list}>
            {agentList.map((a, i) => (
              <View key={a.name} style={[s.row, i > 0 && s.rowBorder, !a.detected && { opacity: 0.45 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.name, !a.detected && { color: t.muted }]} numberOfLines={1}>{a.name}</Text>
                  <Text style={s.meta} numberOfLines={1}>{a.detail || (a.detected ? "detected" : "not detected")}</Text>
                </View>
              </View>
            ))}
            {agentList.length === 0 && !loading ? (
              <View style={s.empty}>
                <Text style={s.emptyB}>No agents detected</Text>
                <Text style={s.emptySub}>magpie reads installed agent CLIs on this host.</Text>
              </View>
            ) : null}
          </View>
        )}

        {view === "groups" && (
          <View style={s.list}>
            {groupList.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyB}>No routing groups yet</Text>
                <Text style={s.emptySub}>A group fails over between models: agents pick it as group/&lt;id&gt;.</Text>
              </View>
            ) : (
              groupList.map((g, i) => (
                <View key={g.id} style={[s.row, i > 0 && s.rowBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{g.id}</Text>
                    <Text style={s.meta} numberOfLines={2}>{g.raw}</Text>
                  </View>
                  {busy === `grm:${g.id}` ? null : (
                    <Pressable style={s.textBtn} onPress={() => run(`grm:${g.id}`, () => rmGroup({ id: g.id }))}>
                      <Text style={{ ...s.textBtnLabel, color: t.red }}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {(view === "routing" || view === "gateway" || view === "sessions" || view === "masking" || view === "plugins") && (
          <View style={[s.list, { padding: 12 }]}>
            <Text style={s.emptySub}>
              {view === "plugins" ? "magpie plugins live in the magpie app itself — this panel manages providers, agents, groups and usage." : "This page lives in magpie's own window. This panel manages providers, agents, groups and usage."}
            </Text>
          </View>
        )}

        {view === "usage" && (
          <View style={[s.list, { padding: 12 }]}>
            {quotaRaw == null ? (
              <View style={[s.row, { justifyContent: "center" }]}>
                <Text style={s.emptySub}>nothing to tell · a signed-in plan or a key whose vendor shows its balance appears here</Text>
              </View>
            ) : (
              <Text style={s.mono} selectable>{quotaRaw}</Text>
            )}
          </View>
        )}

        {/* ---- edit-key modal ---- */}
        <Modal visible={editId != null} transparent animationType="fade" onRequestClose={() => setEditId(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center" }}>
            <View style={s.modalCard}>
              <Text style={s.formTitle}>Set key · {editId}</Text>
              <TextInput style={s.input} placeholder="new API key" placeholderTextColor={t.faint}
                value={editKey} onChangeText={setEditKey} autoCapitalize="none" secureTextEntry />
              <Pressable style={s.primary} disabled={!editKey.trim() || busy === "setkey"}
                onPress={async () => {
                  const id = editId!;
                  setEditId(null);
                  await run(`setkey:${id}`, () => setKey({ id, key: editKey.trim() }));
                }}>
                <Text style={s.primaryLabel}>{busy === "setkey" ? "Saving…" : "Save key"}</Text>
              </Pressable>
              <Pressable style={{ marginTop: 6 }} onPress={() => setEditId(null)}>
                <Text style={{ color: t.muted, fontSize: 12.5, textAlign: "center" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ---- add provider modal ---- */}
        <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
          <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 22 }}>
            <View style={[s.head, { flexDirection: "row", alignItems: "center" }]}>
              <Text style={s.title}>Add provider</Text>
              <Pressable style={s.quiet} onPress={() => setShowAdd(false)}>
                <Text style={s.quietLabel}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              <View style={s.form}>
                <Text style={s.formTitle}>Custom relay</Text>
                <TextInput style={s.input} placeholder="name (e.g. my-relay)" placeholderTextColor={t.faint}
                  value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                <TextInput style={s.input} placeholder="API key (sk-…)" placeholderTextColor={t.faint}
                  value={form.key} onChangeText={(v) => setForm({ ...form, key: v })} autoCapitalize="none" />
                <TextInput style={s.input} placeholder="base URL (https://…, presets leave blank)" placeholderTextColor={t.faint}
                  value={form.baseUrl} onChangeText={(v) => setForm({ ...form, baseUrl: v })} autoCapitalize="none" />
                <Pressable style={s.primary} onPress={submitAdd} disabled={!form.name.trim() || !form.key.trim() || busy === "add"}>
                  <Text style={s.primaryLabel}>{busy === "add" ? "Adding…" : "Add provider"}</Text>
                </Pressable>
              </View>
              <Text style={[s.formTitle, { marginHorizontal: 14, marginTop: 14 }]}>Presets</Text>
              <View style={[s.list, { marginTop: 6 }]}>
                {Object.entries(grouped).map(([group, items]) => (
                  <View key={group}>
                    <Text style={{ ...s.sub, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 2 }}>{group}</Text>
                    {items.map((p) => (
                      <Pressable key={p.id} style={s.presetRow}
                        onPress={() => setForm({ name: p.id, key: "", baseUrl: "" })}>
                        <Text style={s.presetLabel}>{p.label}</Text>
                        <Text style={s.presetId}>{p.id}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                {presetList.length === 0 ? (
                  <View style={[s.empty, { padding: 20 }]}>
                    <Text style={s.emptySub}>presets unavailable (magpie CLI not found)</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.emptySub, { marginTop: 8, marginHorizontal: 14 }]}>
                Tap a preset to fill the name; then paste its key above and Add.
              </Text>
            </ScrollView>
          </View>
        </Modal>

        {/* ---- add group modal ---- */}
        <Modal visible={showGroupAdd} transparent animationType="fade" onRequestClose={() => setShowGroupAdd(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center" }}>
            <View style={s.modalCard}>
              <Text style={s.formTitle}>Add routing group</Text>
              <TextInput style={s.input} placeholder="name (e.g. opus-anywhere)" placeholderTextColor={t.faint}
                value={groupForm.name} onChangeText={(v) => setGroupForm({ ...groupForm, name: v })} />
              <TextInput style={s.input} placeholder="models (provider/model, comma-separated)" placeholderTextColor={t.faint}
                value={groupForm.models} onChangeText={(v) => setGroupForm({ ...groupForm, models: v })} autoCapitalize="none" />
              <TextInput style={s.input} placeholder="routing (smart|order|rotate|usage|pace|weight|free|fast|drain)" placeholderTextColor={t.faint}
                value={groupForm.routing} onChangeText={(v) => setGroupForm({ ...groupForm, routing: v })} autoCapitalize="none" />
              <Pressable style={s.primary}
                disabled={!groupForm.name.trim() || !groupForm.models.trim() || busy === "gadd"}
                onPress={async () => {
                  setShowGroupAdd(false);
                  await run("gadd", () =>
                    mkGroup({ name: groupForm.name.trim(), models: groupForm.models.trim(), routing: groupForm.routing.trim() || undefined }),
                  );
                  setGroupForm({ name: "", models: "", routing: "smart" });
                }}>
                <Text style={s.primaryLabel}>Add group</Text>
              </Pressable>
              <Pressable style={{ marginTop: 6 }} onPress={() => setShowGroupAdd(false)}>
                <Text style={{ color: t.muted, fontSize: 12.5, textAlign: "center" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {err ? (
          <View style={s.errBox}>
            <Text style={s.errText} selectable>{err}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Renders one of magpie's official nav icons ({svg} form) at a size. */
function SvgIcon({ icon, size, color }: { icon: { svg: string }; size: number; color: string }) {
  // The icons use stroke="currentColor" — swap to the given color.
  const svg = icon.svg.replace(/currentColor/g, color);
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return (
    <View style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
      <RNImage source={{ uri: dataUri }} style={{ width: size, height: size }} />
    </View>
  );
}
