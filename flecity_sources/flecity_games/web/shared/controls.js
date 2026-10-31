// Shared keyboard navigation for LOOP and LINK. Game logic stays in each app.
(()=>{
  'use strict';
  function bindArrowKeys({isActive,onLeft,onRight,onUp,onDownStart,onDownRepeat,onDownEnd}){
    let downHeld=false;
    const allowed=e=>{
      const t=e.target;
      return !document.hidden&&typeof isActive==='function'&&isActive()&&
        !e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing&&
        !(t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName)));
    };
    const releaseDown=()=>{
      if(!downHeld)return;
      downHeld=false;
      if(typeof onDownEnd==='function')onDownEnd();
    };
    const onKeyDown=e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      if(!allowed(e))return;
      e.preventDefault();
      if(e.key==='ArrowLeft'&&onLeft)onLeft();
      else if(e.key==='ArrowRight'&&onRight)onRight();
      else if(e.key==='ArrowUp'&&!e.repeat&&onUp)onUp();
      else if(e.key==='ArrowDown'){
        if(!downHeld){downHeld=true;if(onDownStart)onDownStart();}
        else if(onDownRepeat)onDownRepeat();
      }
    };
    const onKeyUp=e=>{if(e.key==='ArrowDown')releaseDown();};
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    window.addEventListener('blur',releaseDown);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseDown();});
    return releaseDown;
  }
  globalThis.FlecityGamesControls={bindArrowKeys};
})();
