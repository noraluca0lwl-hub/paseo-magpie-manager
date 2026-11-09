import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { modelIds } from './provider-form';
type Draft = Record<string, Record<string, unknown>>;
export function ModelAdvanced({ids,models,draft,onChange,colors:c,busy}:{ids:string[];models:unknown[];draft:Draft;onChange:(d:Draft)=>void;colors:{text:string;muted:string;pill:string;line:string};busy:boolean}) {
 const [opened,setOpened]=useState('');
 const set=(id:string,k:string,v:unknown)=>onChange({...draft,[id]:{...draft[id],[k]:v}});
 const field=(id:string,k:string,label:string,placeholder='',initial:unknown='')=><View style={{gap:5}} key={k}><Text style={{color:c.muted}}>{label}</Text><TextInput accessibilityLabel={`${id} ${label}`} editable={!busy} value={String(draft[id]?.[k]??initial??'')} onChangeText={v=>set(id,k,v)} placeholder={placeholder} placeholderTextColor={c.muted} style={{color:c.text,backgroundColor:c.pill,padding:10,borderRadius:7}}/></View>;
 return <View style={{gap:10}}><Text style={{color:c.text,fontWeight:'600'}}>逐模型高级设置</Text>{!ids.length&&<Text style={{color:c.muted}}>先选择或填写模型 ID</Text>}{ids.map(id=>{const m=(models.find(v=>v&&typeof v==='object'&&(v as {id?:string}).id===id)||{}) as Record<string,unknown>;const pref=draft[id]||{};
 return <View key={id} style={{borderWidth:1,borderColor:c.line,borderRadius:8,padding:12,gap:10}}><Pressable accessibilityRole="button" onPress={()=>setOpened(opened===id?'':id)}><Text style={{color:c.text}}>{opened===id?'⌄':'›'} {id}{Object.keys(pref).length?' · 已修改':''}</Text></Pressable>{opened===id&&<>
 {field(id,'name','显示名称',String(m.name||id),m.default?m.name:'')}
 {field(id,'same','等同模型','留空使用自身 ID',m.same)}
 {!!m.ids&&field(id,'id','本地模型 ID',String(m.vendor||id),m.vendor?m.id:'')}
 {field(id,'context','上下文窗口','例如 128k 或 1m；留空继承')}
 {field(id,'output','最大输出','例如 32k；留空继承')}
 <Text style={{color:c.muted}}>后端当前：上下文 {String(m.context||'未返回')} · 最大输出 {String(m.output||'未返回')}</Text>
 {field(id,'effortsText','推理等级','逗号分隔；留空恢复默认',Array.isArray(m.kept)?m.kept.join(', '):'')}
 {Array.isArray(m.efforts)&&<Text style={{color:c.muted}}>后端提供：{m.efforts.join(', ')}</Text>}
 {(['reasonless','images'] as const).map(k=><View key={k} style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:c.text,flex:1}}>{k==='reasonless'?'不发送推理参数':'接受图片'}</Text><Switch accessibilityLabel={`${id} ${k==='reasonless'?'不发送推理参数':'接受图片'}`} disabled={busy} value={Boolean(pref[k]??m[k])} onValueChange={v=>set(id,k,v)}/></View>)}
 {field(id,'api','请求协议','留空跟随供应商；chat / responses / anthropic / gemini / decide',m.api)}
 {field(id,'headersText','模型 Headers JSON','例如 {}',JSON.stringify(m.headers||{}))}
 <Text style={{color:c.muted}}>价格：美元 / 百万 tokens，留空不修改。</Text>
 {field(id,'priceText','模型价格 JSON','例如 {"input":1,"output":2}',m.price?JSON.stringify(m.price):'')}
 <Pressable accessibilityRole="button" onPress={()=>{const next={...draft};delete next[id];onChange(next);}}><Text style={{color:c.text}}>撤销此模型本轮修改</Text></Pressable>
 </>}</View>})}</View>;
}
export function buildModelChanges(draft:Draft,contexts:unknown,outputs:unknown){
 const modelPrefs:Draft={},cx={...contexts as Record<string,number>},out={...outputs as Record<string,number>};
 const size=(s:unknown)=>{const match=String(s).trim().match(/^(\d+(?:\.\d+)?)\s*([km]?)$/i);if(!match)throw new Error('模型长度需填写正数，例如 128k、1m');const n=Number(match[1])*({k:1000,m:1000000}[match[2].toLowerCase()]||1);if(!Number.isSafeInteger(n)||n<=0)throw new Error('模型长度需为正整数');return n;};
 for(const [id,d] of Object.entries(draft)){
  const p:Record<string,unknown>={};
  for(const k of ['name','same','id','reasonless','images','api'])if(k in d)p[k]=d[k];
  if('api' in p&&!['','chat','responses','anthropic','gemini','decide'].includes(String(p.api)))throw new Error(`${id} 请求协议无效`);
  if('effortsText' in d)p.efforts=modelIds(String(d.effortsText));
  if('headersText' in d){const h=JSON.parse(String(d.headersText));if(!h||Array.isArray(h)||typeof h!=='object'||Object.values(h).some(v=>typeof v!=='string'))throw new Error(`${id} Headers 需为字符串值对象`);p.headers=h;}
  if('priceText' in d&&String(d.priceText).trim()){const price=JSON.parse(String(d.priceText));if(!price||Array.isArray(price)||typeof price!=='object'||Object.entries(price).some(([k,v])=>!['input','output','cache_read','cache_write','cache_write_1h'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error(`${id} 价格字段或数值无效`);p.price=price;}
  for(const [k,target] of [['context',cx],['output',out]] as const)if(k in d){if(String(d[k]).trim())target[id]=size(d[k]);else delete target[id];}
  if(Object.keys(p).length)modelPrefs[id]=p;
 }
 return {modelPrefs,contexts:cx,outputs:out};
}
