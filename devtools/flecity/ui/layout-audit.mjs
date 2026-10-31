// Geometry signals for manual review, not a claim of human visual approval.
import fs from 'node:fs';import path from 'node:path';
export async function captureLayout(ctx,page,name){
 const result=await page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(visible);
  const clipped=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(e=>e.id||e.textContent.slice(0,30));
  const textClipping=controls.filter(e=>e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2).map(e=>e.id||e.textContent.slice(0,30));
  const overlaps=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
   const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
   if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>3&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>3)overlaps.push([a.id||a.textContent.slice(0,20),b.id||b.textContent.slice(0,20)]);
  }
  return {viewport:{width:innerWidth,height:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,clipped,textClipping,overlaps,scope:'visible controls geometry; contrast, responsiveness, scroll operation and real input latency require separate review'};
 });
 await page.screenshot({path:path.join(ctx.run.dir,'screenshots',name+'.png'),fullPage:true});
 return result;
}
export function saveLayout(ctx,name,rows){fs.writeFileSync(path.join(ctx.run.dir,name+'.json'),JSON.stringify(rows,null,2)+'\n');}
