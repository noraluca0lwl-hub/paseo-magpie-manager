import {strict as assert} from 'node:assert';
const modulePath='../client/provider-form.ts';
const {modelIds,savedModelIds,formHeaders}=await import(modulePath);
assert.deepEqual(modelIds('a，b, a\nc'),['a','b','c']);
assert.deepEqual(savedModelIds([{id:'enabled',on:true},{id:'disabled',on:false},'legacy']),['enabled','legacy']);
assert.deepEqual(formHeaders('{"X-Test":"yes"}'),{'X-Test':'yes'});
for(const value of ['[]','null','{"X":4}'])assert.throws(()=>formHeaders(value));
console.log('PASS provider form: selected models only, separators, headers');
