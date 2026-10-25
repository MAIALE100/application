const resource = typeof GetParentResourceName === "function" ? GetParentResourceName() : "flecity_base";

const state = {
  boot: null,
  workspace: null,
  members: [],
  tab: "memo",
  notes: [],
  stock: [],
  tasks: [],
  calculators: [],
  money: { entries: [], summary: { income: 0, expense: 0, balance: 0 } }
};

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const num = (v) => Number(v || 0);
const yen = (v) => "$" + num(v).toLocaleString("ja-JP");

const errors = {
  PLAYER_NOT_READY:"キャラクター情報を取得できません。",
  NOT_A_MEMBER:"このBASEを開く権限がありません。",
  OWNER_REQUIRED:"オーナーのみ操作できます。",
  WORKSPACE_LIMIT:"作成できるBASE数の上限です。",
  MEMBER_LIMIT:"メンバー数の上限です。",
  TITLE_REQUIRED:"タイトルを入力してください。",
  NAME_REQUIRED:"名前を入力してください。",
  INVALID_INVITEE:"招待先のCSNを確認してください。",
  ALREADY_MEMBER:"すでに参加しています。",
  INVITE_NOT_FOUND:"招待が見つからないか期限切れです。",
  PERSONAL_WORKSPACE:"MY SPACEではこの操作はできません。",
  OWNER_CANNOT_LEAVE:"オーナーはBASEから退出できません。",
  DELETE_CONFIRM_MISMATCH:"確認用のBASE名が一致しません。",
  STOCK_CHANGED_RETRY:"在庫が同時に更新されました。もう一度操作してください。",
  INVALID_ASSIGNEE:"担当者がこのBASEのメンバーではありません。",
  CALCULATOR_LIMIT:"作成できる計算方法の上限です。",
  CALCULATOR_FIELDS_REQUIRED:"入力項目を1つ以上作ってください。",
  FORMULA_REQUIRED:"計算式を入力してください。",
  INVALID_FORMULA:"計算式を確認してください。",
  INVALID_FORMULA_VARIABLE:"計算式に存在しない入力項目が使われています。",
  BRIDGE_ERROR:"LB Phoneとの通信に失敗しました。",
  SERVER_ERROR:"サーバー処理でエラーが発生しました。"
};

function status(text, bad=false){
  const el=$("#status");
  el.textContent=text || "";
  el.style.color=bad ? "#884646" : "";
}

async function api(action, payload={}){
  try{
    const res=await fetch(`https://${resource}/flecityBase:callback`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action,payload})
    });
    const data=await res.json();
    if(!data?.ok) throw new Error(errors[data?.error] || data?.error || "処理に失敗しました。");
    return data;
  }catch(e){
    status(e.message || "通信エラー",true);
    throw e;
  }
}

function selectedWorkspaceId(){
  return state.workspace ? Number(state.workspace.id) : null;
}

function modal(title, html, onSave){
  const d=$("#modal");
  $("#modalTitle").textContent=title;
  $("#modalBody").innerHTML=html;
  const save=$("#modalSave");
  save.style.display="";
  save.onclick=async (ev)=>{
    ev.preventDefault();
    save.disabled=true;
    try{
      const ok=await onSave(new FormData($("#modalForm")));
      if(ok!==false) d.close();
    }finally{
      save.disabled=false;
    }
  };
  if(!d.open) d.showModal();
}

function viewModal(title, html){
  const d=$("#modal");
  $("#modalTitle").textContent=title;
  $("#modalBody").innerHTML=html;
  $("#modalSave").style.display="none";
  if(!d.open) d.showModal();
}

function field(name,label,value="",type="text",extra=""){
  return `<div class="field"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></div>`;
}

function textarea(name,label,value=""){
  return `<div class="field"><label>${esc(label)}</label><textarea name="${esc(name)}">${esc(value)}</textarea></div>`;
}

function workspacePills(){
  const root=$("#workspaceStrip");
  const rows=state.boot?.workspaces || [];
  root.innerHTML=rows.map(w=>`
    <button class="workspace-pill ${state.workspace && Number(state.workspace.id)===Number(w.id)?"active":""}" data-workspace="${w.id}">
      ${esc(w.icon || "📁")} ${esc(w.name)}
    </button>`).join("");
  root.querySelectorAll("[data-workspace]").forEach(b=>b.onclick=()=>openWorkspace(Number(b.dataset.workspace)));
}

