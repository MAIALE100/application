export class MidiInput {
  constructor({press,release,pedal,panic,status,devices}) {Object.assign(this,{press,release,pedal,panic,status,devices});this.access=null;this.port=null;this.pedals=new Set();this.connecting=null;}
  connect() {
    if(this.connecting)return this.connecting;
    if(!navigator.requestMIDIAccess){this.status('この環境はWeb MIDIに対応していません。PCキーで演奏できます。');return Promise.resolve();}
    this.connecting=Promise.resolve().then(()=>navigator.requestMIDIAccess({sysex:false})).then(access=>{
      if(this.access)this.access.onstatechange=null;
      this.access=access;this.access.onstatechange=()=>this.refresh();this.refresh();
    }).catch(()=>this.status('MIDIの使用が許可されませんでした。PCキーはそのまま使えます。'))
      .finally(()=>{this.connecting=null;});
    return this.connecting;
  }
  refresh() {
    const inputs=[...this.access.inputs.values()].filter(p=>p.state==='connected');
    this.devices(inputs.map(p=>({id:p.id,name:p.name||'MIDI入力'})));
    if(this.port && !inputs.includes(this.port)){this.detach();this.status('MIDI接続が解除されました');}
    if(!this.port && inputs.length)this.select(inputs[0].id);
    if(!inputs.length)this.status('MIDI入力が見つかりません');
  }
  select(id) {
    this.detach();const port=this.access?.inputs.get(id);if(!port||port.state!=='connected'){this.status('MIDI入力が見つかりません');return;}
    this.port=port;port.onmidimessage=e=>this.receive(e.data);this.status('接続中: '+(port.name||'MIDI入力'));
  }
  receive(data) {
    if(!data||data.length<3)return;
    const [status,pitch,value]=data,type=status&0xf0,channel=status&0x0f;
    if(!Number.isInteger(status)||status<0x80||status>0xef||![pitch,value].every(n=>Number.isInteger(n)&&n>=0&&n<=127))return;
    const key=`midi:${channel}:${pitch}`;
    if(type===0x90 && value>0)this.press(key,pitch,value);
    else if(type===0x80 || (type===0x90 && value===0))this.release(key);
    else if(type===0xb0 && pitch===64){if(value>=64)this.pedals.add(channel);else this.pedals.delete(channel);this.pedal(this.pedals.size>0);}
    else if(type===0xb0 && [120,123].includes(pitch)){this.pedals.clear();this.pedal(false);this.panic();}
  }
  detach() {
    const port=this.port;this.port=null;this.pedals.clear();
    if(port){port.onmidimessage=null;try{Promise.resolve(port.close?.()).catch(()=>{});}catch{}this.pedal(false);this.panic();}
  }
}
