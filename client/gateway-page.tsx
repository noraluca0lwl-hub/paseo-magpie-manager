import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { copyText } from '@getpaseo/plugin/client/ui';
import { officialApi } from '../shared/contracts';
import { useRpc } from '@getpaseo/plugin/client';
import { connectionExample, gatewayModels, object, rows, safeDetail, value } from './gateway-data';

type Colors = { text: string; muted: string; card: string; line: string; pill: string; green: string };
export function GatewayPage({ data, colors: c }: { data: unknown; colors: Colors }) {
  const rpc = useRpc(officialApi);
  const [snapshot, setSnapshot] = useState(data);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); const [model, setModel] = useState(''); const [protocol, setProtocol] = useState('openai');
  const [connect, setConnect] = useState(false); const [shown, setShown] = useState(20);
  const [detail, setDetail] = useState<{ id: string; text: string } | null>(null);
  const [keys, setKeys] = useState<ReturnType<typeof rows>>([]); const [keysError, setKeysError] = useState('');
  const [name, setName] = useState(''); const [secret, setSecret] = useState(''); const [displaySecret, setDisplaySecret] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; path: string; body: unknown } | null>(null);
  const generation = useRef(0); const alive = useRef(true);
  useEffect(() => { setSnapshot(data); }, [data]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  const request = async (path: string, body?: unknown) => {
    const r = await rpc({ path, method: body === undefined ? 'GET' : 'POST', body });
    if (!r.ok) throw new Error(r.error || '网关请求失败');
    return r.data;
  };
  const loadKeys = async () => { try { const d = object(await request('caller-keys')); if(alive.current) { setKeys(rows(d.keys)); setKeysError(''); } } catch(e) { if(alive.current)setKeysError(String(e)); } };
  const d = object(snapshot), g = object(d.gateway), models = gatewayModels(snapshot);
  useEffect(() => { if (g.lan) void loadKeys(); }, [g.lan]);
  const run = async (path: string, body: unknown) => {
    if(busy)return; setBusy(true); setError(''); setNotice('');
    try {
      const out = object(await request(path, body));
      if(out.ok === false || out.error) throw new Error(value(out.error || out.reason) || '操作未完成');
      if(alive.current) {
        if(Array.isArray(out.keys))setKeys(rows(out.keys));
        if(path === 'caller-keys/add-key') { setName(''); setSecret(''); }
        if(typeof out.secret === 'string' && out.secret)setDisplaySecret(out.secret);
      }
      const fresh = await request('providers'); if(alive.current) {setSnapshot(fresh);setNotice('操作已保存，网关状态已重新读取');}
    } catch(e) { if(alive.current)setError(String(e)); } finally { if(alive.current)setBusy(false); }
  };
  const label = { color:c.text, fontSize:14 }; const note = { color:c.muted, fontSize:13, lineHeight:20 };
  const card = { padding:16, gap:12, borderRadius:12, borderWidth:1, borderColor:c.line, backgroundColor:c.card };
  const input = { color:c.text, padding:11, borderRadius:7, backgroundColor:c.pill, minHeight:42 };
  const bar = { flexDirection:'row' as const, flexWrap:'wrap' as const, gap:8, alignItems:'center' as const };
  const button = (title: string, fn: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={fn} style={{padding:10, borderRadius:7, backgroundColor:c.pill, opacity:(busy || disabled) ? .5 : 1}}><Text style={label}>{title}</Text></Pressable>;
  const copy = async (text: string) => { try { await copyText(text); setNotice('已复制到当前设备'); } catch { setError('剪贴板写入失败，可长按选择下方文本复制'); } };
  const selected = models.find(m=>m.id===model) || models.find(m=>m.decision===(protocol==='systemone'));
  const example = connectionExample(value(g.url), protocol, selected?.id || '', 'magpie');
  const filtered = models.filter(m=>`${m.id} ${m.providerName}`.toLowerCase().includes(query.toLowerCase()));
  const calls = rows(g.calls);
  return <View style={{gap:18}}>
    {!!error && <Text accessibilityRole="alert" selectable style={{color:'#d54949'}}>{error}</Text>}
    {!!notice && <Text style={note}>{notice}</Text>}
    <View style={card}><Text style={{...label,fontWeight:'600'}}>网关 · {g.running?'运行中':'未运行'}</Text>
      <Text style={{...note,color:g.running?c.green:c.muted}}>{g.running ? g.mine?'由当前 Magpie 提供服务':`由另一 Magpie 提供服务 ${value(g.version)}`:'尚未提供服务'}</Text>
      <Text style={note}>{value(g.models)} 个模型 · {calls.length} 条最近请求 · 五种 API</Text>
      <Text selectable style={label}>{value(g.url) || '后端未返回网关地址'}</Text>
      <View style={bar}>{button('复制地址',()=>void copy(value(g.url)),!g.url)}{button('刷新状态',()=>void (async()=>{try {setSnapshot(await request('providers')); if(g.lan)await loadKeys();}catch(e){setError(String(e));}})())}</View>
      {!!g.older && <Text style={{color:'#d54949'}}>网关由旧版本提供服务，当前配置与运行版本存在差异。</Text>}
    </View>
    <View style={card}><Text style={label}>网络共享</Text><Text style={note}>{g.lan?'局域网共享已开启；其他设备接入需要网关密钥。':'仅本机接入；手机中的 127.0.0.1 指手机自身，并非这台服务器。'}</Text>
      {rows(g.urls).map((u,i)=><Text key={i} selectable style={note}>{value(u.url)}</Text>)}
      {button(g.lan?'关闭局域网共享':'开启局域网共享',()=>setConfirm({title:g.lan?'关闭共享会断开外部客户端接入。确认关闭？':'开启后网关将监听局域网；外部客户端需使用网关密钥。确认开启？',path:'settings/lan',body:{on:!g.lan}}))}
    </View>
    <View style={card}><View style={bar}><Text style={{...label,flex:1}}>网关密钥</Text>{!!g.lan&&button('刷新密钥',()=>void loadKeys())}</View>
      {!g.lan?<Text style={note}>开启局域网共享后管理外部接入密钥，本机 Agent 无需创建。</Text>:<>
        {!!keysError&&<Text style={{color:'#d54949'}}>{keysError}</Text>}
        {!keys.length&&!keysError&&<Text style={note}>尚无网关密钥</Text>}
        {keys.map(k=><View key={value(k.id)} style={{gap:8,borderTopWidth:1,borderColor:c.line,paddingTop:10}}><Text style={label}>{value(k.name || k.id)} · {k.off?'已停用':'已启用'}</Text><View style={bar}>
          {button(k.off?'启用':'停用',()=>void run(`caller-keys/${k.off?'on':'off'}-key`,{key:k.id}))}
          {button('查看密钥',()=>void run('caller-keys/copy-key',{key:k.id}))}
          {button('轮换',()=>setConfirm({title:'轮换后旧密钥失效，客户端需要更新。确认轮换？',path:'caller-keys/rotate-key',body:{key:k.id}}))}
          {button('删除',()=>setConfirm({title:'删除后使用此密钥的客户端将失去接入。确认删除？',path:'caller-keys/remove-key',body:{key:k.id}}))}
        </View></View>)}
        <TextInput accessibilityLabel="网关密钥名称" value={name} onChangeText={setName} placeholder="密钥名称，例如 Laptop" placeholderTextColor={c.muted} style={input}/>
        <TextInput accessibilityLabel="自定义网关密钥" secureTextEntry value={secret} onChangeText={setSecret} placeholder="自定义密钥，留空自动生成" placeholderTextColor={c.muted} style={input}/>
        {button('创建密钥',()=>void run('caller-keys/add-key',secret.trim()?{name:name.trim(),secret:secret.trim()}:{name:name.trim()}),!name.trim())}
      </>}
      {!!displaySecret&&<View style={{gap:8}}><Text style={note}>密钥仅在当前页面显示，关闭后清除。</Text><Text selectable style={label}>{displaySecret}</Text><View style={bar}>{button('复制密钥',()=>void copy(displaySecret))}{button('隐藏密钥',()=>setDisplaySecret(''))}</View></View>}
    </View>
    <View style={card}>{button(connect?'收起接入示例':'展开接入示例',()=>setConnect(!connect))}{connect&&<>
      <View style={bar}>{[['openai','OpenAI'],['responses','Responses'],['anthropic','Anthropic'],['gemini','Gemini'],['systemone','System One']].map(([id,title])=><View key={id}>{button(`${protocol===id?'● ':''}${title}`,()=>{setProtocol(id);setModel('');})}</View>)}</View>
      <Text style={note}>Base URL</Text><Text selectable style={label}>{example.base}</Text>
      <Text style={note}>模型：{selected?.id || '尚无可用模型'}。示例使用本机地址与占位密钥 magpie；远程接入请替换为服务器可达地址和实际网关密钥。</Text>
      <Text selectable style={{...note,fontFamily:'monospace'}}>{example.curl}</Text>{button('复制 curl 示例',()=>void copy(example.curl),!selected)}
    </>}</View>
    <View style={card}><Text style={label}>暴露的模型 · {models.length}</Text><TextInput accessibilityLabel="搜索网关模型" value={query} onChangeText={setQuery} placeholder="搜索模型或供应商" placeholderTextColor={c.muted} style={input}/>
      {button('复制筛选模型 ID',()=>void copy(filtered.map(m=>m.id).join('\n')),!filtered.length)}
      {!filtered.length&&<Text style={note}>{models.length?'没有匹配的模型':'尚未暴露模型；添加并启用供应商模型后显示。'}</Text>}
      {filtered.map(m=><Pressable key={m.id} onPress={()=>{setModel(m.id);setProtocol(m.decision?'systemone':protocol==='systemone'?'openai':protocol);setConnect(true);}} style={{paddingVertical:10,gap:4,borderTopWidth:1,borderColor:c.line}}><Text selectable style={label}>{m.id}</Text><Text style={note}>{m.providerName}{selected?.id===m.id?' · 示例当前模型':''}</Text></Pressable>)}
    </View>
    <View style={card}><Text style={label}>最近请求 · {calls.length}</Text>{!calls.length&&<Text style={note}>尚无请求。通过此网关调用后显示；空记录不代表网关停机。</Text>}
      {calls.slice(0,shown).map((call,i)=><View key={value(call.id)||String(i)} style={{gap:8,borderTopWidth:1,borderColor:c.line,paddingTop:10}}><Text style={note}>{value(call.time)} · {value(call.agent)}</Text><Text selectable style={label}>{value(call.model)}</Text><Text style={{...note,color:Number(call.status)>=400?'#d54949':c.green}}>{value(call.status)} · {value(call.ms)} ms · {value(call.from)} → {value(call.to)}{call.ttft?` · TTFT ${value(call.ttft)} ms`:''}</Text>{!!call.error&&<Text selectable style={{color:'#d54949'}}>{value(call.error)}</Text>}
        {button(detail?.id===value(call.id)?'收起详情':'查看请求详情',()=>{const id=value(call.id);if(detail?.id===id){generation.current++;setDetail(null);return;}const ticket=++generation.current;setDetail({id,text:'正在读取…'});void request(`gateway/call?id=${encodeURIComponent(id)}`).then(out=>{if(alive.current&&ticket===generation.current)setDetail({id,text:safeDetail(out)});}).catch(e=>{if(alive.current&&ticket===generation.current)setDetail({id,text:String(e)});});},!call.id)}
        {detail?.id===value(call.id)&&<Text selectable style={{...note,fontFamily:'monospace'}}>{detail.text}</Text>}
      </View>)}{shown<calls.length&&button('加载更多请求',()=>setShown(shown+20))}
    </View>
    {!!confirm&&<View accessibilityRole="alert" style={card}><Text style={label}>{confirm.title}</Text><View style={bar}>{button('取消',()=>setConfirm(null))}{button('确认执行',()=>{const action=confirm;setConfirm(null);void run(action.path,action.body);})}</View></View>}
  </View>;
}