function tabButtons(){
  $("#tabs").querySelectorAll("[data-tab]").forEach(b=>{
    b.classList.toggle("active",b.dataset.tab===state.tab);
    b.onclick=()=>{
      state.tab=b.dataset.tab;
      tabButtons();
      loadTab();
    };
  });
}

async function bootstrap(preferredId){
  status("BASEを読み込んでいます…");
  const boot=await api("bootstrap");
  state.boot=boot;
  const list=boot.workspaces || [];
  const target=preferredId && list.find(w=>Number(w.id)===Number(preferredId))
    ? Number(preferredId)
    : (state.workspace && list.find(w=>Number(w.id)===Number(state.workspace.id))
      ? Number(state.workspace.id)
      : Number(list[0]?.id || 0));
  workspacePills();
  if(target) await openWorkspace(target);
  else status("BASEがありません。");
}

async function openWorkspace(id){
  const data=await api("workspaceGet",{workspaceId:id});
  state.workspace=data.workspace;
  state.members=data.members || [];
  workspacePills();
  status(`${state.workspace.name} ・ ${state.members.length}人`);
  await loadTab();
}

async function loadTab(){
  if(!state.workspace) return;
  const id=selectedWorkspaceId();
  if(state.tab==="memo"){
    const d=await api("notesList",{workspaceId:id}); state.notes=d.notes||[]; renderMemo();
  }else if(state.tab==="stock"){
    const d=await api("stockList",{workspaceId:id}); state.stock=d.items||[]; renderStock();
  }else if(state.tab==="tasks"){
    const d=await api("tasksList",{workspaceId:id}); state.tasks=d.tasks||[]; renderTasks();
  }else if(state.tab==="money"){
    const d=await api("moneyList",{workspaceId:id}); state.money=d; renderMoney();
  }else{
    const d=await api("workspaceGet",{workspaceId:id}); state.workspace=d.workspace; state.members=d.members||[]; renderMembers();
  }
}

function topAction(label, action){
  return `<div class="row between"><h2>${esc(label)}</h2><button class="primary" data-action="${action}">＋ 追加</button></div>`;
}

function renderMemo(){
  const rows=state.notes;
  $("#content").innerHTML=topAction("共有メモ","new-note") + (rows.length?rows.map(n=>`
    <article class="card ${Number(n.pinned)===1?"pinned":""}">
      <div class="card-head">
        <div><div class="card-title">${Number(n.pinned)===1?"📌 ":""}${esc(n.title)}</div><div class="muted">${esc(n.updated_at||"")}</div></div>
        <span class="badge">${esc(n.author_citizenid)}</span>
      </div>
      <pre class="note-body">${esc(n.body)}</pre>
      <div class="actions">
        <button class="small" data-action="edit-note" data-id="${n.id}">編集</button>
        <button class="danger small" data-action="delete-note" data-id="${n.id}">削除</button>
      </div>
    </article>`).join(""):`<div class="empty">共有メモはまだありません。</div>`);
  bindContent();
}

function noteModal(note){
  modal(note?"メモを編集":"新しいメモ",
    field("title","タイトル",note?.title||"")+textarea("body","内容",note?.body||"")+
    `<div class="field"><label><input type="checkbox" name="pinned" ${Number(note?.pinned)===1?"checked":""}> ピン留め</label></div>`,
    async fd=>{
      const payload={workspaceId:selectedWorkspaceId(),title:fd.get("title"),body:fd.get("body"),pinned:fd.get("pinned")==="on"};
      if(note){payload.id=Number(note.id);await api("noteUpdate",payload);}else await api("noteCreate",payload);
      await loadTab(); return true;
    });
}

function renderStock(){
  $("#content").innerHTML=topAction("在庫","new-stock")+(state.stock.length?state.stock.map(i=>{
    const low=num(i.quantity)<=num(i.minimum_quantity);
    return `<article class="card">
      <div class="row between">
        <div><div class="card-title">${esc(i.name)}</div><div class="muted">最低在庫 ${num(i.minimum_quantity).toLocaleString()} ${esc(i.unit)}</div></div>
        <div class="stock-count">${num(i.quantity).toLocaleString()} <small>${esc(i.unit)}</small></div>
      </div>
      <div class="row">${low?'<span class="badge warn">在庫不足</span>':'<span class="badge good">在庫OK</span>'}</div>
      <div class="actions">
        <button class="small" data-action="stock-adjust" data-id="${i.id}" data-delta="-1">−1</button>
        <button class="small" data-action="stock-adjust" data-id="${i.id}" data-delta="1">＋1</button>
        <button class="secondary small" data-action="stock-custom" data-id="${i.id}">数量変更</button>
        <button class="secondary small" data-action="stock-config" data-id="${i.id}">設定</button>
        <button class="secondary small" data-action="stock-history" data-id="${i.id}">履歴</button>
      </div>
    </article>`;
  }).join(""):`<div class="empty">在庫品目はまだありません。</div>`);
  bindContent();
}

