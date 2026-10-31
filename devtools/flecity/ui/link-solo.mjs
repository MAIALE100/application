import assert from 'node:assert/strict';import path from 'node:path';
export async function soloScenario(ctx,page){
 for(const game of ctx.solo.transcript.games){
  ctx.solo.activate(game);await page.reload();await page.locator('#create').click();
  await page.locator('#game').selectOption(game.game);
  let options=0;
  // Every mutation must match the next real Lua API response, including its payload.
  while(ctx.solo.position()<game.steps.length){
   const position=ctx.solo.position(),s=game.steps[position],p=s.payload;
   if(s.action==='partySetMastermindOptions'){
    const field=['mastermindAiDifficulty','mastermindTurnLimit','mastermindFirstTurn'][options++];
    await page.locator('#'+field).selectOption(field==='mastermindAiDifficulty'?p.aiDifficulty:field==='mastermindTurnLimit'?'no':p.firstTurn);
   }else if(s.action==='partySetShogiOptions')await page.locator('#shogiAiDifficulty').selectOption(p.aiDifficulty);
   else if(s.action==='partySetReady')await page.locator('#ready').click();
   else if(s.action==='partyStartRound')await page.locator('#start').click();
   else if(s.action==='partySubmitCodeBreak'){
    for(const value of p.guess)await page.locator('#codeBreakPalette button').nth(value-1).click();
    await page.locator('#codeBreakSubmit').click();
   }else if(s.action==='partySubmitReversi')await page.locator('#reversiBoard button').nth(p.cell-1).click();
   else if(s.action==='partySubmitConnect4')await page.locator('#connect4Columns button').nth(p.column-1).click();
   else if(s.action==='partyGetRoom'){
    ctx.solo.tactical();await page.reload();continue;
   }else if(s.action==='partySubmitMiniShogi'){
    if(p.type==='drop')await page.locator('#miniShogiOwnHand button').filter({hasText:p.kind}).click();
    else await page.locator('#miniShogiBoard button').nth(p.from-1).click();
    await page.locator('#miniShogiBoard button').nth(p.to-1).click();
    const rs=game.steps[position-1].response.room?.roundState;
    if(p.type!=='drop'&&(rs?.legalMoves||[]).some(m=>m.from===p.from&&m.to===p.to&&m.promote!==p.promote))
      await page.getByRole('button',{name:p.promote?'成る':'成らない',exact:true}).click();
   }else if(s.action==='partyLeaveRoom'){
    if(game.game==='connect4')await page.locator('#resultsPanel').waitFor({state:'visible',timeout:7000});
    else await page.locator('#resultsPanel').waitFor({state:'visible'});
    const text=await page.locator('#resultsPanel').innerText();assert(text.trim().length>5);
    if(game.result.winnerName)assert(text.includes(game.result.winnerName),'Winner display differs from real Lua result');
    await page.screenshot({path:path.join(ctx.run.dir,'screenshots','link-'+game.game+'-result.png'),fullPage:true});
    await page.locator('#roundLeave').click();await page.locator('#roundLeave').click();
   }else throw Error('Unimplemented UI step: '+s.action);
   // Wait for the callback acknowledgement rather than guessing UI timing.
   await page.waitForFunction(()=>!document.querySelector('#status')?.classList.contains('error'));
   const deadline=Date.now()+5000;
   while(ctx.solo.position()===position&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
   assert.equal(ctx.solo.position(),position+1,ctx.solo.errors.join('\n')||'Missing '+s.action);
  }
  ctx.solo.verify();
 }
}
