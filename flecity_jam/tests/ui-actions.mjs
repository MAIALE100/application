// Common user actions for the button-free instrument UI; never inject note data.
export const physicalKey=code=>({Semicolon:';',Quote:"'",Backslash:'\\',BracketLeft:'[',BracketRight:']',Comma:',',Period:'.',Slash:'/',Minus:'-',Equal:'='}[code]||code.replace(/^(Key|Digit)/,'').toLowerCase());
export async function requestPlaying(page){
  const code=await page.locator('#keyboard [data-code]:not(:disabled)').first().getAttribute('data-code');
  await page.locator('#playArea').focus();await page.keyboard.press(physicalKey(code));
}
export async function beginPlaying(page) {
  if(!await page.evaluate(()=>Boolean(JAM.session))){
    const code=await page.locator('#keyboard [data-code]:not(:disabled)').first().getAttribute('data-code');
    await page.locator('#playArea').focus();await page.keyboard.down(physicalKey(code));
    try{await page.waitForFunction(()=>Boolean(JAM.session)||!document.querySelector('#error').hidden);}
    finally{await page.keyboard.up(physicalKey(code));}
    if(!await page.evaluate(()=>Boolean(JAM.session)))throw Error(await page.locator('#error').innerText());
  }
  await page.locator('#playArea').focus();
}
export async function stopPlaying(page) {
  const current=await page.locator('#instrument').inputValue();
  const other=await page.locator('#instrument option').evaluateAll((items,value)=>items.find(item=>item.value!==value)?.value,current);
  await page.selectOption('#instrument',other);await page.selectOption('#instrument',current);
  await page.locator('#playArea').focus();
}
