import {useEffect,useState} from 'react';
import {Icon} from '@getpaseo/plugin/client/ui';
import {Image,Text,View} from 'react-native';
import {useRpc} from '@getpaseo/plugin/client';
import {officialApi} from '../shared/contracts';
type Picture={uri?:string;svg?:string};
const cache=new Map<string,Picture>();
export function ProviderIcon({icon,name,color,size=28}:{icon?:string;name:string;color:string;size?:number}){
 const rpc=useRpc(officialApi);const [picture,setPicture]=useState<Picture>({});
 useEffect(()=>{let live=true;setPicture({});if(!icon||icon==='generic')return;
 const file=icon.startsWith('file:')?icon.slice(5):`builtin-${icon}.${['crush','zcode','alma','hanako','cindy','lody','typesafe','atomcode','snow','mlx-serve','mothx','zoo-code','kimi-code-desktop'].includes(icon)?'png':'svg'}`;
 if(!/^[a-zA-Z0-9_.-]+$/.test(file))return;
 if(cache.has(file)){setPicture(cache.get(file)!);return;}
 void rpc({path:`icons/${file}`,method:'GET'}).then(r=>{const value=r.data as Picture|null;if(r.ok&&value&&(value.svg||value.uri)){cache.set(file,value);if(live)setPicture(value);}}).catch(()=>{});return()=>{live=false;};
 },[icon,rpc]);
 if(picture.svg)return <View accessibilityLabel={`${name} 图标`} style={{width:size,height:size}}><Icon icon={{svg:picture.svg}} size={size} color={color}/></View>;
 return picture.uri?<Image accessibilityLabel={`${name} 图标`} source={{uri:picture.uri}} style={{width:size,height:size,borderRadius:6}} onError={()=>setPicture({})}/>:<View accessibilityLabel={`${name} 默认图标`} style={{width:size,height:size,borderRadius:6,backgroundColor:'#7774',alignItems:'center',justifyContent:'center'}}><Text style={{color,fontSize:size*.5,fontWeight:'600'}}>{Array.from(name.trim()||'中')[0].toUpperCase()}</Text></View>;
}