function newStock(){
  modal("在庫品目を追加",
    field("name","品名")+ `<div class="split">${field("quantity","初期数量","0","number")}${field("minimum","最低在庫","0","number")}</div>`+field("unit","単位","個"),
    async fd=>{await api("stockCreate",{workspaceId:selectedWorkspaceId(),name:fd.get("name"),quantity:Number(fd.get("quantity")),minimumQuantity:Number(fd.get("minimum")),unit:fd.get("unit")});await loadTab();return true;});
}

async function adjustStock(item,delta,note=""){
  await api("stockAdjust",{workspaceId:selectedWorkspaceId(),id:Number(item.id),delta:Number(delta),note});
  await loadTab();
}

function customStock(item){
  modal(`${item.name} の数量変更`,
    field("delta","増減数（減らす場合はマイナス）","0","number")+field("note","メモ"),
    async fd=>{await adjustStock(item,Number(fd.get("delta")),fd.get("note"));return true;});
}

function configStock(item){
  modal("在庫設定",field("name","品名",item.name)+`<div class="split">${field("minimum","最低在庫",item.minimum_quantity,"number")}${field("unit","単位",item.unit)}</div>`,
    async fd=>{await api("stockConfigure",{workspaceId:selectedWorkspaceId(),id:Number(item.id),name:fd.get("name"),minimumQuantity:Number(fd.get("minimum")),unit:fd.get("unit")});await loadTab();return true;});
}

async function stockHistory(item){
  const d=await api("stockHistory",{workspaceId:selectedWorkspaceId(),id:Number(item.id)});
  const rows=d.history||[];
  viewModal(item.name+" の履歴",rows.length?rows.map(h=>`
    <article class="card">
      <div class="row between"><strong>${num(h.delta)>0?"+":""}${num(h.delta).toLocaleString()}</strong><span class="badge">${esc(h.actor_citizenid)}</span></div>
      <div class="muted">${esc(h.created_at||"")} ・ ${num(h.before_quantity).toLocaleString()} → ${num(h.after_quantity).toLocaleString()}</div>
      ${h.note?`<pre class="note-body">${esc(h.note)}</pre>`:""}
    </article>`).join(""):'<div class="empty">履歴はまだありません。</div>');
}

function renderTasks(){
  $("#content").innerHTML=topAction("タスク","new-task")+(state.tasks.length?state.tasks.map(t=>{
    const label={todo:"未着手",doing:"進行中",done:"完了"}[t.status]||t.status;
    return `<article class="card">
      <div class="card-head">
        <div><div class="card-title">${esc(t.title)}</div><div class="muted">${esc(t.assignee_name||"担当なし")} ・ ${esc(t.due_at||"期限なし")}</div></div>
        <span class="badge ${t.priority==="high"?"high":""}">${esc(label)}</span>
      </div>
      ${t.details?`<pre class="note-body">${esc(t.details)}</pre>`:""}
      <div class="actions">
        <button class="small" data-action="task-next" data-id="${t.id}">状態を進める</button>
        <button class="secondary small" data-action="task-edit" data-id="${t.id}">編集</button>
        <button class="danger small" data-action="task-delete" data-id="${t.id}">削除</button>
      </div>
    </article>`;
  }).join(""):`<div class="empty">タスクはまだありません。</div>`);
  bindContent();
}

function memberOptions(selected){
  return `<option value="">担当なし</option>`+state.members.map(m=>`<option value="${esc(m.citizenid)}" ${selected===m.citizenid?"selected":""}>${esc(m.display_name)} (${esc(m.citizenid)})</option>`).join("");
}

