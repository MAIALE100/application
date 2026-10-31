import vm from 'node:vm';
import assert from 'node:assert/strict';
import { sha } from '../core.mjs';

// Instrument a private VM copy of the real rule code; never edit the resource.
// This runs no browser, FiveM client, input injector, network or game process.
export async function run(ctx) {
  const source=ctx.read('web/party/fall_battle.js');
  const marker='globalThis.PartyFallBattle={render,hide,reset};';
  assert.equal(source.split(marker).length,2,'Rule export marker changed; review adapter');
  const sandbox=vm.createContext({});
  vm.runInContext(source.replace(marker,'globalThis.rules={nextPiece,shapeFor,emptyBoard,canPlace,dropY,clearLines,LINE_POINTS};\n'+marker),sandbox,{timeout:1000});
  const r=sandbox.rules;
  for(let piece=1;piece<=7;piece++)for(let rotation=0;rotation<4;rotation++){
    const shape=r.shapeFor(piece,rotation);
    assert.equal(shape.length,4);
    assert.equal(new Set(shape.map(([x,y])=>x+','+y)).size,4);
    assert(shape.every(([x,y])=>x>=0&&y>=0));
  }
  // Each AI consumes the exact same seeded piece stream and may only choose legal placements.
  function play(seed,policy){
    let rng=seed,score=0,pieces=0;
    const w=10,h=18,board=r.emptyBoard(w,h);
    for(let turn=0;turn<120;turn++){
      let type;[rng,type]=r.nextPiece(rng);
      let best=null;
      for(let rotation=0;rotation<4;rotation++)for(let x=0;x<w;x++){
        const shape=r.shapeFor(type,rotation),y=r.dropY(board,w,h,shape,x);
        if(y===null)continue;
        const next=board.map(row=>Array.from(row));
        for(const [dx,dy]of shape){assert.equal(next[y+dy][x+dx],0);next[y+dy][x+dx]=type;}
        const lines=r.clearLines(next,w);
        const height=h-(next.findIndex(row=>row.some(Boolean))<0?h:next.findIndex(row=>row.some(Boolean)));
        const value=policy==='first'?-x-rotation*10:lines*10000-height*100+y;
        if(!best||value>best.value)best={next,lines,value};
      }
      if(!best)break;
      board.splice(0,board.length,...best.next);
      score+=r.LINE_POINTS[best.lines];pieces++;
      assert.equal(board.length,h);assert(board.every(row=>row.length===w));
      assert(board.every(row=>row.every(n=>Number.isInteger(n)&&n>=0&&n<=7)));
    }
    return {score,pieces};
  }
  let matches=0;
  for(let seed=1;seed<=24;seed++){
    const a=play(seed,'greedy'),b=play(seed,'first');
    assert.deepEqual(play(seed,'greedy'),a,'Nondeterministic seeded rule result');
    assert(a.pieces>0&&b.pieces>0);matches++;
  }
  return matches+' seeded greedy-vs-first matches; real fall_battle.js SHA256='+sha(source)+'; server validation/NUI not exercised';
}
