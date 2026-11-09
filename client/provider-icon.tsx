import {useEffect,useState} from 'react';
import {Image,Text,View} from 'react-native';
import {useRpc} from '@getpaseo/plugin/client';
import {officialApi} from '../shared/contracts';
const cache=new Map<string,string>();
export function ProviderIcon({icon,name,color,size=28}:{icon?:string;name:string;color:string;size?:number}){
 const rpc=useRpc(officialApi);const [uri,setUri]=useState('');
 useEffect(()=>{let live=true;setUri('');if(!icon||icon==='generic')return;
 const file=icon.startsWith('file:')?icon.slice(5):`builtin-${icon}.${['crush','zcode','alma','hanako','cindy','lody','typesafe','atomcode','snow','mlx-serve','mothx','zoo-code','kimi-code-desktop'].includes(icon)?'png':'svg'}`;
 if(!/^[a-zA-Z0-9_.-]+$/.test(file))return;
 if(cache.has(file)){setUri(cache.get(file)!);return;}
 void rpc({path:`icons/${file}`,method:'GET'}).then(r=>{const value=(r.data as {uri?:string}|null)?.uri;if(r.ok&&value){cache.set(file,value);if(live)setUri(value);}}).catch(()=>{});return()=>{live=false;};
 },[icon,rpc]);
 return uri?<Image accessibilityLabel={`${name} 图标`} source={{uri}} style={{width:size,height:size,borderRadius:6}} onError={()=>setUri('')}/>:<View accessibilityLabel={`${name} 默认图标`} style={{width:size,height:size,borderRadius:6,backgroundColor:'#7774',alignItems:'center',justifyContent:'center'}}><Text style={{color,fontSize:size*.5,fontWeight:'600'}}>{Array.from(name.trim()||'中')[0].toUpperCase()}</Text></View>;
}