function taskModal(task){
  const due=task?.due_at?String(task.due_at).replace(" ","T").slice(0,16):"";
  modal(task?"タスクを編集":"新しいタスク",
    field("title","タイトル",task?.title||"")+textarea("details","詳細",task?.details||"")+
    `<div class="split"><div class="field"><label>優先度</label><select name="priority">
      <option value="low" ${task?.priority==="low"?"selected":""}>低</option>
      <option value="normal" ${!task||task.priority==="normal"?"selected":""}>通常</option>
      <option value="high" ${task?.priority==="high"?"selected":""}>高</option>
    </select></div><div class="field"><label>担当</label><select name="assignee">${memberOptions(task?.assignee_citizenid||"")}</select></div></div>`+
    field("due","期限",due,"datetime-local"),
    async fd=>{
      const payload={workspaceId:selectedWorkspaceId(),title:fd.get("title"),details:fd.get("details"),priority:fd.get("priority"),assigneeCitizenId:fd.get("assignee"),dueAt:fd.get("due")||null};
      if(task){payload.id=Number(task.id);payload.status=task.status;await api("taskUpdate",payload);}else await api("taskCreate",payload);
      await loadTab();return true;
    });
}

async function nextTask(task){
  const next=task.status==="todo"?"doing":task.status==="doing"?"done":"todo";
  await api("taskUpdate",{workspaceId:selectedWorkspaceId(),id:Number(task.id),title:task.title,details:task.details,status:next,priority:task.priority,assigneeCitizenId:task.assignee_citizenid||"",dueAt:task.due_at||null});
  await loadTab();
}

function renderMoney(){
  const s=state.money.summary||{};
  $("#content").innerHTML=`
    <div class="row between"><h2>会計</h2><span class="row"><button class="secondary" data-action="money-calc">計算</button><button class="primary" data-action="new-money">＋ 記録</button></span></div>
    <div class="metric-grid">
      <div class="metric"><span>残高</span><strong>${yen(s.balance)}</strong></div>
      <div class="metric"><span>収入</span><strong>${yen(s.income)}</strong></div>
      <div class="metric"><span>支出</span><strong>${yen(s.expense)}</strong></div>
    </div>
    ${(state.money.entries||[]).length?(state.money.entries||[]).map(e=>`
      <article class="card">
        <div class="row between">
          <div><div class="card-title">${e.entry_type==="income"?"＋":"−"} ${yen(e.amount)}</div><div class="muted">${esc(e.category)} ・ ${esc(e.created_at||"")} ・ ${esc(e.actor_citizenid||"")}</div></div>
          <span class="badge ${e.voided_at?"warn":e.entry_type==="income"?"good":"high"}">${e.voided_at?"取消済":e.entry_type==="income"?"収入":"支出"}</span>
        </div>
        ${e.note?`<pre class="note-body">${esc(e.note)}</pre>`:""}
        ${!e.voided_at&&state.workspace.role==="owner"?`<div class="actions"><button class="danger small" data-action="void-money" data-id="${e.id}">取消</button></div>`:""}
      </article>`).join(""):'<div class="empty">会計記録はまだありません。</div>'}`;
  bindContent();
}

function newMoney(){
  modal("会計を記録",
    `<div class="split"><div class="field"><label>区分</label><select name="type"><option value="income">収入</option><option value="expense">支出</option></select></div>${field("amount","金額","0","number","min=\"1\"")}</div>`+
    field("category","カテゴリ","other")+field("note","内容"),
    async fd=>{await api("moneyAdd",{workspaceId:selectedWorkspaceId(),entryType:fd.get("type"),amount:Number(fd.get("amount")),category:fd.get("category"),note:fd.get("note")});await loadTab();return true;});
}

function tokenizeFormula(expression){
  const tokens=[];
  let i=0;
  const src=String(expression||"");
  while(i<src.length){
    const ch=src[i];
    if(/\s/.test(ch)){i++;continue;}
    if(/[0-9.]/.test(ch)){
      const m=src.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if(!m) throw new Error("数値の書き方を確認してください。");
      const value=Number(m[0]);
      if(!Number.isFinite(value)) throw new Error("数値が大きすぎます。");
      tokens.push({type:"number",value});
      i+=m[0].length;
      continue;
    }
    if(/[A-Za-z_]/.test(ch)){
      const m=src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      tokens.push({type:"variable",value:m[0]});
      i+=m[0].length;
      continue;
    }
    if("+-*/%()".includes(ch)){
      tokens.push({type:ch,value:ch});
      i++;
      continue;
    }
    throw new Error("使えない記号があります。");
  }
  return tokens;
}

