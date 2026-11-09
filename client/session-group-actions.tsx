import { useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { copyText } from '@getpaseo/plugin/client/ui';

type Member = { id: string; agent: string; cwd?: string; wsl?: string; read_only?: boolean; gateway?: boolean; deletable?: boolean; undeletable?: string };
type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };
export function GroupCopy({ value, color, notify, fail }: { value: string; color: string; notify: (s: string) => void; fail: (s: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="复制分组副标题" onPress={e => { e.stopPropagation(); void copyText(value).then(() => notify('已复制')).catch(e => fail(String(e))); }} style={{ padding: 8 }}><Text style={{ color, fontSize: 18 }}>⧉</Text></Pressable>;
}
export function SessionGroupActions({ cwd, members, colors: c, post, reload, notify, fail }: { cwd: string; members: Member[]; colors: Colors; post: (path: string, body: unknown) => Promise<unknown>; reload: () => Promise<void>; notify: (s: string) => void; fail: (s: string) => void }) {
  const [menu, setMenu] = useState(false);
  const anchor = useRef<View>(null);
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const openMenu = () => anchor.current?.measureInWindow((x, y, w, h) => {
    setPosition({ left: Math.max(8, Math.min(x + w - 232, width - 240)), top: Math.max(8, y + h + 112 < height ? y + h : y - 112) });
    setMenu(true);
  });
  const [dialog, setDialog] = useState<'delete' | 'move' | null>(null);
  const [to, setTo] = useState(cwd);
  const [preview, setPreview] = useState<{ token?: string; sessions?: number; bytes?: number; from?: string; to?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const writable = members.filter(s => s.deletable === true || (s.deletable !== false && !s.read_only && !s.undeletable));
  const movable = !!cwd && members.length > 0 && members.every(s => s.agent === 'claude' && !s.read_only && !s.gateway) && new Set(members.map(s => s.wsl || '')).size === 1;
  const moveReason = members.some(s => s.gateway) ? '这是网关调用记录，没有可迁移的 Claude Code 项目文件。原生会话已自动读取，请在顶部切换 Claude Code，再选择带工作目录的原生项目。' : !cwd ? '此分组没有项目工作目录，迁移需要带工作目录的 Claude Code 原生项目。' : '此分组不是可迁移的 Claude Code 原生项目，或包含只读会话、不同 WSL 环境。';
  const text = { color: c.text, fontSize: 14 };
  const action = (label: string, fn: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={fn} style={{ padding: 12, opacity: disabled ? 0.45 : 1 }}><Text style={text}>{label}</Text></Pressable>;
  const ask = (kind: 'delete' | 'move') => { setMenu(false); setDialog(kind); setPreview(null); setTo(cwd); setMessage(''); };
  const execute = async () => {
    setBusy(true); setMessage('');
    try {
      if (dialog === 'delete') {
        const out = await post('sessions/delete', { agent: members[0]?.agent, ids: writable.map(s => s.id) }) as { deleted?: string[]; refused?: { error: string }[] };
        await reload();
        const missing = writable.filter(s => !out.deleted?.includes(s.id));
        if (out.refused?.length || missing.length) throw new Error(`已删除 ${out.deleted?.length ?? 0} 个；${out.refused?.map(r => r.error).join('；') || `${missing.length} 个未获后端确认`}`);
        notify(`已将 ${out.deleted?.length ?? 0} 个会话移入回收站`); setDialog(null);
      } else {
        const out = await post('sessions/relocate-claude', { from: cwd, to: to.trim(), wsl: members[0]?.wsl || '', token: preview?.token || '' }) as { token?: string; sessions?: number; bytes?: number; from?: string; to?: string; backup?: string };
        if (out.backup) { setPreview(null); setMessage(`迁移完成，原始文件与恢复清单：${out.backup}`); await reload(); notify(`项目会话已迁移；恢复清单：${out.backup}`); setDialog(null); }
        else { if (!out.token) throw new Error('后端未返回迁移确认令牌'); setPreview(out); setMessage(`将迁移 ${out.sessions ?? 0} 个会话（${out.bytes ?? 0} 字节）\n${out.from || cwd} → ${out.to || to}`); }
      }
    } catch (e) { setPreview(null); setMessage(String(e)); fail(String(e)); }
    finally { setBusy(false); }
  };
  return <View style={{ position: 'relative', zIndex: menu ? 100 : 1 }}>
    <Pressable ref={anchor} accessibilityRole="button" accessibilityLabel="项目会话更多操作" onPress={openMenu} style={{ padding: 12 }}><Text style={{ color: c.muted, fontSize: 22 }}>⋯</Text></Pressable>
    <Modal visible={menu} transparent animationType="none" onRequestClose={() => setMenu(false)}><View style={{ flex: 1 }}><Pressable accessibilityLabel="收起项目菜单" onPress={() => setMenu(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}/><View style={{ position: 'absolute', ...position, width: Math.min(232, width - 16), backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 4, elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 }}>
      {action('→  迁移项目会话', () => { ask('move'); if (!movable) setMessage(moveReason); })}
      <View style={{ height: 1, backgroundColor: c.line }}/>
      {action('删除全部会话', () => { ask('delete'); if (!writable.length) setMessage('后端未提供此分组的删除权限。'); })}
    </View></View></Modal>
    <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setDialog(null); }}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', padding: 20 }}><View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: c.card, borderRadius: 14, padding: 20, gap: 12 }}>
      <Text style={{ ...text, fontWeight: '600', fontSize: 17 }}>{dialog === 'delete' ? `删除此分组的 ${writable.length} 个会话？` : '迁移 Claude Code 项目会话'}</Text>
      <Text selectable style={{ color: c.muted }}>{cwd || '未命名会话'}</Text>
      <Text style={{ color: c.muted }}>{dialog === 'delete' ? `按完整分组操作，包含被搜索隐藏的会话；移入回收站后可恢复。${members.length - writable.length ? `保留 ${members.length - writable.length} 个只读会话。` : ''}` : '先关闭此项目的 Claude Code 和编辑器会话。迁移整个项目的会话，保留原始文件与恢复清单，不覆盖目标存储，不改历史消息文本。'}</Text>
      {dialog === 'move' && movable && <TextInput accessibilityLabel="新的项目绝对路径" editable={!busy} value={to} onChangeText={v => { setTo(v); setPreview(null); setMessage(''); }} style={{ ...text, backgroundColor: c.pill, borderRadius: 8, padding: 12 }}/>}
      {!!message && <Text selectable style={text}>{message}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>{action('取消', () => setDialog(null), busy)}{action(busy ? '处理中…' : dialog === 'delete' ? '确认删除全部' : preview ? '确认迁移' : '预览迁移', () => void execute(), busy || (dialog === 'delete' ? !writable.length : !movable || !to.trim() || to.trim() === cwd))}</View>
    </View></View></Modal>
  </View>;
}
