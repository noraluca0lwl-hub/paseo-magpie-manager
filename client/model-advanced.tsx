import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { modelIds } from './provider-form';
type Draft = Record<string, Record<string, unknown>>;
export function ModelAdvanced({ids,models,draft,onChange,colors:c,busy}:{ids:string[];models:unknown[];draft:Draft;onChange:(d:Draft)=>void;colors:{text:string;muted:string;pill:string;line:string};busy:boolean}) {
 const [opened,setOpened]=useState('');
 const set=(id:string,k:string,v:unknown)=>{const m=models.find(x=>x&&typeof x==='object'&&(x as {id?:string}).id===id) as Record<string,unknown>|undefined;const price=k.startsWith('price_')&&m?.price&&typeof m.price==='object'?Object.fromEntries(Object.entries(m.price).filter(([key])=>['input','output','cache_read','cache_write','cache_write_1h'].includes(key)).map(([key,n])=>[`price_${key}`,n])):{};onChange({...draft,[id]:{...price,...draft[id],[k]:v}});};
 const field=(id:string,k:string,label:string,placeholder='',initial:unknown='')=><View style={{gap:5}} key={k}><Text style={{color:c.muted}}>{label}</Text><TextInput accessibilityLabel={`${id} ${label}`} editable={!busy} value={String(draft[id]?.[k]??initial??'')} onChangeText={v=>set(id,k,v)} placeholder={placeholder} placeholderTextColor={c.muted} style={{color:c.text,backgroundColor:c.pill,padding:10,borderRadius:7}}/></View>;
 return <View style={{gap:10}}><Text style={{color:c.text,fontWeight:'600'}}>逐模型高级设置</Text>{!ids.length&&<Text style={{color:c.muted}}>先选择或填写模型 ID</Text>}{ids.map(id=>{const m=(models.find(v=>v&&typeof v==='object'&&(v as {id?:string}).id===id)||{}) as Record<string,unknown>;const pref=draft[id]||{};
 return <View key={id} style={{borderWidth:1,borderColor:c.line,borderRadius:8,padding:12,gap:10}}><Pressable accessibilityRole="button" onPress={()=>setOpened(opened===id?'':id)}><Text style={{color:c.text}}>{opened===id?'⌄':'›'} {id}{Object.keys(pref).length?' · 已修改':''}</Text></Pressable>{opened===id&&<>
 {field(id,'name','显示名称',String(m.name||id),m.default?m.name:'')}
 {field(id,'same','等同模型','留空使用自身 ID',m.same)}
 {!!m.ids&&field(id,'id','本地模型 ID',String(m.vendor||id),m.vendor?m.id:'')}
 {field(id,'context','上下文窗口','例如 128k 或 1m；留空继承')}
 {field(id,'output','最大输出','例如 32k；留空继承')}
 <Text style={{color:c.muted}}>后端当前：上下文 {String(m.context||'未返回')} · 最大输出 {String(m.output||'未返回')}</Text>
 <Text style={{color:c.muted}}>推理等级</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(Array.isArray(m.efforts)&&m.efforts.length?m.efforts:['minimal','low','medium','high','xhigh','max']).map(level=>{const l=String(level);const selected=modelIds(String(pref.effortsText??(Array.isArray(m.kept)?m.kept:Array.isArray(m.efforts)?m.efforts:[]).join(', ')));return <Pressable key={l} accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(l)}} disabled={busy} onPress={()=>{const next=selected.includes(l)?selected.filter(x=>x!==l):[...selected,l];onChange({...draft,[id]:{...pref,effortsText:next.join(', '),reasonless:!next.length}});}} style={{padding:9,borderRadius:6,backgroundColor:c.pill}}><Text style={{color:c.text}}>{selected.includes(l)?'☑':'☐'} {l}</Text></Pressable>;})}</View>
 {(!Array.isArray(m.efforts)||!m.efforts.length)&&<Text style={{color:c.muted}}>后端未声明等级；上述为手动覆盖选项，不代表上游已支持。</Text>}
 {(['reasonless','images'] as const).map(k=><View key={k} style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:c.text,flex:1}}>{k==='reasonless'?'不发送推理参数':'接受图片'}</Text><Switch accessibilityLabel={`${id} ${k==='reasonless'?'不发送推理参数':'接受图片'}`} disabled={busy} value={Boolean(pref[k]??m[k])} onValueChange={v=>set(id,k,v)}/></View>)}
 {field(id,'api','请求协议','留空跟随供应商；chat / responses / anthropic / gemini / decide',m.api)}
 {field(id,'headersText','模型 Headers JSON','例如 {}',JSON.stringify(m.headers||{}))}
 <Text style={{color:c.muted}}>价格：美元 / 百万 tokens，留空不修改。</Text>
 {(['input','output','cache_read','cache_write','cache_write_1h'] as const).map((k,i)=>field(id,`price_${k}`,['输入价格','输出价格','缓存读取价格','缓存写入价格','一小时缓存写入价格'][i],'留空保留',m.price&&typeof m.price==='object'?(m.price as Record<string,unknown>)[k]:''))}
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
  const priceKeys=['input','output','cache_read','cache_write','cache_write_1h'];
  if(priceKeys.some(k=>`price_${k}` in d)){const price:Record<string,number>={};for(const k of priceKeys){const raw=d[`price_${k}`];if(raw!==undefined&&String(raw).trim()){const n=Number(raw);if(!Number.isFinite(n)||n<0)throw new Error(`${id} 价格需为非负数`);price[k]=n;}}if(!('input' in price)||!('output' in price))throw new Error(`${id} 修改价格时需填写输入与输出价格`);p.price=price;}
  if('priceText' in d&&String(d.priceText).trim()){const price=JSON.parse(String(d.priceText));if(!price||Array.isArray(price)||typeof price!=='object'||Object.entries(price).some(([k,v])=>!['input','output','cache_read','cache_write','cache_write_1h'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error(`${id} 价格字段或数值无效`);p.price=price;}
  for(const [k,target] of [['context',cx],['output',out]] as const)if(k in d){if(String(d[k]).trim())target[id]=size(d[k]);else delete target[id];}
  if(Object.keys(p).length)modelPrefs[id]=p;
 }
 return {modelPrefs,contexts:cx,outputs:out};
}