function evaluateFormula(expression,values){
  const tokens=tokenizeFormula(expression);
  let index=0;
  const peek=()=>tokens[index];
  const take=()=>tokens[index++];

  function primary(){
    const token=peek();
    if(!token) throw new Error("計算式が途中で終わっています。");
    if(token.type==="number"){take();return token.value;}
    if(token.type==="variable"){
      take();
      if(!(token.value in values)) throw new Error(token.value+" の値がありません。");
      return Number(values[token.value]||0);
    }
    if(token.type==="("){
      take();
      const value=expressionRule();
      if(!peek()||peek().type!==")") throw new Error("カッコが閉じられていません。");
      take();
      return value;
    }
    throw new Error("計算式を確認してください。");
  }

  function unary(){
    const token=peek();
    if(token?.type==="+"){take();return unary();}
    if(token?.type==="-"){take();return -unary();}
    return primary();
  }

  function term(){
    let value=unary();
    while(peek()&&["*","/","%"].includes(peek().type)){
      const op=take().type;
      const right=unary();
      if((op==="/"||op==="%")&&right===0) throw new Error("0では割れません。");
      if(op==="*") value*=right;
      if(op==="/") value/=right;
      if(op==="%") value%=right;
    }
    return value;
  }

  function expressionRule(){
    let value=term();
    while(peek()&&["+", "-"].includes(peek().type)){
      const op=take().type;
      const right=term();
      value=op==="+"?value+right:value-right;
    }
    return value;
  }

  const result=expressionRule();
  if(index!==tokens.length) throw new Error("計算式の並びを確認してください。");
  if(!Number.isFinite(result)) throw new Error("計算結果を出せませんでした。");
  return result;
}

function roundedResult(value,mode){
  if(mode==="floor") return Math.floor(value);
  if(mode==="ceil") return Math.ceil(value);
  if(mode==="round") return Math.round(value);
  return value;
}

