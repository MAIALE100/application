// Window preferences are separate from musical keys and temporary microphone state.
export function panelWindow(panel,handle,reset,size,onSaveError=()=>{}) {
  const widths={small:760,normal:1120,large:1440},storage='flecity-jam-window-v1',margin=8;
  let state={x:.5,y:1,size:'normal'},drag=null,frame=0;
  try{
    const saved=JSON.parse(localStorage.getItem(storage));
    if(saved?.version===1&&Number.isFinite(saved.x)&&saved.x>=0&&saved.x<=1&&Number.isFinite(saved.y)&&saved.y>=0&&saved.y<=1&&Object.hasOwn(widths,saved.size))state={x:saved.x,y:saved.y,size:saved.size};
  }catch{}
  const clamp=(n,max)=>Math.max(margin,Math.min(Math.max(margin,max),n));
  function save(){try{localStorage.setItem(storage,JSON.stringify({version:1,...state}));}catch{onSaveError();}}
  function dimensions(){const r=panel.getBoundingClientRect();return {width:r.width,height:r.height};}
  function place(x,y,bounds=dimensions()){
    const left=clamp(x,innerWidth-bounds.width-margin),top=clamp(y,innerHeight-bounds.height-margin);
    panel.style.left=left+'px';panel.style.top=top+'px';panel.style.bottom='auto';panel.style.transform='none';
    return {left,top,...bounds};
  }
  function remember(position){
    state.x=Math.max(0,Math.min(1,(position.left-margin)/Math.max(1,innerWidth-position.width-margin*2)));
    state.y=Math.max(0,Math.min(1,(position.top-margin)/Math.max(1,innerHeight-position.height-margin*2)));
  }
  function layout(){
    frame=0;panel.style.setProperty('--panel-width',widths[state.size]+'px');size.value=state.size;
    if(panel.hidden||drag)return;
    const bounds=dimensions();place(margin+state.x*Math.max(0,innerWidth-bounds.width-margin*2),margin+state.y*Math.max(0,innerHeight-bounds.height-margin*2),bounds);
    panel.dataset.windowReady='true';
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
  function restore(){drag=null;state={x:.5,y:1,size:'normal'};layout();save();}
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();
    const rect=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height,moved:false};
    handle.setPointerCapture(event.pointerId);handle.focus({preventScroll:true});
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    drag.moved=true;place(drag.left+dx,drag.top+dy,drag);event.preventDefault();event.stopPropagation();
  });
  function finish(event){
    if(!drag||drag.id!==event.pointerId)return;
    const previous=drag;drag=null;
    if(previous.moved){const rect=panel.getBoundingClientRect();remember(place(rect.left,rect.top));save();}
    try{handle.releasePointerCapture(event.pointerId);}catch{}
    schedule();
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
  handle.addEventListener('keydown',event=>{
    if(event.code==='Home'){event.preventDefault();event.stopPropagation();restore();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.code];if(!delta)return;
    event.preventDefault();event.stopPropagation();const rect=panel.getBoundingClientRect(),step=event.shiftKey?40:10;
    remember(place(rect.left+delta[0]*step,rect.top+delta[1]*step));save();
  });
  reset.addEventListener('click',restore);
  size.addEventListener('change',()=>{if(Object.hasOwn(widths,size.value)){state.size=size.value;layout();save();}});
  window.addEventListener('resize',()=>{drag=null;schedule();});
  if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(panel);
  schedule();return {layout:schedule,cancelDrag:()=>{drag=null;}};
}
