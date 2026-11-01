// Shared keyboard navigation for LOOP and LINK. Game logic stays in each app.
(()=>{
  'use strict';
  // Bounded diagnostics only: no keystrokes or player identifiers are stored.
  const timing={bindings:0,keys:0,inputMeanMs:0,inputMaxMs:0,queueMeanMs:0,queueMaxMs:0};
  function sample(field,value){
    if(!Number.isFinite(value)||value<0)return;
    const mean=field+'MeanMs',max=field+'MaxMs';
    timing[mean]+= (value-timing[mean]) / Math.min(timing.keys,200);
    timing[max]=Math.max(timing[max],value);
  }
  // WASD applies only to opted-in Tetris. Both games retain Space hard-drop.
  function bindArrowKeys({isActive,onLeft,onRight,onUp,onDownStart,onDownRepeat,onDownEnd,onSpace,onHold,onS,allowWASD=false}){
    let downHeld=false, horizontalCode='', repeatDelay=null, repeatClock=null;
    const isEditing=t=>!!(t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName)));
    const allowed=e=>!document.hidden&&typeof isActive==='function'&&isActive()&&
      !e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing&&!isEditing(e.target);
    const actionOf=e=>{
      const code=String(e.code||''),key=String(e.key||'').toLowerCase();
      const physical={ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',Space:'Space'};
      if(physical[code])return physical[code];
      if(allowWASD){
        const wasd={KeyA:'ArrowLeft',KeyD:'ArrowRight',KeyW:'ArrowUp',KeyS:'SoftS',KeyC:'Hold',ShiftLeft:'Hold',ShiftRight:'Hold'};
        if(wasd[code])return wasd[code];
        const fallback={a:'ArrowLeft',d:'ArrowRight',w:'ArrowUp',s:'SoftS',c:'Hold',shift:'Hold'};
        if(fallback[key])return fallback[key];
      }
      const legacy={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',
        arrowleft:'ArrowLeft',arrowright:'ArrowRight',arrowup:'ArrowUp',arrowdown:'ArrowDown',
        spacebar:'Space',' ':'Space',space:'Space'};
      return legacy[key]||'';
    };
    const releaseDown=()=>{
      if(!downHeld)return;
      downHeld=false;
      if(typeof onDownEnd==='function')onDownEnd();
    };
    const releaseHorizontal=()=>{
      if(repeatDelay!==null)clearTimeout(repeatDelay);
      if(repeatClock!==null)clearInterval(repeatClock);
      repeatDelay=null;repeatClock=null;horizontalCode='';
    };
    const releaseAll=()=>{releaseDown();releaseHorizontal();};
    const move=action=>{
      if(action==='ArrowLeft'&&typeof onLeft==='function')onLeft();
      if(action==='ArrowRight'&&typeof onRight==='function')onRight();
    };
    const onKeyDown=e=>{
      const enteredAt=globalThis.performance?.now?.()??Date.now();
      const action=actionOf(e);
      if(!action)return;
      if(!allowed(e)){releaseAll();return;}
      e.preventDefault();
      if(action==='ArrowLeft'||action==='ArrowRight'){
        const identity=String(e.code||e.key||action);
        if(horizontalCode===identity)return; // Ignore OS repeat; handle repeat at a bounded rate.
        releaseHorizontal();
        horizontalCode=identity;
        move(action);
        repeatDelay=setTimeout(()=>{
          repeatDelay=null;
          repeatClock=setInterval(()=>{
            if(document.hidden||typeof isActive!=='function'||!isActive()){releaseHorizontal();return;}
            move(action);
          },75);
        },190);
      }else if(action==='ArrowUp'&&!e.repeat&&typeof onUp==='function')onUp();
      else if(action==='Space'&&!e.repeat&&typeof onSpace==='function')onSpace();
      else if(action==='SoftS'&&!e.repeat&&typeof onS==='function')onS();
      else if(action==='Hold'&&!e.repeat&&typeof onHold==='function')onHold();
      else if(action==='ArrowDown'){
        if(!downHeld){downHeld=true;if(typeof onDownStart==='function')onDownStart();}
        else if(typeof onDownRepeat==='function')onDownRepeat();
      }
      timing.keys++;
      sample('input',(globalThis.performance?.now?.()??Date.now())-enteredAt);
      const queued=enteredAt-Number(e.timeStamp||enteredAt);
      if(queued>=0&&queued<60000)sample('queue',queued);
    };
    const onKeyUp=e=>{
      const action=actionOf(e);
      if(action==='ArrowDown')releaseDown();
      if((action==='ArrowLeft'||action==='ArrowRight')&&
         horizontalCode===String(e.code||e.key||action))releaseHorizontal();
    };
    // Keep capture phase: FiveM NUI buttons/browser can consume arrow/Space in bubbling phase.
    window.addEventListener('keydown',onKeyDown,true);
    timing.bindings++;
    window.addEventListener('keyup',onKeyUp,true);
    window.addEventListener('blur',releaseAll);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
    document.addEventListener('focusin',e=>{if(isEditing(e.target))releaseAll();});
    return releaseAll;
  }
  globalThis.FlecityGamesControls={bindArrowKeys,metrics:()=>({...timing})};
})();
