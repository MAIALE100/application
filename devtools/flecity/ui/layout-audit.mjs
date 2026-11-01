// Geometry signals for manual review, not a claim of human visual approval.
import fs from 'node:fs';import path from 'node:path';
export async function captureLayout(ctx,page,name){
 const result=await page.evaluate(()=>{
  const effectiveRect=e=>{let r=e.getBoundingClientRect();for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(!/(auto|scroll|hidden|clip)/.test(s.overflowX+' '+s.overflowY))continue;const q=p.getBoundingClientRect();r={left:Math.max(r.left,q.left),right:Math.min(r.right,q.right),top:Math.max(r.top,q.top),bottom:Math.min(r.bottom,q.bottom)};}return r;};
  const visible=e=>{const r=effectiveRect(e),s=getComputedStyle(e);return r.right-r.left>0&&r.bottom-r.top>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(visible);
  const clipped=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.id||e.textContent.slice(0,30));
  const textClipping=controls.filter(e=>e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2).map(e=>e.id||e.textContent.slice(0,30));
  const overlaps=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
   const x=effectiveRect(a),y=effectiveRect(b);
   if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>3&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>3)overlaps.push([a.id||a.textContent.slice(0,20),b.id||b.textContent.slice(0,20)]);
  }
  const bar=document.querySelector('#screenBar'),main=document.querySelector('main.wrap');
  const barRect=bar?.getBoundingClientRect(),mainRect=main?.getBoundingClientRect();
  const expanded=document.body.classList.contains('screen-expanded');
  const headerOverlap=!!(expanded&&barRect&&mainRect&&mainRect.top<barRect.bottom-1);
  const status=document.querySelector('body.game-active #status.app-status:not(.hidden)');
  const statusRect=status?.getBoundingClientRect();
  const statusOverBar=!!(expanded&&barRect&&statusRect&&statusRect.top<barRect.bottom-1&&statusRect.bottom>barRect.top+1);
  return {viewport:{width:innerWidth,height:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,headerOverlap,statusOverBar,clipped,textClipping,overlaps,scope:'visible controls geometry; contrast, responsiveness, scroll operation and real input latency require separate review'};
 });
 await page.screenshot({path:path.join(ctx.run.dir,'screenshots',name+'.png'),fullPage:true});
 return result;
}
export function saveLayout(ctx,name,rows){fs.writeFileSync(path.join(ctx.run.dir,name+'.json'),JSON.stringify(rows,null,2)+'\n');}
