import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { copyText, Icon } from '@getpaseo/plugin/client/ui';
import { SessionConversation } from './session-conversation';
const copyIcon={svg:'<svg viewBox="0 0 16 16"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="3" width="8" height="8" rx="1"/><path d="M10 12v2H2V6h2"/></g></svg>'};
import { ProviderIcon } from './provider-icon';
export type Carry = { agent: string; command?: string; convert?: boolean };
type Model = { model?: string; input?: number; output?: number; cache_read?: number; cache_write?: number; cost?: number; priced?: boolean };
export type DetailSession = { agent: string; id: string; start?: string; last?: string; cwd?: string; resume?: string; path?: string; files?: number; transcript?: boolean; models?: Model[] | null; carry?: Carry[] | null };
type Colors = { text: string; muted: string; pill: string; card: string; line: string; green: string };
type Props = { session: DetailSession; colors: Colors; post: (path: string, body: unknown) => Promise<unknown>; notify: (s: string) => void; fail: (s: string) => void };
export function CarryMenu({session:s,colors:c,post,notify,fail}:Props) {
 const [shown,setShown]=useState(false);const [busy,setBusy]=useState(false);
 const run=async (target:Carry)=>{setBusy(true);try{let command=target.command;if(target.convert){const out=await post('sessions/carry',{agent:s.agent,id:s.id,to:target.agent,open:false}) as {command?:string};command=out.command;}if(!command)throw new Error('后端未返回继续命令');await copyText(command);notify('继续命令已复制到当前设备');setShown(false);}catch(e){fail(String(e));}finally{setBusy(false);}};
 return <View style={{gap:6,zIndex:100}}> <Pressable accessibilityRole="button" accessibilityLabel="换 Agent 继续" onPress={()=>setShown(!shown)} style={{borderWidth:1,borderColor:c.line,borderRadius:8,padding:8}}><Text style={{color:c.text}}>换 Agent 继续 {shown?'⌃':'⌄'}</Text></Pressable>{shown&&<View style={{position:'absolute',top:42,right:0,zIndex:100,elevation:10,padding:8,borderWidth:1,borderColor:c.line,borderRadius:12,backgroundColor:c.card,width:260,gap:6}}><Text style={{color:c.muted}}>换 Agent 继续</Text>{s.carry?.map(t=><Pressable key={t.agent} accessibilityRole="button" accessibilityLabel={`继续到 ${t.agent}`} disabled={busy} onPress={()=>void run(t)} style={{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:8,backgroundColor:c.pill}}><ProviderIcon icon={t.agent==='claude'?'claudecode-color':t.agent==='codex'?'codex-color':t.agent} name={t.agent} color={c.text} size={20}/><View><Text style={{color:c.text,fontWeight:'600'}}>{({codex:'Codex',claude:'Claude Code',omp:'oh-my-pi'} as Record<string,string>)[t.agent]||t.agent}</Text><Text style={{color:c.muted}}>{busy?'处理中':t.convert?'转换后复制命令':'复制命令'}</Text></View></Pressable>)}</View>}</View>;
}
export function SessionDetails({session:s,colors:c,post,notify,fail,onRead}:Props&{onRead:()=>void}){
 const [exporting,setExporting]=useState(false);
 const [talkOpen,setTalkOpen]=useState(false);
 const [converting,setConverting]=useState(false);
 const convertCopy=async(t:Carry)=>{if(converting)return;setConverting(true);try{const result=await post('sessions/carry',{agent:s.agent,id:s.id,to:t.agent,open:false}) as {command?:string};if(!result.command)throw new Error('后端未返回继续命令');await copyText(result.command);notify('转换后的继续命令已复制');}catch(e){fail(String(e));}finally{setConverting(false);}};
 const copy=async(value:string)=>{try{await copyText(value);notify('已复制到当前设备');}catch(e){fail(String(e));}};
 const stamp=(v?:string)=>v?new Date(v).toLocaleString():'';
 const num=(n?:number)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n||0);
 const row=(label:string,value:string,canCopy=false)=><View key={label} style={{flexDirection:'row',gap:12,flexWrap:'wrap',alignItems:'center'}}><Text style={{color:c.muted,width:88}}>{label}</Text><Text selectable style={{color:c.text,flex:1,minWidth:140}}>{value}</Text>{canCopy&&<Pressable accessibilityRole="button" accessibilityLabel={`复制${label}`} onPress={()=>void copy(value)} style={{padding:8}}><Icon icon={copyIcon} size={15} color={c.muted}/></Pressable>}</View>;
 const exportMd=async()=>{setExporting(true);try{const r=await post(`sessions/export?agent=${encodeURIComponent(s.agent)}&id=${encodeURIComponent(s.id)}`,{}) as {path?:string};if(!r.path)throw new Error('导出接口未返回保存路径');notify(`Markdown 已保存到服务器：${r.path}`);}catch(e){fail(String(e));}finally{setExporting(false);}};
 return <View style={{padding:16,paddingLeft:30,gap:12,backgroundColor:c.pill}}>
 {row('时间',`${stamp(s.start||s.last)} – ${stamp(s.last)}`)}{s.cwd&&row('文件夹',s.cwd)}{row('会话 ID',s.id,true)}{s.resume&&row('继续',s.resume,true)}
 {s.carry?.map(t=><View key={t.agent} style={{flexDirection:'row',gap:10,alignItems:'center',flexWrap:'wrap'}}><Text style={{color:c.muted,width:88}}>用 {t.agent==='codex'?'Codex':t.agent==='claude'?'Claude Code':t.agent} 继续</Text><Text style={{color:c.text,flexShrink:1}}>{t.convert?`将从这段对话新建一个 ${t.agent==='codex'?'Codex':t.agent==='claude'?'Claude Code':t.agent} 会话`:t.command}</Text><Pressable accessibilityRole="button" accessibilityLabel={`复制 ${t.agent} 继续命令`} disabled={converting} onPress={()=>void (t.convert?convertCopy(t):copy(t.command||''))} style={{padding:8}}><Icon icon={copyIcon} size={15} color={c.muted}/></Pressable></View>)}
 {s.models?.map((m,i)=><View key={`${m.model}:${i}`} style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}><Text selectable style={{color:c.text,flex:1,minWidth:140,fontFamily:'monospace'}}>{m.model}</Text><Text style={{color:c.muted}}>输入 {num(m.input)} · 输出 {num(m.output)} · 缓存 {num((m.cache_read||0)+(m.cache_write||0))}</Text><Text style={{color:c.green}}>{m.priced?`≈$${(m.cost||0).toFixed(3)}`:'—'}</Text></View>)}
 {s.path&&row('文件',`${s.path}${s.files&&s.files>1?` +${s.files-1} 个文件`:''}`)}
 {s.transcript&&<View style={{flexDirection:'row',gap:16,alignItems:'center',flexWrap:'wrap'}}><Text style={{color:c.muted,width:88}}>会话内容</Text><Pressable accessibilityRole="button" onPress={()=>setTalkOpen(v=>!v)}><Text style={{color:c.text}}>{talkOpen?'收起会话':'查看会话'}</Text></Pressable><Pressable accessibilityRole="button" disabled={exporting} onPress={()=>void exportMd()}><Text style={{color:c.text}}>{exporting?'导出中':'导出 Markdown'}</Text></Pressable></View>}
 {s.transcript&&talkOpen&&<SessionConversation agent={s.agent} id={s.id} colors={c}/>}
 </View>;
}
