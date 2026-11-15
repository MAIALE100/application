export class MidiInput {
  constructor({press,release,pedal,panic,status,devices}) {Object.assign(this,{press,release,pedal,panic,status,devices});this.access=null;this.port=null;}
  async connect() {
    if(!navigator.requestMIDIAccess){this.status('この環境はWeb MIDIに対応していません。PCキーで演奏できます。');return;}
    try {
      this.access=await navigator.requestMIDIAccess({sysex:false});
      this.access.onstatechange=()=>this.refresh();this.refresh();
    } catch {this.status('MIDIの使用が許可されませんでした。PCキーはそのまま使えます。');}
  }
  refresh() {
    const inputs=[...this.access.inputs.values()].filter(p=>p.state==='connected');
    this.devices(inputs.map(p=>({id:p.id,name:p.name||'MIDI入力'})));
    if(this.port && !inputs.includes(this.port)){this.detach();this.status('MIDI接続が解除されました');}
    if(!this.port && inputs.length)this.select(inputs[0].id);
    if(!inputs.length)this.status('MIDI入力が見つかりません');
  }
  select(id) {
    this.detach();const port=this.access?.inputs.get(id);if(!port)return;
    this.port=port;port.onmidimessage=e=>this.receive(e.data);this.status('接続中: '+(port.name||'MIDI入力'));
  }
  receive(data) {
    const [status,pitch,value]=data,type=status&0xf0,channel=status&0x0f;
    const key=`midi:${channel}:${pitch}`;
    if(type===0x90 && value>0)this.press(key,pitch,value);
    else if(type===0x80 || (type===0x90 && value===0))this.release(key);
    else if(type===0xb0 && pitch===64)this.pedal(value>=64);
    else if(type===0xb0 && [120,123].includes(pitch))this.panic();
  }
  detach() {if(this.port){this.port.onmidimessage=null;this.port.close?.();this.panic();}this.port=null;}
}
