/** Explicit backend capability flags control both rendering and save DTOs. */
export function supportedSetting(key:string, provider:Record<string,unknown>={}) {
 if(key==='nativeCompaction')return provider.carriesCompaction===true;
 if(key==='imageFilesOff')return provider.takesImageFiles===true;
 if(key==='insecureTLS')return !provider.id || provider.takesInsecureTLS===true;
 if(key==='passErrors')return !provider.id || provider.takesPassErrors===true;
 return true;
}
export function capabilityPayload(payload:Record<string,unknown>,provider:Record<string,unknown>={}){
 return Object.fromEntries(Object.entries(payload).filter(([key])=>supportedSetting(key,provider)));
}
