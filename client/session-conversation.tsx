import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRpc } from '@getpaseo/plugin/client';
import { officialApi } from '../shared/contracts';
type Part={role:string;kind:string;text?:string;name?:string;model?:string;cut?:number};
type Talk={parts:Part[];cut?:boolean};
type Colors={text:string;muted:string;pill:string;card:string;line:string;green:string};
function Message({part:p,colors:c}:{part:Part;colors:Colors}){
 const [expanded,setExpanded]=useState(false);const thinking=p.kind==='thinking';const tool=p.kind==='tool_use'||p.kind==='tool_call';const result=p.kind==='tool_result'||p.role==='tool';
 const label=thinking?'思考':tool?'工具调用':result?'工具结果':p.role==='user'?'你':p.role==='assistant'?'助手':p.role;
 const content=<Text selectable style={{color:c.text,lineHeight:23,fontFamily:tool||result?'monospace':undefined}}>{p.text|| (p.kind==='image'?'图片附件':'空消息')}</Text>;
 return <View style={{gap:6}}><Pressable accessibilityRole={thinking?'button':undefined} accessibilityLabel={thinking?'展开思考':undefined} onPress={()=>thinking&&setExpanded(v=>!v)} style={{flexDirection:'row',gap:8,alignItems:'center'}}><Text style={{color:p.role==='user'?'#7566ed':result?c.muted:c.green,backgroundColor:c.pill,paddingHorizontal:7,paddingVertical:2,borderRadius:5}}>{label}</Text>{!!(p.name||p.model)&&<Text style={{color:c.muted,fontFamily:'monospace',flexShrink:1}}>{p.name||p.model}</Text>}{thinking&&<Text style={{color:c.muted}}>{expanded?'⌄':'›'}</Text>}</Pressable>{(!thinking||expanded)&&<View style={{backgroundColor:c.card,borderWidth:1,borderColor:c.line,borderRadius:12,padding:12,gap:6}}>{content}{!!p.cut&&<Text style={{color:c.muted}}>另有 {p.cut} 个字符已被接口截断</Text>}</View>}</View>;
}
export function SessionConversation({agent,id,colors:c}:{agent:string;id:string;colors:Colors}){
 const rpc=useRpc(officialApi);const [talk,setTalk]=useState<Talk|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setTalk(null);setError('');void rpc({path:`sessions/transcript?agent=${encodeURIComponent(agent)}&id=${encodeURIComponent(id)}`,method:'GET'}).then(r=>{if(!live)return;if(!r.ok)throw new Error(r.error||'会话读取失败');const out=r.data as Talk;if(!Array.isArray(out?.parts))throw new Error('会话缺少消息列表');setTalk(out);}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[agent,id,rpc,retry]);
 return <ScrollView nestedScrollEnabled style={{maxHeight:560,borderWidth:1,borderColor:c.line,borderRadius:12,backgroundColor:c.pill}} contentContainerStyle={{padding:12,gap:12}}>{!talk&&!error&&<ActivityIndicator color={c.green}/>} {!!error&&<View><Text accessibilityRole="alert" style={{color:'#d54949'}}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}><Text style={{color:c.text}}>重试读取</Text></Pressable></View>}{talk?.cut&&<Text style={{color:c.muted}}>接口已截断此会话，当前显示保留内容。</Text>}{talk?.parts.map((p,i)=><Message key={i} part={p} colors={c}/>)}{talk&&talk.parts.length===0&&<Text style={{color:c.muted}}>此会话暂无可读取内容。</Text>}</ScrollView>;
}
