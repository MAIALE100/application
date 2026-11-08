(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WaveRingtoneCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const finite=value=>{
    if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
    const number=Number(value);
    return Number.isFinite(number)?number:null;
  };

  function normalizeSelection(input,durationSeconds,limits={}){
    const duration=finite(durationSeconds);
    const start=finite(input?.startSeconds);
    const end=finite(input?.endSeconds);
    const fadeIn=finite(input?.fadeInMs);
    const fadeOut=finite(input?.fadeOutMs);
    const gain=finite(input?.gain);
    if(duration===null||start===null||end===null||fadeIn===null||fadeOut===null||gain===null)return {ok:false,error:'INVALID_RINGTONE_RANGE'};
    const minSeconds=Number(limits.minSeconds??2);
    const maxSeconds=Number(limits.maxSeconds??15);
    const maxFadeMs=Number(limits.maxFadeMilliseconds??3000);
    const minGain=Number(limits.minGain??0.5);
    const maxGain=Number(limits.maxGain??1.5);
    const normalizedStart=Math.round(start*100)/100;
    const normalizedEnd=Math.round(end*100)/100;
    const normalizedFadeIn=Math.round(fadeIn);
    const normalizedFadeOut=Math.round(fadeOut);
    const normalizedGain=Math.round(gain*1000)/1000;
    const length=normalizedEnd-normalizedStart;
    if(duration<=0||normalizedStart<0||normalizedEnd>duration||length<minSeconds||length>maxSeconds)return {ok:false,error:'INVALID_RINGTONE_RANGE'};
    if(normalizedFadeIn<0||normalizedFadeOut<0||normalizedFadeIn>maxFadeMs||normalizedFadeOut>maxFadeMs||normalizedFadeIn+normalizedFadeOut>length*1000)return {ok:false,error:'INVALID_RINGTONE_FADE'};
    if(normalizedGain<minGain||normalizedGain>maxGain)return {ok:false,error:'INVALID_RINGTONE_GAIN'};
    return {ok:true,value:{startSeconds:normalizedStart,endSeconds:normalizedEnd,fadeInMs:normalizedFadeIn,fadeOutMs:normalizedFadeOut,gain:normalizedGain}};
  }

  function clipEvents(events,startSeconds,endSeconds){
    const start=finite(startSeconds),end=finite(endSeconds);
    if(start===null||end===null||end<=start)return [];
    const result=[];
    for(const event of Array.isArray(events)?events:[]){
      const baseAt=finite(event?.at),baseDuration=finite(event?.duration);
      if(baseAt===null||baseDuration===null||baseDuration<=0)continue;
      if(Array.isArray(event.phrase)&&event.phrase.length){
        const phrase=[];
        for(const segment of event.phrase){
          const offset=finite(segment?.offset),duration=finite(segment?.duration);
          if(offset===null||duration===null||duration<=0)continue;
          const absoluteStart=baseAt+offset;
          const absoluteEnd=absoluteStart+duration;
          const clippedStart=Math.max(start,absoluteStart);
          const clippedEnd=Math.min(end,absoluteEnd);
          if(clippedEnd<=clippedStart)continue;
          phrase.push({offset:Math.round((clippedStart-start)*1e6)/1e6,duration:Math.round((clippedEnd-clippedStart)*1e6)/1e6,pitch:segment.pitch,velocity:segment.velocity});
        }
        if(phrase.length)result.push({...event,at:0,duration:end-start,phrase});
        continue;
      }
      const clippedStart=Math.max(start,baseAt);
      const clippedEnd=Math.min(end,baseAt+baseDuration);
      if(clippedEnd<=clippedStart)continue;
      result.push({...event,at:Math.round((clippedStart-start)*1e6)/1e6,duration:Math.round((clippedEnd-clippedStart)*1e6)/1e6,phrase:null});
    }
    return result.sort((a,b)=>a.at-b.at);
  }

  function envelopePoints(startAt,endAt,fadeInMs,fadeOutMs,gain){
    const start=Number(startAt),end=Number(endAt),level=Number(gain);
    const inEnd=Math.min(end,start+Math.max(0,Number(fadeInMs)||0)/1000);
    const outStart=Math.max(inEnd,end-Math.max(0,Number(fadeOutMs)||0)/1000);
    return [{at:start,value:0},{at:inEnd,value:level},{at:outStart,value:level},{at:end,value:0}];
  }

  return Object.freeze({normalizeSelection,clipEvents,envelopePoints});
});
