import {soloTranscript} from '../fixtures/link-solo.mjs';
export async function run(ctx){
 const t=soloTranscript(ctx.source);
 return t.games.map(g=>g.game+': '+g.turns+' player turns'+(g.tacticalFixture?' + local checkmate fixture':' + natural completion')).join('; ')+
  '; real Lua rules/API with mocked clock/framework/Plus and DB denied; no FiveM client';
}