function calculatorFormulaLabel(calc){
  let text=String(calc.formula||"");
  [...(calc.fields||[])].reverse().forEach(f=>{
    text=text.replace(new RegExp("\\b"+f.key+"\\b","g"),()=>f.label);
  });
  return text.replace(/\*/g," × ").replace(/\//g," ÷ ");
}

function formatCalculatorResult(calc,value){
  const rounded=roundedResult(value,calc.rounding);
  if(calc.result_format==="money") return yen(rounded);
  const shown=Number(rounded).toLocaleString("ja-JP",{maximumFractionDigits:4});
  return shown+(calc.result_unit?" "+calc.result_unit:"");
}

async function moneyCalculator(){
  const d=await api("calculatorsList",{workspaceId:selectedWorkspaceId()});
  state.calculators=d.calculators||[];
  const canEdit=state.workspace.role==="owner";
  viewModal("計算方法",`
    <div class="row between">
      <div><div class="card-title">カスタム計算</div><div class="muted">BASEごとに計算式を保存できます。</div></div>
      ${canEdit?'<button id="newCalculator" class="primary" type="button">＋ 作成</button>':""}
    </div>
    <div style="display:grid;gap:.7rem;margin-top:.8rem">
      ${state.calculators.length?state.calculators.map(calc=>`
        <article class="card">
          <div class="card-head">
            <div><div class="card-title">${esc(calc.name)}</div><div class="muted">${esc(calculatorFormulaLabel(calc))}</div></div>
            <span class="badge">${(calc.fields||[]).length}項目</span>
          </div>
          <div class="actions">
            <button class="primary use-calculator" data-id="${calc.id}" type="button">使う</button>
            ${canEdit?`<button class="secondary small edit-calculator" data-id="${calc.id}" type="button">編集</button><button class="danger small delete-calculator" data-id="${calc.id}" type="button">削除</button>`:""}
          </div>
        </article>`).join(""):'<div class="empty">計算方法はまだありません。<br>OWNERが自由に作成できます。</div>'}
    </div>
  `);

  $("#newCalculator")?.addEventListener("click",()=>calculatorEditor());
  document.querySelectorAll(".use-calculator").forEach(b=>b.onclick=()=>{
    const calc=state.calculators.find(x=>Number(x.id)===Number(b.dataset.id));
    if(calc) calculatorUse(calc);
  });
  document.querySelectorAll(".edit-calculator").forEach(b=>b.onclick=()=>{
    const calc=state.calculators.find(x=>Number(x.id)===Number(b.dataset.id));
    if(calc) calculatorEditor(calc);
  });
  document.querySelectorAll(".delete-calculator").forEach(b=>b.onclick=()=>{
    const calc=state.calculators.find(x=>Number(x.id)===Number(b.dataset.id));
    if(calc) calculatorDelete(calc);
  });
}

function calculatorEditor(calc){
  const existing=(calc?.fields||[]).map(f=>({
    label:String(f.label||""),
    unit:String(f.unit||""),
    defaultValue:Number(f.defaultValue||0)
  }));
  if(!existing.length) existing.push({label:"項目1",unit:"",defaultValue:0},{label:"項目2",unit:"",defaultValue:0});
  const count=Math.min(8,Math.max(1,existing.length));

  const countOptions=Array.from({length:8},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===count?"selected":""}>${n}</option>`).join("");
  modal(calc?"計算方法を編集":"計算方法を作成",`
    ${field("name","計算方法の名前",calc?.name||"")}
    <div class="split">
      <div class="field"><label>入力項目数</label><select name="fieldCount" id="calcFieldCount">${countOptions}</select></div>
      <div class="field"><label>結果の表示</label><select name="resultFormat" id="calcResultFormat">
        <option value="money" ${!calc||calc.result_format==="money"?"selected":""}>金額 ($)</option>
        <option value="number" ${calc?.result_format==="number"?"selected":""}>数値</option>
      </select></div>
    </div>
    <div id="calcFields"></div>
    ${field("resultLabel","結果の名前",calc?.result_label||"結果")}
    <div id="calcResultUnitWrap">${field("resultUnit","結果の単位",calc?.result_unit||"")}</div>
    <div class="field"><label>端数処理</label><select name="rounding">
      <option value="floor" ${!calc||calc.rounding==="floor"?"selected":""}>切り捨て</option>
      <option value="round" ${calc?.rounding==="round"?"selected":""}>四捨五入</option>
      <option value="ceil" ${calc?.rounding==="ceil"?"selected":""}>切り上げ</option>
      <option value="none" ${calc?.rounding==="none"?"selected":""}>処理しない</option>
    </select></div>
    <div class="field">
      <label>計算式</label>
      <input id="calcFormula" name="formula" value="${esc(calc?.formula||"v1 * v2")}" autocomplete="off">
      <div class="muted">入力項目は v1、v2…で表します。例: v1 * v2 + v3</div>
    </div>
    <div id="calcTokens" class="actions"></div>
  `,async fd=>{
    const fieldCount=Math.max(1,Math.min(8,Number(fd.get("fieldCount")||1)));
    const fields=[];
    for(let i=1;i<=fieldCount;i++){
      fields.push({
        label:String(fd.get("fieldLabel"+i)||"").trim(),
        unit:String(fd.get("fieldUnit"+i)||"").trim(),
        defaultValue:Number(fd.get("fieldDefault"+i)||0)
      });
    }
    const payload={
      workspaceId:selectedWorkspaceId(),
      name:fd.get("name"),
      fields,
      formula:fd.get("formula"),
      resultLabel:fd.get("resultLabel"),
      resultFormat:fd.get("resultFormat"),
      resultUnit:fd.get("resultUnit"),
      rounding:fd.get("rounding")
    };
    if(calc){
      payload.id=Number(calc.id);
      await api("calculatorUpdate",payload);
    }else{
      await api("calculatorCreate",payload);
    }
    setTimeout(()=>moneyCalculator().catch(()=>{}),0);
    return true;
  });

  function currentFields(){
    const rows=[];
    const current=Math.max(1,Math.min(8,Number($("#calcFieldCount")?.value||count)));
    for(let i=1;i<=current;i++){
      rows.push({
        label:document.querySelector(`[name="fieldLabel${i}"]`)?.value||existing[i-1]?.label||("項目"+i),
        unit:document.querySelector(`[name="fieldUnit${i}"]`)?.value||existing[i-1]?.unit||"",
        defaultValue:document.querySelector(`[name="fieldDefault${i}"]`)?.value??existing[i-1]?.defaultValue??0
      });
    }
    return rows;
  }

  function renderFields(){
    const n=Math.max(1,Math.min(8,Number($("#calcFieldCount").value||1)));
    const values=currentFields();
    $("#calcFields").innerHTML=Array.from({length:n},(_,idx)=>{
      const i=idx+1, f=values[idx]||existing[idx]||{label:"項目"+i,unit:"",defaultValue:0};
      return `<article class="card">
        <div class="row between"><strong>v${i}</strong><span class="badge">入力${i}</span></div>
        ${field("fieldLabel"+i,"項目名",f.label)}
        <div class="split">${field("fieldUnit"+i,"単位",f.unit)}${field("fieldDefault"+i,"初期値",f.defaultValue,"number","step=\"any\"")}</div>
      </article>`;
    }).join("");
    $("#calcTokens").innerHTML=[
      ...Array.from({length:n},(_,idx)=>({label:"v"+(idx+1),value:"v"+(idx+1)})),
      {label:"＋",value:" + "},{label:"−",value:" - "},{label:"×",value:" * "},{label:"÷",value:" / "},
      {label:"%",value:" % "},{label:"(",value:"("},{label:")",value:")"}
    ].map(t=>`<button type="button" class="small calc-token" data-token="${esc(t.value)}">${esc(t.label)}</button>`).join("");
    document.querySelectorAll(".calc-token").forEach(b=>b.onclick=()=>{
      const input=$("#calcFormula");
      const token=b.dataset.token||"";
      const start=input.selectionStart??input.value.length;
      const end=input.selectionEnd??input.value.length;
      input.value=input.value.slice(0,start)+token+input.value.slice(end);
      input.focus();
      const pos=start+token.length;
      input.setSelectionRange(pos,pos);
    });
  }

  $("#calcFieldCount").onchange=renderFields;
  $("#calcResultFormat").onchange=()=>{
    $("#calcResultUnitWrap").style.display=$("#calcResultFormat").value==="number"?"":"none";
  };
  renderFields();
  $("#calcResultFormat").onchange();
}

function calculatorUse(calc){
  const fields=calc.fields||[];
  viewModal(calc.name,`
    <div class="row between"><button id="calculatorBack" class="secondary small" type="button">← 一覧</button><span></span></div>
    <article class="card">
      <div class="muted">${esc(calculatorFormulaLabel(calc))}</div>
      ${fields.map((f,i)=>`
        <div class="field">
          <label>${esc(f.label)}${f.unit?" ("+esc(f.unit)+")":""}</label>
          <input class="calc-value" data-key="${esc(f.key||("v"+(i+1)))}" type="number" step="any" value="${esc(f.defaultValue??0)}">
        </div>`).join("")}
      <button id="runCalculator" class="primary" type="button">計算する</button>
      <div id="calculatorResult" class="card" style="margin-top:.7rem;display:none"></div>
    </article>
  `);

  $("#calculatorBack").onclick=()=>moneyCalculator().catch(()=>{});
  $("#runCalculator").onclick=()=>{
    try{
      const values={};
      document.querySelectorAll(".calc-value").forEach(input=>values[input.dataset.key]=Number(input.value||0));
      const raw=evaluateFormula(calc.formula,values);
      const result=roundedResult(raw,calc.rounding);
      const el=$("#calculatorResult");
      el.style.display="";
      el.innerHTML=`<div class="muted">${esc(calc.result_label||"結果")}</div><div class="stock-count">${esc(formatCalculatorResult(calc,result))}</div>`;
      status("");
    }catch(e){
      status(e.message||"計算できませんでした。",true);
    }
  };
}

function calculatorDelete(calc){
  modal("計算方法を削除",
    `<article class="card"><div class="card-title">${esc(calc.name)}</div><div class="muted">この計算方法を削除します。会計記録そのものには影響しません。</div></article>`,
    async ()=>{
      await api("calculatorDelete",{workspaceId:selectedWorkspaceId(),id:Number(calc.id)});
      setTimeout(()=>moneyCalculator().catch(()=>{}),0);
      return true;
    });
}

function renderMembers(){
  const invites=state.boot?.invites||[];
  $("#content").innerHTML=`
    <div class="row between"><h2>メンバー</h2>${state.workspace.role==="owner"&&Number(state.workspace.is_personal)!==1?'<button class="primary" data-action="invite">＋ 招待</button>':""}</div>
    ${invites.length?`<article class="card"><div class="card-title">届いている招待</div>${invites.map(i=>`<div class="row between"><span>${esc(i.workspace_icon||"📁")} ${esc(i.workspace_name)}</span><span class="row"><button class="small" data-action="accept-invite" data-id="${i.id}">参加</button><button class="danger small" data-action="decline-invite" data-id="${i.id}">辞退</button></span></div>`).join("")}</article>`:""}
    ${state.members.map(m=>`<article class="card"><div class="row between"><div><div class="card-title">${esc(m.display_name)}</div><div class="muted">${esc(m.citizenid)}</div></div><span class="badge">${m.role==="owner"?"OWNER":"MEMBER"}</span></div>
      ${state.workspace.role==="owner"&&m.role!=="owner"?`<div class="actions"><button class="danger small" data-action="remove-member" data-cid="${esc(m.citizenid)}">除名</button></div>`:""}
    </article>`).join("")}
    ${Number(state.workspace.is_personal)!==1&&state.workspace.role==="owner"?'<div class="card"><div class="card-title">BASE設定</div><div class="actions"><button class="secondary small" data-action="rename-workspace">名前変更</button><button class="danger small" data-action="delete-workspace">BASE削除</button></div></div>':""}
    ${Number(state.workspace.is_personal)!==1&&state.workspace.role!=="owner"?'<button class="danger" data-action="leave-workspace">このBASEから退出</button>':""}`;
  bindContent();
}

function inviteMember(){
  modal("メンバーを招待",field("citizenid","CSN / citizenid"),async fd=>{await api("workspaceInvite",{workspaceId:selectedWorkspaceId(),citizenid:fd.get("citizenid")});status("招待を作成しました。");return true;});
}

function renameWorkspace(){
  modal("BASE名を変更",field("name","BASE名",state.workspace.name),async fd=>{
    await api("workspaceRename",{workspaceId:selectedWorkspaceId(),name:fd.get("name")});
    await bootstrap(selectedWorkspaceId());
    return true;
  });
}

function deleteWorkspace(){
  modal("BASEを削除",
    `<div class="card"><div class="card-title">この操作は取り消せません</div><div class="muted">メモ・在庫履歴・タスク・会計・メンバー情報が削除されます。</div></div>`+
    field("confirm","確認のためBASE名を入力"),
    async fd=>{
      await api("workspaceDelete",{workspaceId:selectedWorkspaceId(),confirmName:fd.get("confirm")});
      state.workspace=null;
      await bootstrap();
      return true;
    });
}

function newWorkspace(){
  modal("新しいBASE",
    field("name","BASE名")+field("icon","アイコン","📁")+
    `<div class="field"><label>テンプレート</label><select name="type">
      <option value="business">企業</option><option value="crew">クルー</option><option value="team">チーム</option><option value="project">プロジェクト</option><option value="custom">カスタム</option>
    </select></div>`,
    async fd=>{const d=await api("workspaceCreate",{name:fd.get("name"),icon:fd.get("icon"),workspaceType:fd.get("type"),templateKey:fd.get("type")});await bootstrap(d.workspaceId);return true;});
}

function bindContent(){
  $("#content").querySelectorAll("[data-action]").forEach(b=>b.onclick=async()=>{
    const a=b.dataset.action,id=Number(b.dataset.id||0);
    try{
      if(a==="new-note") noteModal();
      else if(a==="edit-note") noteModal(state.notes.find(x=>Number(x.id)===id));
      else if(a==="delete-note"){await api("noteDelete",{workspaceId:selectedWorkspaceId(),id});await loadTab();}
      else if(a==="new-stock") newStock();
      else if(a==="stock-adjust") await adjustStock(state.stock.find(x=>Number(x.id)===id),Number(b.dataset.delta));
      else if(a==="stock-custom") customStock(state.stock.find(x=>Number(x.id)===id));
      else if(a==="stock-config") configStock(state.stock.find(x=>Number(x.id)===id));
      else if(a==="stock-history") await stockHistory(state.stock.find(x=>Number(x.id)===id));
      else if(a==="new-task") taskModal();
      else if(a==="task-edit") taskModal(state.tasks.find(x=>Number(x.id)===id));
      else if(a==="task-next") await nextTask(state.tasks.find(x=>Number(x.id)===id));
      else if(a==="task-delete"){await api("taskDelete",{workspaceId:selectedWorkspaceId(),id});await loadTab();}
      else if(a==="new-money") newMoney();
      else if(a==="money-calc") await moneyCalculator();
      else if(a==="void-money"){await api("moneyVoid",{workspaceId:selectedWorkspaceId(),id});await loadTab();}
      else if(a==="invite") inviteMember();
      else if(a==="accept-invite"){await api("inviteAccept",{inviteId:id});await bootstrap(selectedWorkspaceId());}
      else if(a==="decline-invite"){await api("inviteDecline",{inviteId:id});await bootstrap(selectedWorkspaceId());}
      else if(a==="remove-member"){await api("workspaceRemoveMember",{workspaceId:selectedWorkspaceId(),citizenid:b.dataset.cid});await openWorkspace(selectedWorkspaceId());}
      else if(a==="rename-workspace") renameWorkspace();
      else if(a==="delete-workspace") deleteWorkspace();
      else if(a==="leave-workspace"){await api("workspaceLeave",{workspaceId:selectedWorkspaceId()});state.workspace=null;await bootstrap();}
    }catch{}
  });
}

$("#refreshBtn").onclick=()=>bootstrap(selectedWorkspaceId()).catch(()=>{});
$("#newWorkspaceBtn").onclick=newWorkspace;
tabButtons();
bootstrap().catch(()=>{});
