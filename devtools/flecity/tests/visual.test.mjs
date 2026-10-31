import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePixels} from '../ui-image-compare.mjs';
const image=()=>({width:10,height:10,data:Buffer.alloc(400,255)});
test('visual comparison accepts identical pixels and rejects a meaningful changed region',()=>{
 const a=image(),b=image();assert.equal(comparePixels(a,b).status,'PASS');b.data.fill(0,0,40);assert.equal(comparePixels(a,b).status,'FAIL');
});
test('visual noise thresholds and limited explicit dynamic masks cannot hide broad changes',()=>{
 const a=image(),b=image();b.data[0]=250;assert.equal(comparePixels(a,b).status,'PASS');b.data.fill(0,0,4);
 assert.equal(comparePixels(a,b,{masks:[{x:0,y:0,width:1,height:1}]}).status,'PASS');
 assert.throws(()=>comparePixels(a,b,{masks:[{x:0,y:0,width:10,height:10}]}));assert.throws(()=>comparePixels(a,b,{maxChangedRatio:1}));
 assert.throws(()=>comparePixels(a,{...b,width:9}));
});
