import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {project} from '../core.mjs';
test('shared Space binding hard-drops once only while the game owns keyboard focus',()=>{
 const listeners={};let active=true,drops=0,rotations=0,prevented=0;
 const document={hidden:false,addEventListener(type,fn){listeners[type]=fn}};
 const window={addEventListener(type,fn){listeners[type]=fn}};
 const context={document,window,setTimeout,globalThis:null};context.globalThis=context;
 vm.runInNewContext(fs.readFileSync(project('link').source+'/web/shared/controls.js','utf8'),context);
 context.FlecityGamesControls.bindArrowKeys({isActive:()=>active,onSpace:()=>drops++,onUp:()=>rotations++});
 const press=(key,extra={})=>listeners.keydown({key,repeat:false,target:{tagName:'DIV'},preventDefault(){prevented++},...extra});
 press(' ');press(' ',{repeat:true});press('ArrowUp');assert.equal(drops,1);assert.equal(rotations,1);
 press(' ',{target:{tagName:'INPUT'}});active=false;press(' ');assert.equal(drops,1);assert.equal(prevented,3);
});
