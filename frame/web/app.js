const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function nui(ev,data={}){try{const r=await fetch(`https://${(typeof GetParentResourceName==='function'?GetParentResourceName():(globalThis.resourceName||'frame'))}/${ev}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return await r.json()}catch{return {ok:false,error:'NUI_ERROR'}}}
const view=$('#view');let viewer={},appReady=false,playerRetryTimer=null,favoriteIds=new Set();
const THEMES={
 a:{label:'A',name:'Gallery',description:'クリーン高級'},
 b:{label:'B',name:'Social',description:'モダンSNS'},
 c:{label:'C',name:'Noir',description:'ダーク高級'}
};
function getTheme(){
 const saved=localStorage.getItem('frame.theme');
 return THEMES[saved]?saved:'a';
}
function applyTheme(theme,save=true){
 const t=THEMES[theme]?theme:'a';
 document.body.dataset.theme=t;
 if(save)localStorage.setItem('frame.theme',t);
 const btn=$('#themeToggle');
 if(btn){btn.textContent=THEMES[t].label;btn.title=THEMES[t].name+' / '+THEMES[t].description}
 document.querySelectorAll('[data-theme-choice]').forEach(x=>x.classList.toggle('selected',x.dataset.themeChoice===t));
}
function closeThemeMenu(){const m=$('#themeMenu');if(m)m.hidden=true}
applyTheme(getTheme(),false);
function utcDates(o){for(const k of ['starts_at','submissions_open_at','submissions_close_at','judging_starts_at','results_at','ends_at'])if(o[k])o[k]=new Date(o[k]).toISOString().slice(0,19).replace('T',' ');return o}
const ERRORS={
 PLAYER_NOT_READY:'キャラクター情報を取得できません。',NOT_FOUND:'対象が見つかりません。',DATABASE_ERROR:'データベース処理に失敗しました。',
 FORBIDDEN:'この操作を行う権限がありません。',SUBMISSIONS_DISABLED:'このイベントは写真投稿を受け付けていません。',
 EVENT_NOT_ACTIVE:'イベント開催中のみ操作できます。',SUBMISSIONS_CLOSED:'投稿受付期間外です。',JOIN_REQUIRED:'先にイベントへ参加してください。',
 SUBMISSION_LIMIT_REACHED:'投稿上限に達しています。',INVALID_MEDIA:'画像を取得できませんでした。',NOT_OWNER_OR_NOT_DRAFT:'下書きの主催イベントだけ公開できます。',
 EDIT_DRAFT_ONLY:'編集できるのは下書き中だけです。',EVENT_ALREADY_CLOSED:'このイベントはすでに終了しています。',
 ACCESS_RULE_REQUIRED:'このイベントには参加条件があります。',ACCESS_JOB_REQUIRED:'条件付きイベントでは対象Jobを1つ以上指定してください。',ACCESS_RULE_FAILED:'現在のJobではこのイベントに参加できません。',NO_SUBMISSIONS:'応募作品がまだありません。',NO_RESULTS:'受賞作品を1件以上設定してください。',NO_AWARDS:'賞を1件以上作成してください。',UNASSIGNED_AWARDS:'未設定の賞があります。すべての賞に受賞作品を設定してください。',RESULTS_LOCKED:'結果発表後はこの操作を変更できません。',RESULT_NOT_SET:'この賞には受賞作品が設定されていません。',
 NOT_JUDGING:'審査中ではありません。',NOT_CONTEST:'コンテスト形式のイベントではありません。',INVALID_AWARD:'賞が見つかりません。',
 INVALID_SUBMISSION:'応募作品が見つかりません。',NAME_REQUIRED:'賞の名前を入力してください。',CAPTION_REQUIRED:'コメントを入力してください。',INVALID_EVENT_WINDOW:'イベントの開始・終了日時を確認してください。',INVALID_SUBMISSION_WINDOW:'投稿受付期間を確認してください。',TITLE_REQUIRED:'イベント名を入力してください。',DESCRIPTION_REQUIRED:'説明を入力してください。',STATE_CHANGED:'状態が更新されています。画面を再読み込みしてください。',
 DIRECT_UPLOAD_DISABLED:'このイベントはSNS投稿からのみ応募できます。',DELETE_DISABLED:'このイベントでは投稿を削除できません。',DELETE_CLOSED:'投稿削除の受付は終了しています。',SUBMISSION_LOCKED_OR_NOT_FOUND:'受賞設定済み、または削除できない応募作品です。',SOCIAL_ENTRY_DISABLED:'このイベントはSNS応募方式ではありません。',SOCIAL_PLATFORM_NOT_ALLOWED:'このSNSは応募先に指定されていません。',SOCIAL_ACCOUNT_REQUIRED:'LB Phoneで対象SNSにログインしてください。',PHONE_NUMBER_UNAVAILABLE:'電話番号を取得できませんでした。',SOCIAL_POST_FAILED:'SNSへの投稿に失敗しました。',ORGANIZER_REQUIRED:'先にイベントを作成してください。',INVALID_PRODUCT:'広告商品が見つかりません。',INVALID_EVENT:'紐付けるイベントを確認してください。',INVALID_WINDOW:'掲載期間を確認してください。',ADVERTISER_REQUIRED:'広告主名を入力してください。',AD_TITLE_REQUIRED:'広告タイトルを入力してください。',AD_EVENT_REQUIRED:'この掲載枠では紐付けるイベントが必要です。',AD_WITHDRAW_NOT_ALLOWED:'審査待ちの広告だけ申請取消できます。',REVIEW_REASON_REQUIRED:'却下理由を入力してください。',NOT_PENDING:'この広告は審査待ちではありません。',INVALID_DECISION:'審査内容を確認してください。',REVIEW_RACE:'別の操作で広告状態が更新されました。',CREATOR_OFFLINE:'有料広告の承認時は申請者がオンラインである必要があります。',INSUFFICIENT_FUNDS:'申請者の残高が不足しています。',PAYMENT_LEDGER_ERROR:'広告料金の記録に失敗しました。',FINALIZE_FAILED:'広告承認の確定に失敗しました。',AD_STOP_NOT_ALLOWED:'掲載予約中または掲載中の広告だけ停止できます。', INVITE_REQUIRED:'このイベントは招待者のみ参加できます。',NOT_PRIVATE_EVENT:'招待制イベントではありません。',PHONE_REQUIRED:'電話番号を入力してください。',INVITEE_OFFLINE:'相手がオンラインではありません。共同主催者の追加時は相手がオンラインである必要があります。',ALREADY_OWNER:'その人は元の主催者です。',ALREADY_COLLABORATOR:'その人はすでに共同主催者です。',COLLABORATOR_LIMIT_REACHED:'共同主催者の上限に達しています。',OWNER_CANNOT_LEAVE:'元の主催者は共同主催から抜けられません。',NOT_COLLABORATOR:'共同主催者ではありません。', VOTING_DISABLED:'このイベントでは市民投票を使用していません。',VOTING_CLOSED:'市民投票の受付は終了しています。',SELF_VOTE_DISABLED:'自分の応募作品には投票できません。',NO_VOTES:'まだ投票がありません。',VOTE_TIE:'同票1位があります。市民投票賞は手動で決定してください。', DELETE_FAILED:'イベントの関連データ削除に失敗しました。サーバーログを確認してください。',NO_EVENTS_SELECTED:'イベントを選択してください。',TOO_MANY_EVENTS:'一度に削除できるのは50件までです。', PHONE_CALLBACK_FAILED:'LB Phoneとの通信に失敗しました。',CALLBACK_FAILED:'処理に失敗しました。',NUI_ERROR:'アプリ通信に失敗しました。'
};
const STATUS={draft:'下書き',scheduled:'公開予定',active:'開催中',judging:'審査中',results:'結果発表',ended:'終了',cancelled:'中止'};
const TYPES={contest:'フォトコンテスト',mission:'フォトミッション',collection:'フォトコレクション',memorial:'メモリアル / アルバム'};
const AD_STATUS={pending_review:'審査待ち',processing:'審査処理中',scheduled:'掲載予約',active:'掲載中',ended:'掲載終了',rejected:'却下',cancelled:'取消・停止',payment_error:'支払エラー'};
const AD_PLACEMENTS={home_banner:'Home Banner',category_banner:'Category Banner',featured:'Featured Event',top_placement:'Top Placement'};
const ACTION_LABELS={EVENT_CREATE:'イベント作成',EVENT_UPDATE:'イベント編集',EVENT_PUBLISH:'イベント公開',EVENT_CANCEL:'イベント中止',EVENT_DELETE:'イベント削除',EVENT_DUPLICATE:'イベント複製',COLLABORATOR_ADD:'共同主催者追加',COLLABORATOR_REMOVE:'共同主催者解除',COLLABORATOR_LEAVE:'共同主催から離脱',SUBMISSION_DOWNLOAD:'応募画像を保存',SUBMISSION_MOD_DELETE:'応募作品を削除',SPONSOR_ADD:'スポンサー追加',SPONSOR_DELETE:'スポンサー削除',JUDGING_START:'審査開始',RESULT_SET:'受賞作品を設定',RESULT_CLEAR:'受賞設定を解除',RESULT_PUBLISH:'結果発表',EVENT_INVITE:'参加者を招待'};
function errorText(code){return ERRORS[code]||String(code||'不明なエラーです。')}
function statusLabel(v){return STATUS[v]||v||'-'}
function typeLabel(v){return TYPES[v]||v||'-'}
function boolish(v){return v===true||Number(v)===1}
function dateValue(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number'||/^\d{10,13}$/.test(String(v))){let n=Number(v);if(n<1e12)n*=1000;const d=new Date(n);return Number.isNaN(d.getTime())?null:d}const s=String(v);const d=new Date(s.includes('T')?s:(s.replace(' ','T')+'Z'));return Number.isNaN(d.getTime())?null:d}
function fmtDate(v){if(!v)return '';const d=dateValue(v);if(!d)return esc(String(v));return d.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function retentionDate(v,months){const d=dateValue(v);if(!d)return '';d.setUTCMonth(d.getUTCMonth()+Number(months||2));return d.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function retentionRemaining(v){const d=dateValue(v);if(!d)return '';const days=Math.ceil((d.getTime()-Date.now())/86400000);if(days<0)return '削除待ち';if(days===0)return '今日';if(days===1)return 'あと1日';return 'あと'+days+'日'}
function inputDate(v){if(!v)return '';const d=dateValue(v);if(!d)return String(v).replace(' ','T').slice(0,16);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}
function option(value,label,current){return '<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(label)+'</option>'}
function parseRules(v){if(!v)return {};if(typeof v==='object')return v;try{return JSON.parse(v)||{}}catch{return {}}}
function entryLabel(v){return ({frame:'FRAME応募',sns:'SNS応募',hybrid:'HYBRID応募'})[v]||'FRAME応募'}
function platformLabel(v){return v==='birdy'?'Birdy':v==='instapic'?'InstaPic':v}
function checked(v){return v?' checked':''}
function cards(a,owned=false){return a?.length?a.map(e=>{
 const cover=e.cover_media_ref?'<img class="card-cover" src="'+esc(e.cover_media_ref)+'">':'<div class="card-cover card-cover-empty"><span>FRAME</span></div>';
 const cat=e.category?'<span class="chip chip-soft">'+esc(e.category)+'</span>':'';
 const status='<span class="chip chip-status chip-'+esc(e.status)+'">'+esc(statusLabel(e.status))+'</span>';
 const type='<span class="chip chip-dark">'+esc(typeLabel(e.event_type))+'</span>';
 const shared=owned?(boolish(e.is_collaborator)?'<span class="chip chip-shared">共同主催</span>':'<span class="chip chip-owner">元主催</span>'):'';
 const fav=!owned?'<button class="favorite-btn '+(favoriteIds.has(e.public_id)?'active':'')+'" data-favorite="'+esc(e.public_id)+'">'+(favoriteIds.has(e.public_id)?'保存済み':'保存')+'</button>':'';
 const retention=owned&&e.retention_delete_at?'<span class="retention-card '+((()=>{const x=retentionRemaining(e.retention_delete_at);return x==='削除待ち'||x==='今日'||/^あと[1-7]日$/.test(x)})()?'urgent':'')+'">自動削除 '+esc(retentionRemaining(e.retention_delete_at))+'</span>':'';
 const foot=owned
   ?'<span>参加 '+Number(e.participant_count||0)+'人 / 応募 '+Number(e.submission_count||0)+'件 / 保存 '+Number(e.favorite_count||0)+'</span>'+retention
   :(e.starts_at?'<span>'+esc(fmtDate(e.starts_at))+'</span>':'');
 const closedDelete=['draft','cancelled','results','ended'].includes(e.status);
 const tools=owned?'<div class="card-tools"><button data-duplicate="'+esc(e.public_id)+'">複製</button>'+(closedDelete?'<button class="danger-soft" data-delete-event="'+esc(e.public_id)+'" data-delete-title="'+esc(e.title)+'" data-delete-force="0">削除</button>':'')+'</div>':'';
 return '<article class="card" data-id="'+esc(e.public_id)+'">'+(owned?'<label class="bulk-pick" data-bulk-wrap><input type="checkbox" data-bulk-event="'+esc(e.public_id)+'" data-bulk-status="'+esc(e.status)+'"><span>選択</span></label>':'')+cover+fav+'<div class="card-body"><div class="card-chips">'+status+type+shared+cat+'</div><h3>'+esc(e.title)+'</h3>'+(e.description?'<p>'+esc(e.description)+'</p>':'')+'<div class="card-foot">'+foot+'</div>'+tools+'</div></article>'
}).join(''):'<div class="empty"><div class="empty-mark">□</div><strong>まだイベントがありません</strong><span>新しい写真イベントを待ちましょう。</span></div>'}
function bindFavoriteButtons(onChange){
 document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=async ev=>{
   ev.stopPropagation();const id=b.dataset.favorite;b.disabled=true;
   const r=await nui('frame:toggleFavorite',{public_id:id});
   if(r.ok){
     if(r.favorited)favoriteIds.add(id);else favoriteIds.delete(id);
     b.classList.toggle('active',r.favorited);b.textContent=r.favorited?'保存済み':'保存';
     if(typeof onChange==='function')onChange();
   }else b.textContent=errorText(r.error);
   b.disabled=false;
 })
}
async function banners(){const d=await nui('frame:getActiveAds');if(!d.ok)return '';return (d.ads||[]).filter(x=>x.placement==='home_banner').slice(0,2).map(x=>`<div class="banner" data-ad="${esc(x.public_id)}" data-link="${esc(x.link_value||'')}"><img src="${esc(x.media_ref)}"><span>${esc(x.title||'Sponsored')}</span></div>`).join('')}
async function home(){
 clearTimeout(playerRetryTimer);const d=await nui('frame:getInitialData');
 if(!d.ok&&d.error==='PLAYER_NOT_READY'){appReady=false;viewer={};$('#staffNav').hidden=true;view.innerHTML='<section id="hero"><p>FRAME</p><strong>キャラクター選択を待っています。</strong></section><div class="empty">キャラクターを選択すると自動で読み込みます。</div>';playerRetryTimer=setTimeout(home,1500);return}
 appReady=!!d.ok;viewer=d.viewer||{};favoriteIds=new Set(d.favorite_ids||[]);$('#staffNav').hidden=!viewer.staff;
 const events=d.events||[],invited=d.invited||[],cats=[...new Set(events.map(x=>x.category).filter(Boolean))].sort();let favoriteOnly=false;
 let body=(await banners())+'<section id="hero"><div class="hero-eyebrow">PHOTO EVENTS / FLECITY</div><div class="hero-copy"><span>'+esc(viewer.name||'Flecity')+'さんへ</span><strong>見つける。<br>撮る。参加する。</strong><p>街の瞬間を、イベントに。</p></div><div class="hero-mark">F</div></section>';
 if(invited.length)body+='<div class="section-title"><h2>招待イベント</h2><span>'+invited.length+'件</span></div><div id="inviteList">'+cards(invited)+'</div>';
 body+='<div class="discover"><input id="eventSearch" placeholder="イベント名・説明を検索"><select id="eventCategory"><option value="">すべてのカテゴリ</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')+'</select><select id="eventType"><option value="">すべての形式</option>'+Object.entries(TYPES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></div><div class="quick-filter"><button id="favoriteOnly">保存済みだけ</button></div><div class="section-title"><h2>イベント</h2><span id="eventCount"></span></div><div id="eventList"></div>';
 view.innerHTML=body;
 const render=()=>{const q=$('#eventSearch').value.trim().toLowerCase(),cat=$('#eventCategory').value,typ=$('#eventType').value;const rows=events.filter(e=>(!q||String(e.title+' '+(e.description||'')).toLowerCase().includes(q))&&(!cat||e.category===cat)&&(!typ||e.event_type===typ)&&(!favoriteOnly||favoriteIds.has(e.public_id)));$('#eventCount').textContent=rows.length+'件';$('#eventList').innerHTML=cards(rows);bindCards();bindFavoriteButtons(render)};
 $('#eventSearch').oninput=render;$('#eventCategory').onchange=render;$('#eventType').onchange=render;$('#favoriteOnly').onclick=()=>{favoriteOnly=!favoriteOnly;$('#favoriteOnly').classList.toggle('active',favoriteOnly);render()};render();bindCards();bindFavoriteButtons(render);
 document.querySelectorAll('.banner').forEach(async b=>{await nui('frame:adImpression',{public_id:b.dataset.ad});b.onclick=async()=>{await nui('frame:adClick',{public_id:b.dataset.ad});if(b.dataset.link)detail(b.dataset.link)}})
}
async function mine(){
 const d=await nui('frame:getMyEvents');
 if(!d.ok){view.innerHTML='<div class="empty">'+esc(errorText(d.error))+'</div>';return}
 const rows=d.events||[],total=rows.length,ownedCount=rows.filter(x=>boolish(x.is_owner)).length,sharedCount=rows.filter(x=>boolish(x.is_collaborator)).length,active=rows.filter(x=>x.status==='active').length,participants=rows.reduce((n,x)=>n+Number(x.participant_count||0),0),submissions=rows.reduce((n,x)=>n+Number(x.submission_count||0),0),submitters=rows.reduce((n,x)=>n+Number(x.submitter_count||0),0),favorites=rows.reduce((n,x)=>n+Number(x.favorite_count||0),0),conversion=participants>0?Math.round((submitters/participants)*100):0;
 view.innerHTML='<div class="page-head"><span>ORGANIZER</span><h2>主催ダッシュボード</h2><p>イベント運営と反応をひと目で確認できます。</p></div><div class="stats-grid organizer-stats"><div><b>'+ownedCount+'</b><span>元主催</span></div><div><b>'+sharedCount+'</b><span>共同主催</span></div><div><b>'+active+'</b><span>開催中</span></div><div><b>'+participants+'</b><span>参加者</span></div><div><b>'+submissions+'</b><span>応募作品</span></div><div><b>'+favorites+'</b><span>保存</span></div><div><b>'+conversion+'%</b><span>参加→応募率</span></div><div><b>'+total+'</b><span>管理イベント</span></div></div><div class="section-title"><h2>主催イベント</h2><span>'+total+'件</span></div><div class="bulk-toolbar"><button id="bulkMode">一括整理</button><div id="bulkActions" hidden><button id="bulkClosed">下書き/終了済み</button><button id="bulkAll">全部</button><button id="bulkClear">解除</button><button id="bulkDelete" class="danger-soft">選択分を削除 <b id="bulkCount">0</b></button></div></div><div id="ownedEventList">'+cards(rows,true)+'</div>';
 bindCards();bindDuplicateButtons();bindDeleteEventButtons();bindBulkOrganizer();
}
function bindBulkOrganizer(){
 const mode=$('#bulkMode'),actions=$('#bulkActions'),list=$('#ownedEventList');if(!mode||!actions||!list)return;
 let enabled=false;
 const boxes=()=>Array.from(document.querySelectorAll('[data-bulk-event]'));
 const update=()=>{const n=boxes().filter(x=>x.checked).length;const c=$('#bulkCount');if(c)c.textContent=String(n)};
 const setMode=v=>{enabled=v;list.classList.toggle('bulk-mode',enabled);actions.hidden=!enabled;mode.classList.toggle('active',enabled);mode.textContent=enabled?'一括整理中':'一括整理';if(!enabled){boxes().forEach(x=>x.checked=false);update()}};
 mode.onclick=()=>setMode(!enabled);
 document.querySelectorAll('[data-bulk-wrap]').forEach(w=>w.onclick=e=>e.stopPropagation());
 boxes().forEach(b=>{b.onchange=update;b.onclick=e=>e.stopPropagation()});
 $('#bulkClosed').onclick=()=>{const closed=new Set(['draft','cancelled','results','ended']);boxes().forEach(b=>b.checked=closed.has(b.dataset.bulkStatus));update()};
 $('#bulkAll').onclick=()=>{boxes().forEach(b=>b.checked=true);update()};
 $('#bulkClear').onclick=()=>{boxes().forEach(b=>b.checked=false);update()};
 $('#bulkDelete').onclick=async()=>{
  const selected=boxes().filter(x=>x.checked);
  if(!selected.length){action({ok:false,error:'NO_EVENTS_SELECTED'});return}
  const hasLive=selected.some(x=>!['draft','cancelled','results','ended'].includes(x.dataset.bulkStatus));
  if(hasLive){alert('主催者権限では、開催中・予定・審査中のイベントを完全削除できません。\n先にイベントを中止してから削除してください。');return}
  const msg=selected.length+'件を完全に削除します。\n\n応募作品・賞・スポンサー等も削除され、元に戻せません。';
  if(!confirm(msg))return;
  const btn=$('#bulkDelete');btn.disabled=true;btn.textContent='削除中…';
  const r=await nui('frame:deleteEventsBulk',{public_ids:selected.map(x=>x.dataset.bulkEvent),force:false});
  if(Number(r?.deleted_count||0)>0){await mine();if(Number(r.failed_count||0)>0)alert('削除 '+r.deleted_count+'件 / 失敗 '+r.failed_count+'件')}
  else{btn.disabled=false;btn.innerHTML='選択分を削除 <b id="bulkCount">'+selected.length+'</b>';action(r)}
 };
 update();
}

function create(){renderEventForm(null)}
async function editEvent(id){const d=await nui('frame:getEvent',{public_id:id});if(!d.ok)return action(d);d.event.access_jobs=(d.access_jobs||[]).map(x=>x.rule_value);renderEventForm(d.event)}
function renderEventForm(e){
 const editing=!!e,rules=parseRules(e?.extra_rules),platforms=Array.isArray(rules.social_platforms)?rules.social_platforms:[];
 let h='<div class="page-head"><span>EVENT BUILDER</span><h2>'+(editing?'イベント編集':'イベント作成')+'</h2><p>写真イベントの内容と応募方法を設定します。</p></div><div class="retention-notice"><b>自動整理</b><span>イベントは作成から2か月後に、進行状況に関係なく自動削除されます。</span></div>';
 if(!editing)h+='<div class="template-box"><span>QUICK TEMPLATE</span><div class="template-grid"><button type="button" data-template="contest"><b>コンテスト</b><small>審査・受賞あり</small></button><button type="button" data-template="pr"><b>企業PR</b><small>SNS連携向け</small></button><button type="button" data-template="mission"><b>ミッション</b><small>課題写真を募集</small></button><button type="button" data-template="memorial"><b>アルバム</b><small>思い出を収集</small></button></div></div>';
 h+='<form id="eventForm" class="panel-form">';
 h+='<label>イベント名<input name="title" maxlength="160" required value="'+esc(e?.title||'')+'"></label>';
 h+='<label>説明<textarea name="description" maxlength="8000" required>'+esc(e?.description||'')+'</textarea></label>';
 h+='<label>カテゴリ<select name="category" id="eventCategoryField">'+option('一般','一般',e?.category||'一般')+option('企業PR','企業PR',e?.category)+option('季節イベント','季節イベント',e?.category)+option('コミュニティ','コミュニティ',e?.category)+option('Weazel','Weazel',e?.category)+option('記念・思い出','記念・思い出',e?.category)+'</select></label>';
 h+='<label>カバー画像<input type="hidden" name="cover_media_ref" id="coverMedia" value="'+esc(e?.cover_media_ref||'')+'"><button type="button" id="pickCover" class="secondary wide-btn">Galleryからカバー画像を選択</button><div id="coverPreview">'+(e?.cover_media_ref?'<img class="cover-preview" src="'+esc(e.cover_media_ref)+'">':'<span class="hint">未設定</span>')+'</div></label>';
 h+='<label>タイプ<select name="event_type" id="eventTypeField">'+option('contest','Photo Contest',e?.event_type||'contest')+option('mission','Photo Mission',e?.event_type)+option('collection','Photo Collection',e?.event_type)+option('memorial','Memorial / Album',e?.event_type)+'</select></label>';
 h+='<label>応募方式<select name="entry_mode" id="entryMode">'+option('frame','FRAME応募',rules.entry_mode||'frame')+option('sns','SNS応募',rules.entry_mode)+option('hybrid','HYBRID応募',rules.entry_mode)+'</select></label>';
 h+='<div id="socialSettings" class="social-settings"><label class="check"><input type="checkbox" name="social_birdy"'+checked(platforms.includes('birdy'))+'> Birdy</label><label class="check"><input type="checkbox" name="social_instapic"'+checked(platforms.includes('instapic'))+'> InstaPic</label><label>公式ハッシュタグ<input name="required_hashtag" maxlength="100" placeholder="例：FRAME2026" value="'+esc(rules.required_hashtag||'')+'"></label><span class="hint">SNS応募では、FRAMEからSNSへ実投稿が成功した場合のみ応募登録します。</span></div>';
 h+='<label>公開範囲<select name="visibility" id="visibilityField">'+option('public','公開',e?.visibility||'public')+option('unlisted','限定リンク',e?.visibility)+option('private','招待制',e?.visibility)+option('restricted','条件付き',e?.visibility)+'</select></label>';
 h+='<div id="restrictedSettings" class="restricted-settings"><label>対象Job<input name="allowed_jobs" maxlength="300" placeholder="例：police, ambulance, weazel" value="'+esc(Array.isArray(e?.access_jobs)?e.access_jobs.join(', '):'')+'"></label><span class="hint">カンマ区切りで指定。対象Jobのプレイヤーだけ一覧表示・参加できます。</span></div>';
 h+='<label>投稿上限<input type="number" id="maxSubmissionsField" name="max_submissions" min="1" max="50" value="'+esc(e?.max_submissions||1)+'"></label>';
 h+='<div id="votingSettings" class="voting-settings"><label class="check"><input type="checkbox" name="voting_enabled"'+checked(boolish(e?.voting_enabled))+'> 市民投票を有効にする</label><span class="hint">1人1票。自分の作品には投票できず、結果発表までは投票先を変更できます。</span></div>';
 h+='<label>開始日時<input type="datetime-local" name="starts_at" value="'+esc(inputDate(e?.starts_at))+'"></label><label>投稿開始<input type="datetime-local" name="submissions_open_at" value="'+esc(inputDate(e?.submissions_open_at))+'"></label><label>投稿締切<input type="datetime-local" name="submissions_close_at" value="'+esc(inputDate(e?.submissions_close_at))+'"></label><label>結果発表<input type="datetime-local" name="results_at" value="'+esc(inputDate(e?.results_at))+'"></label><label>終了日時<input type="datetime-local" name="ends_at" value="'+esc(inputDate(e?.ends_at))+'"></label>';
 h+='<button class="primary">'+(editing?'変更を保存':'下書きを作成')+'</button><p id="formStatus"></p></form>';view.innerHTML=h;document.querySelectorAll('#eventForm>label').forEach(x=>x.classList.add('field-card'));
 const toggleSocial=()=>{$('#socialSettings').hidden=$('#entryMode').value==='frame'};toggleSocial();
 if(!editing)document.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{
   const t=b.dataset.template;
   const presets={
     contest:{type:'contest',category:'一般',entry:'hybrid',max:3,birdy:true,insta:true},
     pr:{type:'contest',category:'企業PR',entry:'hybrid',max:3,birdy:true,insta:true},
     mission:{type:'mission',category:'コミュニティ',entry:'frame',max:1,birdy:false,insta:false},
     memorial:{type:'memorial',category:'記念・思い出',entry:'frame',max:10,birdy:false,insta:false}
   };
   const p=presets[t];if(!p)return;
   $('#eventTypeField').value=p.type;$('#eventCategoryField').value=p.category;$('#entryMode').value=p.entry;$('#maxSubmissionsField').value=p.max;
   const birdy=document.querySelector('[name="social_birdy"]'),insta=document.querySelector('[name="social_instapic"]');if(birdy)birdy.checked=p.birdy;if(insta)insta.checked=p.insta;
   toggleSocial();document.querySelectorAll('[data-template]').forEach(x=>x.classList.toggle('selected',x===b));
 });
 $('#entryMode').onchange=toggleSocial;const toggleVoting=()=>{$('#votingSettings').hidden=$('#eventTypeField').value!=='contest'};toggleVoting();$('#eventTypeField').addEventListener('change',toggleVoting);const toggleRestricted=()=>{$('#restrictedSettings').hidden=$('#visibilityField').value!=='restricted'};toggleRestricted();$('#visibilityField').onchange=toggleRestricted;
 $('#pickCover').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){$('#coverMedia').value=m.media.src;$('#coverPreview').innerHTML='<img class="cover-preview" src="'+esc(m.media.src)+'">'}};
 $('#eventForm').onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),o=Object.fromEntries(fd);o.max_submissions=+o.max_submissions;o.participation_required=true;o.submission_enabled=true;o.allow_submission_delete=true;o.allow_submission_edit=false;o.voting_enabled=fd.has('voting_enabled');o.social_birdy=fd.has('social_birdy');o.social_instapic=fd.has('social_instapic');if(o.entry_mode!=='frame'&&!o.social_birdy&&!o.social_instapic){$('#formStatus').textContent='SNS応募ではBirdyまたはInstaPicを1つ以上選択してください。';return}if(editing)o.public_id=e.public_id;utcDates(o);const d=await nui(editing?'frame:updateEvent':'frame:createEvent',o);$('#formStatus').textContent=d.ok?(editing?'保存しました':'作成しました'):errorText(d.error);if(d.ok)setTimeout(()=>editing?detail(e.public_id):mine(),250)}
}
function bindCards(){document.querySelectorAll('.card[data-id]').forEach(x=>x.onclick=()=>detail(x.dataset.id))}
function bindDuplicateButtons(){document.querySelectorAll('[data-duplicate]').forEach(b=>b.onclick=async e=>{e.stopPropagation();b.disabled=true;b.textContent='複製中…';const r=await nui('frame:duplicateEvent',{public_id:b.dataset.duplicate});if(r.ok){mine()}else{b.disabled=false;b.textContent=errorText(r.error)}})}
function bindDeleteEventButtons(){document.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const title=b.dataset.deleteTitle||'このイベント',force=b.dataset.deleteForce==='1';const msg=force?'「'+title+'」は開催中・予定・審査中です。\n\nイベントを中止して完全に削除しますか？\n応募作品・賞・スポンサー等も削除され、元に戻せません。':'「'+title+'」を完全に削除しますか？\n\n応募作品・賞・スポンサー・招待なども削除され、元に戻せません。';if(!confirm(msg))return;b.disabled=true;b.textContent='削除中…';const r=await nui('frame:deleteEvent',{public_id:b.dataset.deleteEvent,force:force});if(r.ok){mine()}else{b.disabled=false;b.textContent=errorText(r.error)}})}

async function detail(id){
 const d=await nui('frame:getEvent',{public_id:id});if(!d.ok){view.innerHTML='<div class="empty">'+esc(errorText(d.error))+'</div>';return}
 const e=d.event,rules=parseRules(e.extra_rules),mode=rules.entry_mode||'frame',platforms=Array.isArray(rules.social_platforms)?rules.social_platforms:[],max=Number(e.max_submissions||1),used=Number(d.own_submission_count||0),remaining=Math.max(0,max-used);
 let controls='<button id="favoriteEvent" class="save-action '+(d.favorited?'active':'')+'">'+(d.favorited?'保存済み':'イベントを保存')+'</button><div class="notification-hint">保存するとイベント開始・結果発表を通知します。</div>',dates='',entry='<dt>応募方式</dt><dd>'+esc(entryLabel(mode))+'</dd>';
 if(platforms.length)entry+='<dt>対象SNS</dt><dd>'+platforms.map(platformLabel).map(esc).join(' / ')+'</dd>';
 if(rules.required_hashtag)entry+='<dt>ハッシュタグ</dt><dd>#'+esc(rules.required_hashtag)+'</dd>';if(boolish(e.voting_enabled))entry+='<dt>市民投票</dt><dd>有効</dd>';if(e.visibility==='restricted'&&d.access_jobs?.length)entry+='<dt>参加条件</dt><dd>Job: '+d.access_jobs.map(x=>esc(x.rule_value)).join(' / ')+'</dd>';
 if(d.retention_delete_at||e.created_at){const deadline=d.retention_delete_at||retentionDate(e.created_at,d.retention_months);dates+='<dt>自動削除</dt><dd class="retention-date">'+esc(fmtDate(deadline))+' <small>'+esc(retentionRemaining(deadline))+'</small></dd>';}if(e.starts_at)dates+='<dt>開始</dt><dd>'+esc(fmtDate(e.starts_at))+'</dd>';if(e.submissions_close_at)dates+='<dt>投稿締切</dt><dd>'+esc(fmtDate(e.submissions_close_at))+'</dd>';if(e.results_at)dates+='<dt>結果発表</dt><dd>'+esc(fmtDate(e.results_at))+'</dd>';if(e.ends_at)dates+='<dt>終了</dt><dd>'+esc(fmtDate(e.ends_at))+'</dd>';
 if(d.can_manage&&e.status==='draft')controls+='<button id="editEvent">編集</button><button id="publish" class="primary">イベントを公開</button>';
 if(e.status==='active'){
   controls+=d.joined?'<button disabled class="done">参加済み</button>':'<button id="join">参加する</button>';
   if(d.joined&&remaining>0){
     if(rules.direct_upload_allowed!==false&&boolish(e.submission_enabled))controls+='<button id="gallery">GalleryからFRAME応募</button><button id="camera">撮影してFRAME応募</button>';
     if(mode!=='frame'&&platforms.includes('birdy'))controls+='<button class="social-btn" data-social="birdy">Birdyに投稿して応募</button>';
     if(mode!=='frame'&&platforms.includes('instapic'))controls+='<button class="social-btn" data-social="instapic">InstaPicに投稿して応募</button>';
     controls+='<div class="hint">あと '+remaining+' 枚応募できます。</div>';
   }else if(d.joined&&remaining<=0)controls+='<div class="hint">応募上限の '+max+' 枚に達しています。</div>';
   else controls+='<div class="hint">参加後に応募できます。</div>';
 }else if(e.status==='scheduled')controls+='<div class="hint">開始時刻になると参加・応募できます。</div>';else if(e.status==='judging')controls+='<div class="hint">現在、審査中です。</div>';else if(e.status==='results')controls+='<div class="hint">結果が発表されています。</div>';else if(e.status==='cancelled')controls+='<div class="hint">このイベントは中止されました。</div>';
 if(d.can_manage)controls+='<button id="manage">応募作品・審査を管理</button>';if(d.can_manage&&e.visibility==='private'&&['draft','scheduled','active'].includes(e.status))controls+='<div class="invite-box"><input id="invitePhone" placeholder="電話番号"><button id="invitePhoneBtn">電話番号で招待</button><span id="inviteStatus" class="hint"></span></div>';if(d.can_manage&&['draft','scheduled','active','judging'].includes(e.status))controls+='<button id="cancelEvent" class="danger-soft">イベントを中止</button>';{const closedDelete=['draft','cancelled','results','ended'].includes(e.status),operator=!!viewer.staff,canDelete=operator||(d.can_manage&&closedDelete),forceDelete=operator&&!closedDelete;if(canDelete)controls+='<button id="deleteEvent" class="danger-delete" data-force="'+(forceDelete?'1':'0')+'">'+(forceDelete?'Weazel運営として中止・削除':'イベントを削除')+'</button>';}
 view.innerHTML='<button class="back">← 戻る</button><article class="detail">'+(e.cover_media_ref?'<div class="detail-cover-wrap"><img class="cover" src="'+esc(e.cover_media_ref)+'"><div class="detail-cover-shade"></div><div class="detail-cover-label"><span>'+esc(typeLabel(e.event_type))+'</span><b>'+esc(statusLabel(e.status))+'</b></div></div>':'<div class="detail-no-cover">FRAME / '+esc(typeLabel(e.event_type))+'</div>')+'<div class="detail-kicker">'+(e.category?esc(e.category)+' / ':'')+'PHOTO EVENT</div><h2>'+esc(e.title)+'</h2><p class="detail-desc">'+esc(e.description)+'</p><dl class="detail-grid"><dt>主催</dt><dd>'+esc(e.organizer_name)+'</dd>'+(d.is_collaborator?'<dt>あなた</dt><dd><span class="shared-role">共同主催者</span></dd>':'')+'<dt>参加者</dt><dd>'+Number(d.participant_count||0)+'人</dd><dt>応募作品</dt><dd>'+Number(d.submission_count||0)+'件</dd><dt>保存</dt><dd>'+Number(d.favorite_count||0)+'件</dd><dt>応募上限</dt><dd>'+max+'枚</dd>'+entry+dates+'</dl><div class="actions">'+controls+'</div><p id="actionStatus"></p><div id="collaborators"></div><div id="sponsors"></div><div id="mineSubs"></div><div id="voting"></div><div id="results"></div></article>';
 $('.back').onclick=home;if($('#favoriteEvent'))$('#favoriteEvent').onclick=async()=>{const r=await nui('frame:toggleFavorite',{public_id:id});if(r.ok){if(r.favorited)favoriteIds.add(id);else favoriteIds.delete(id);detail(id)}else action(r)};if($('#editEvent'))$('#editEvent').onclick=()=>editEvent(id);if($('#publish'))$('#publish').onclick=async()=>{const r=await nui('frame:publishEvent',{public_id:id});r?.ok?detail(id):action(r)};if($('#join'))$('#join').onclick=async()=>{const r=await nui('frame:joinEvent',{public_id:id});r?.ok?detail(id):action(r)};
 if($('#gallery'))$('#gallery').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){const r=await nui('frame:submitPhoto',{public_id:id,media_ref:m.media.src,caption:''});r?.ok?detail(id):action(r)}};
 if($('#camera'))$('#camera').onclick=async()=>{const m=await nui('frame:takePhoto');if(m?.url){const r=await nui('frame:submitPhoto',{public_id:id,media_ref:m.url,caption:''});r?.ok?detail(id):action(r)}};
 document.querySelectorAll('[data-social]').forEach(b=>b.onclick=async()=>{b.disabled=true;const m=await nui('frame:pickGallery');if(!m?.media?.src){b.disabled=false;return}const r=await nui('frame:submitSocialPhoto',{public_id:id,platform:b.dataset.social,media_ref:m.media.src,caption:''});if(r?.ok)detail(id);else{b.disabled=false;action(r)}});
 if($('#manage'))$('#manage').onclick=()=>manage(id);if($('#invitePhoneBtn'))$('#invitePhoneBtn').onclick=async()=>{const phone=$('#invitePhone').value.trim();const r=await nui('frame:invitePhone',{public_id:id,phone_number:phone});$('#inviteStatus').textContent=r.ok?'招待しました。':errorText(r.error)};if($('#cancelEvent'))$('#cancelEvent').onclick=async()=>{if(!confirm('このイベントを中止しますか？'))return;const r=await nui('frame:cancelEvent',{public_id:id});r?.ok?detail(id):action(r)};if($('#deleteEvent'))$('#deleteEvent').onclick=async()=>{const force=$('#deleteEvent').dataset.force==='1';const msg=force?'「'+e.title+'」を中止して完全に削除しますか？\n\n応募作品・賞・スポンサー等も削除され、元に戻せません。':'「'+e.title+'」を完全に削除しますか？\n\n応募作品・賞・スポンサー・招待なども削除され、元に戻せません。';if(!confirm(msg))return;const r=await nui('frame:deleteEvent',{public_id:id,force:force});if(r?.ok){activateNav('mine');mine()}else action(r)};
 loadCollaborators(id,d.can_share,d.can_manage);loadSponsors(id);loadMine(id,e);loadVoting(id);loadResults(id)
}
function action(d){const el=$('#actionStatus');if(el)el.textContent=d?.ok?'完了しました':errorText(d?.error)}
async function loadCollaborators(id,canShare,canManage){
 if(!canManage)return;
 const d=await nui('frame:getCollaborators',{public_id:id});if(!d.ok)return;
 const rows=d.collaborators||[],max=Number(d.collaborator_max||10),share=!!d.can_share;
 let h='<section class="collab-panel"><div class="section-title"><h3>共同主催者</h3><span>'+rows.length+' / '+max+'人</span></div><p class="collab-help">追加された人は、このイベントを主催者側として編集・運営・審査できます。共同主催者の追加・解除は元の主催者だけが行えます。</p>';
 if(share&&rows.length<max)h+='<div class="collab-add"><input id="collabPhone" placeholder="相手の電話番号"><button id="addCollaborator">共同主催者に追加</button><span id="collabStatus" class="hint">追加時のみ相手がオンラインである必要があります。</span></div>';
 else if(share&&rows.length>=max)h+='<div class="collab-limit">共同主催者は最大 '+max+' 人です。</div>';
 if(rows.length)h+='<div class="collab-list">'+rows.map(x=>'<div class="collab-row"><div><b>'+esc(x.display_name||'共同主催者')+'</b><small>'+(x.phone_number?esc(x.phone_number):'共同主催者')+'</small></div>'+(share?'<button class="danger-soft" data-remove-collab="'+x.id+'">解除</button>':'')+'</div>').join('')+'</div>';
 else h+='<div class="collab-empty">まだ共同主催者はいません。</div>';
 if(d.can_leave)h+='<button id="leaveCollaborator" class="danger-soft collab-leave">共同主催から抜ける</button>';
 h+='</section>';$('#collaborators').innerHTML=h;
 if($('#addCollaborator'))$('#addCollaborator').onclick=async()=>{const phone=$('#collabPhone').value.trim();const r=await nui('frame:addCollaborator',{public_id:id,phone_number:phone});if(r.ok)loadCollaborators(id,share,canManage);else $('#collabStatus').textContent=errorText(r.error)};
 document.querySelectorAll('[data-remove-collab]').forEach(b=>b.onclick=async()=>{if(!confirm('この共同主催者を解除しますか？'))return;const r=await nui('frame:removeCollaborator',{public_id:id,collaborator_id:Number(b.dataset.removeCollab)});if(r.ok)loadCollaborators(id,share,canManage);else b.textContent=errorText(r.error)});
 if($('#leaveCollaborator'))$('#leaveCollaborator').onclick=async()=>{if(!confirm('このイベントの共同主催から抜けますか？\n\n以後、主催者側の編集・審査はできなくなります。'))return;const r=await nui('frame:leaveCollaborator',{public_id:id});if(r.ok){activateNav('mine');mine()}else action(r)};
}

async function loadSponsors(id){
 const d=await nui('frame:getSponsors',{public_id:id});if(!d.ok||!d.sponsors?.length)return;
 $('#sponsors').innerHTML='<div class="section-title"><h3>スポンサー</h3><span>'+d.sponsors.length+'社</span></div><div class="sponsor-strip">'+d.sponsors.map(s=>'<div class="sponsor-card">'+(s.logo_media_ref?'<img src="'+esc(s.logo_media_ref)+'">':'<div class="sponsor-logo-fallback">S</div>')+'<span>'+esc(s.name)+'</span></div>').join('')+'</div>'
}
async function loadMine(id,e){const d=await nui('frame:getMySubmissions',{public_id:id});if(d.ok&&d.submissions?.length){const canDelete=e.status==='active'&&boolish(e.allow_submission_delete);$('#mineSubs').innerHTML='<h3>自分の応募</h3>'+d.submissions.map((x,i)=>'<div class="submission mine"><span class="badge">#'+(i+1)+'</span><img class="thumb" src="'+esc(x.media_ref)+'">'+(x.caption?'<p>'+esc(x.caption)+'</p>':'')+(canDelete?'<button class="danger-soft" data-delete-mine="'+esc(x.public_id)+'">この応募を削除</button>':'')+'</div>').join('');document.querySelectorAll('[data-delete-mine]').forEach(b=>b.onclick=async()=>{if(!confirm('この応募を削除しますか？'))return;const r=await nui('frame:deleteMySubmission',{public_id:id,submission_id:b.dataset.deleteMine});r.ok?detail(id):action(r)})}}
async function loadVoting(id){
 const d=await nui('frame:getVoteCandidates',{public_id:id});
 if(!d.ok){if(d.error==='VOTING_DISABLED')return;return}
 const rows=d.candidates||[];
 if(!rows.length){$('#voting').innerHTML='<div class="section-title"><h3>市民投票</h3><span>0作品</span></div><div class="empty">投票できる応募作品はまだありません。</div>';return}
 const closed=!d.can_vote;
 let h='<div class="section-title"><h3>市民投票</h3><span>'+(closed?'受付終了':'1人1票')+'</span></div>';
 h+='<div class="vote-grid">'+rows.map((r,i)=>{
   const selected=d.voted_submission_id===r.public_id;
   const count=d.show_counts?'<span class="vote-count">'+Number(r.vote_count||0)+'票</span>':'';
   let button='';
   if(!closed){
     if(r.own_submission)button='<button disabled class="vote-btn own">自分の作品</button>';
     else button='<button class="vote-btn '+(selected?'selected':'')+'" data-vote="'+esc(r.public_id)+'">'+(selected?'投票済み・取り消す':'この作品に投票')+'</button>';
   }
   return '<article class="vote-card '+(selected?'selected':'')+'"><div class="vote-image"><img src="'+esc(r.media_ref)+'"><span>#'+(i+1)+'</span></div><div class="vote-body">'+(r.caption?'<p>'+esc(r.caption)+'</p>':'<p class="muted">コメントなし</p>')+count+button+'</div></article>'
 }).join('')+'</div>';
 if(closed&&d.show_counts)h+='<div class="vote-summary">総投票数 '+Number(d.total_votes||0)+'票</div>';
 $('#voting').innerHTML=h;
 document.querySelectorAll('[data-vote]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await nui('frame:castVote',{public_id:id,submission_id:b.dataset.vote});if(r.ok)loadVoting(id);else{b.disabled=false;action(r)}})
}
async function loadResults(id){
 const [d,v]=await Promise.all([nui('frame:getResults',{public_id:id}),nui('frame:getVoteCandidates',{public_id:id})]);
 let out='';
 if(d.ok&&d.results?.length){
   const rows=d.results;
   const card=(r,i,hero=false)=>'<article class="award-result '+(hero?'award-result-hero':'')+'"><div class="award-result-media"><img src="'+esc(r.media_ref)+'"><span class="award-rank">'+(hero?'FEATURED AWARD':'AWARD '+(i+1))+'</span></div><div class="award-result-body">'+(r.sponsor_name?'<div class="presented">'+(r.sponsor_logo?'<img src="'+esc(r.sponsor_logo)+'">':'')+'<span>Presented by '+esc(r.sponsor_name)+'</span></div>':'')+'<span class="award-kicker">RESULT</span><h3>'+esc(r.award_name)+'</h3>'+(r.award_description?'<p>'+esc(r.award_description)+'</p>':'')+(r.prize_text?'<div class="award-prize">'+esc(r.prize_text)+'</div>':'')+(r.comment?'<blockquote>'+esc(r.comment)+'</blockquote>':'')+'</div></article>';
   out+='<div class="result-head"><span>OFFICIAL RESULTS</span><h2>受賞作品</h2><p>イベントの結果が発表されました。</p></div>'+rows.map((r,i)=>card(r,i,i===0)).join('');
 }
 if(v.ok&&v.show_counts&&v.candidates?.length){
   const ranked=[...v.candidates].sort((a,b)=>Number(b.vote_count||0)-Number(a.vote_count||0)).slice(0,3);
   out+='<div class="result-head vote-result-head"><span>PUBLIC VOTE</span><h2>市民投票ランキング</h2><p>FRAME内で集まった投票結果です。</p></div><div class="vote-ranking">'+ranked.map((r,i)=>'<div class="vote-rank-card"><span class="rank-no">'+(i+1)+'</span><img src="'+esc(r.media_ref)+'"><div><b>'+Number(r.vote_count||0)+'票</b>'+(r.caption?'<p>'+esc(r.caption)+'</p>':'')+'</div></div>').join('')+'</div>';
 }
 $('#results').innerHTML=out;
}
async function manage(id){
 const [ed,sd,ad,sp,vd,an,ac]=await Promise.all([nui('frame:getEvent',{public_id:id}),nui('frame:getEventSubmissions',{public_id:id}),nui('frame:getEventAwards',{public_id:id}),nui('frame:getSponsors',{public_id:id}),nui('frame:getVoteCandidates',{public_id:id}),nui('frame:getEventAnalytics',{public_id:id}),nui('frame:getEventActivity',{public_id:id})]);
 if(!ed.ok){view.innerHTML='<div class="empty">'+esc(errorText(ed.error))+'</div>';return}
 const e=ed.event,subs=sd.ok?(sd.submissions||[]):[],awards=ad.ok?(ad.awards||[]):[],sponsors=sp.ok?(sp.sponsors||[]):[],analytics=an.ok?(an.analytics||{}):{},activity=ac.ok?(ac.activity||[]):[],assignedAwards=awards.filter(x=>x.submission_id).length,unassignedAwards=Math.max(0,awards.length-assignedAwards);
 let submissionQuery='',submissionFilter='all',submissionSort='newest';
 const visibleSubmissions=()=>{
  const q=submissionQuery.trim().toLowerCase();
  let rows=subs.filter(s=>{
   const awarded=boolish(s.is_awarded);
   if(submissionFilter==='awarded'&&!awarded)return false;
   if(submissionFilter==='unawarded'&&awarded)return false;
   if(q&&!String((s.caption||'')+' '+(s.award_names||'')).toLowerCase().includes(q))return false;
   return true;
  }).slice();
  if(submissionSort==='oldest')rows.sort((a,b)=>(dateValue(a.submitted_at)?.getTime()||0)-(dateValue(b.submitted_at)?.getTime()||0));
  else if(submissionSort==='votes')rows.sort((a,b)=>Number(b.vote_count||0)-Number(a.vote_count||0)||(dateValue(b.submitted_at)?.getTime()||0)-(dateValue(a.submitted_at)?.getTime()||0));
  else if(submissionSort==='awarded')rows.sort((a,b)=>Number(boolish(b.is_awarded))-Number(boolish(a.is_awarded))||(dateValue(b.submitted_at)?.getTime()||0)-(dateValue(a.submitted_at)?.getTime()||0));
  else rows.sort((a,b)=>(dateValue(b.submitted_at)?.getTime()||0)-(dateValue(a.submitted_at)?.getTime()||0));
  return rows;
 };
 const submissionMarkup=rows=>rows.length?rows.map((s,i)=>{const awarded=boolish(s.is_awarded),awardNames=String(s.award_names||'');let x='<div class="submission '+(awarded?'awarded':'')+'"><div class="submission-head"><span class="badge">#'+(i+1)+'</span>'+(awarded?'<span class="winner-badge">受賞設定済み</span>':'')+'</div><img class="thumb" src="'+esc(s.media_ref)+'">'+(s.caption?'<p>'+esc(s.caption)+'</p>':'')+(awardNames?'<div class="submission-awards">'+esc(awardNames)+'</div>':'')+'<div class="submission-meta">'+(boolish(e.voting_enabled)?'<span>'+Number(s.vote_count||0)+'票</span>':'')+'<span>'+esc(fmtDate(s.submitted_at))+'</span></div><button data-save="'+esc(s.public_id)+'">Galleryへ保存</button>'+((e.status==='active'||e.status==='judging')&&!awarded?'<button class="danger-soft" data-delete-sub="'+esc(s.public_id)+'">応募を削除</button>':'');if(e.event_type==='contest'&&awards.length&&e.status==='judging')x+='<div class="winner-pick"><select data-award-select="'+esc(s.public_id)+'">'+awards.map(a=>'<option value="'+a.id+'">'+esc(a.name)+(a.submission_id?' ✓':'')+'</option>').join('')+'</select><button data-winner="'+esc(s.public_id)+'">この作品を受賞に設定</button></div>';return x+'</div>'}).join(''):'<div class="empty">条件に一致する応募作品はありません。</div>';
 let h='<button class="back">← 戻る</button><div class="section-title"><h2>応募作品・審査</h2><span>'+esc(statusLabel(e.status))+'</span></div>';
 h+='<div class="manage-summary"><b>'+esc(e.title)+'</b><span>応募 '+subs.length+'件'+(vd.ok?' / 投票 '+Number(vd.total_votes||0)+'票':'')+'</span></div>';if(an.ok)h+='<div class="analytics-panel"><div class="section-title"><h3>イベント分析</h3><span>LIVE</span></div><div class="analytics-grid"><div><b>'+Number(analytics.participants||0)+'</b><span>参加者</span></div><div><b>'+Number(analytics.submitters||0)+'</b><span>応募者</span></div><div><b>'+Number(analytics.conversion||0)+'%</b><span>参加→応募</span></div><div><b>'+Number(analytics.favorites||0)+'</b><span>保存</span></div><div><b>'+Number(analytics.votes||0)+'</b><span>投票</span></div><div><b>'+Number(analytics.notifications||0)+'</b><span>通知送信</span></div></div><div class="analytics-breakdown"><span>FRAME応募 <b>'+Number(analytics.frame_entries||0)+'</b></span><span>SNS応募 <b>'+Number(analytics.social_entries||0)+'</b></span><span>平均応募数 <b>'+Number(analytics.avg_submissions||0)+'</b></span></div></div>';
 if(activity.length)h+='<div class="activity-panel"><div class="section-title"><h3>操作履歴</h3><span>直近'+activity.length+'件</span></div><div class="activity-list">'+activity.map(x=>'<div class="activity-row"><div><b>'+esc(ACTION_LABELS[x.action]||x.action)+'</b><span>'+esc(x.actor_label||'主催メンバー')+'</span></div><small>'+esc(fmtDate(x.created_at))+'</small></div>').join('')+'</div></div>';
 h+='<div class="ops-panel"><div class="section-title"><h3>スポンサー</h3><span>'+sponsors.length+'社</span></div>';
 if(!['results','ended','cancelled'].includes(e.status))h+='<form id="sponsorForm" class="sponsor-form"><label>スポンサー名<input name="name" maxlength="120" placeholder="例：Weazel News" required></label><input type="hidden" name="logo_media_ref" id="sponsorLogo"><div class="sponsor-logo-row"><button type="button" id="pickSponsorLogo" class="secondary">ロゴを選択</button><div id="sponsorPreview" class="hint">任意</div></div><button class="primary">スポンサーを追加</button><p id="sponsorStatus"></p></form>';
 if(sponsors.length)h+='<div class="sponsor-admin-list">'+sponsors.map(s=>'<div class="sponsor-admin-row">'+(s.logo_media_ref?'<img src="'+esc(s.logo_media_ref)+'">':'<span class="sponsor-mini-fallback">S</span>')+'<b>'+esc(s.name)+'</b>'+(!['results','ended','cancelled'].includes(e.status)?'<button class="danger-soft" data-delete-sponsor="'+s.id+'">削除</button>':'')+'</div>').join('')+'</div>';
 h+='</div>';
 if(e.event_type==='contest'){
   if(e.status==='active')h+='<button id="beginJudging" class="primary wide-btn">審査を開始して投稿受付を終了</button>';
   if(e.status!=='results'&&e.status!=='ended'&&e.status!=='cancelled')h+='<form id="awardForm" class="award-form"><label>賞の名前<input name="name" maxlength="100" placeholder="例：グランプリ" required></label><label>賞品・説明<input name="prize_text" maxlength="2000" placeholder="例：賞金 $50,000"></label>'+(sponsors.length?'<label>スポンサー<select name="sponsor_id"><option value="">スポンサーなし</option>'+sponsors.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('')+'</select></label>':'')+'<button class="primary">賞を追加</button><p id="awardStatus"></p></form>';
   if(awards.length)h+='<div class="award-list"><div class="section-title"><h3>賞</h3><span>'+assignedAwards+' / '+awards.length+' 設定済み</span></div>'+awards.map(a=>'<div class="award-row '+(a.submission_id?'assigned':'pending')+'"><div><b>'+esc(a.name)+'</b>'+(a.sponsor_name?'<small>'+esc(a.sponsor_name)+' 提供</small>':'')+'</div><div class="award-state"><span>'+(a.submission_id?'受賞作品設定済み':'未設定')+'</span>'+(e.status==='judging'&&a.submission_id?'<button class="danger-soft" data-clear-award="'+a.id+'">解除</button>':'')+'</div></div>').join('')+'</div>';
   if(e.status==='judging'){h+='<div class="judging-progress '+(unassignedAwards===0&&awards.length>0?'ready':'pending')+'"><b>'+(awards.length===0?'賞を作成してください':unassignedAwards===0?'結果公開の準備完了':'未設定の賞 '+unassignedAwards+'件')+'</b><span>'+(awards.length===0?'結果公開には賞が1件以上必要です。':unassignedAwards===0?'すべての賞に受賞作品が設定されています。':'すべての賞に受賞作品を設定すると結果を公開できます。')+'</span></div>';if(boolish(e.voting_enabled)&&vd.ok&&Number(vd.total_votes||0)>0)h+='<button id="applyVoteAward" class="secondary wide-btn">市民投票1位を「市民投票賞」に設定</button>';h+='<button id="publishResults" class="primary wide-btn"'+((awards.length<1||unassignedAwards>0)?' disabled':'')+'>結果を公開</button>';}
 }
 h+='<div class="section-title"><h3>応募作品</h3><span id="submissionCount">'+subs.length+'件</span></div>';
 h+='<div class="submission-tools"><input id="submissionSearch" placeholder="コメント・賞名で検索"><select id="submissionFilter"><option value="all">すべて</option><option value="unawarded">未受賞のみ</option><option value="awarded">受賞設定済み</option></select><select id="submissionSort"><option value="newest">新しい順</option><option value="oldest">古い順</option>'+(boolish(e.voting_enabled)?'<option value="votes">得票数順</option>':'')+'<option value="awarded">受賞設定優先</option></select><button id="bulkSaveVisible" class="secondary">表示中をGalleryへ保存</button><span id="bulkSaveStatus" class="hint"></span></div>';
 h+='<div id="submissionList">'+submissionMarkup(visibleSubmissions())+'</div>';
 view.innerHTML=h;$('.back').onclick=()=>detail(id);
 if($('#pickSponsorLogo'))$('#pickSponsorLogo').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){$('#sponsorLogo').value=m.media.src;$('#sponsorPreview').innerHTML='<img class="sponsor-preview" src="'+esc(m.media.src)+'">'}};
 if($('#sponsorForm'))$('#sponsorForm').onsubmit=async ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(ev.currentTarget));o.public_id=id;const r=await nui('frame:addSponsor',o);r.ok?manage(id):$('#sponsorStatus').textContent=errorText(r.error)};
 document.querySelectorAll('[data-delete-sponsor]').forEach(b=>b.onclick=async()=>{if(!confirm('このスポンサーを削除しますか？'))return;const r=await nui('frame:deleteSponsor',{public_id:id,sponsor_id:Number(b.dataset.deleteSponsor)});r.ok?manage(id):b.textContent=errorText(r.error)});
 const bindSubmissionRows=()=>{
  document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await nui('frame:saveSubmission',{public_id:id,submission_id:b.dataset.save});b.textContent=r.ok?'保存しました':errorText(r.error);b.disabled=false});
  document.querySelectorAll('[data-delete-sub]').forEach(b=>b.onclick=async()=>{if(!confirm('この応募作品を削除しますか？'))return;const r=await nui('frame:deleteSubmission',{public_id:id,submission_id:b.dataset.deleteSub});r.ok?manage(id):b.textContent=errorText(r.error)});
  document.querySelectorAll('[data-winner]').forEach(b=>b.onclick=async()=>{const sid=b.dataset.winner,sel=document.querySelector('[data-award-select="'+CSS.escape(sid)+'"]');const r=await nui('frame:setWinner',{public_id:id,submission_id:sid,award_id:Number(sel.value)});if(r.ok)manage(id);else b.textContent=errorText(r.error)});
 };
 const renderSubmissionList=()=>{const rows=visibleSubmissions();$('#submissionCount').textContent=rows.length+' / '+subs.length+'件';$('#submissionList').innerHTML=submissionMarkup(rows);bindSubmissionRows()};
 $('#submissionSearch').oninput=e2=>{submissionQuery=e2.target.value;renderSubmissionList()};
 $('#submissionFilter').onchange=e2=>{submissionFilter=e2.target.value;renderSubmissionList()};
 $('#submissionSort').onchange=e2=>{submissionSort=e2.target.value;renderSubmissionList()};
 $('#bulkSaveVisible').onclick=async()=>{const rows=visibleSubmissions();if(!rows.length)return;if(rows.length>5&&!confirm('表示中の応募 '+rows.length+'件をGalleryへ保存しますか？\n\n件数が多い場合、保存に少し時間がかかります。'))return;const btn=$('#bulkSaveVisible'),status=$('#bulkSaveStatus');btn.disabled=true;let ok=0,failed=0;for(let i=0;i<rows.length;i++){status.textContent=(i+1)+' / '+rows.length+' 保存中';const r=await nui('frame:saveSubmission',{public_id:id,submission_id:rows[i].public_id});if(r.ok)ok++;else failed++}status.textContent='保存 '+ok+'件'+(failed?' / 失敗 '+failed+'件':'');btn.disabled=false};
 bindSubmissionRows();
 if($('#beginJudging'))$('#beginJudging').onclick=async()=>{const r=await nui('frame:beginJudging',{public_id:id});if(r.ok)manage(id);else $('#awardStatus').textContent=errorText(r.error)};
 if($('#awardForm'))$('#awardForm').onsubmit=async ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(ev.currentTarget));o.public_id=id;if(o.sponsor_id)o.sponsor_id=Number(o.sponsor_id);else delete o.sponsor_id;const r=await nui('frame:addAward',o);if(r.ok)manage(id);else $('#awardStatus').textContent=errorText(r.error)};

 document.querySelectorAll('[data-clear-award]').forEach(b=>b.onclick=async()=>{if(!confirm('この賞の受賞設定を解除しますか？'))return;const r=await nui('frame:clearWinner',{public_id:id,award_id:Number(b.dataset.clearAward)});if(r.ok)manage(id);else b.textContent=errorText(r.error)});
 if($('#applyVoteAward'))$('#applyVoteAward').onclick=async()=>{const r=await nui('frame:applyPublicVoteAward',{public_id:id});if(r.ok)manage(id);else action(r)};if($('#publishResults'))$('#publishResults').onclick=async()=>{if($('#publishResults').disabled)return;if(!confirm('結果を公開しますか？\n\n公開後は受賞設定を変更できません。'))return;const r=await nui('frame:publishResults',{public_id:id});if(r.ok)detail(id);else $('#awardStatus').textContent=errorText(r.error)}
}
async function ads(){
 const [pd,md,evd]=await Promise.all([nui('frame:getAdProducts'),nui('frame:getMyAds'),nui('frame:getMyEvents')]);
 const products=pd.ok?(pd.products||[]):[],myAds=md.ok?(md.ads||[]):[],events=evd.ok?(evd.events||[]):[];
 const statusLabelAd=s=>AD_STATUS[s]||s||'-',placementLabel=s=>AD_PLACEMENTS[s]||s||'-';
 const adRows=myAds.length?myAds.map(a=>{
  const impressions=Number(a.impressions||0),clicks=Number(a.clicks||0),ctr=impressions>0?Math.round((clicks/impressions)*1000)/10:0;
  return '<article class="my-ad-card"><img src="'+esc(a.media_ref)+'"><div class="my-ad-body"><div class="ad-card-head"><span class="ad-status ad-'+esc(a.status)+'">'+esc(statusLabelAd(a.status))+'</span><small>'+esc(placementLabel(a.placement))+'</small></div><b>'+esc(a.title||a.product_name)+'</b><p>'+esc(a.advertiser_name||'')+'</p>'+(a.event_title?'<span class="ad-link-event">→ '+esc(a.event_title)+'</span>':'')+'<dl><dt>期間</dt><dd>'+esc(fmtDate(a.starts_at))+' → '+esc(fmtDate(a.ends_at))+'</dd><dt>表示</dt><dd>'+impressions+'回</dd><dt>クリック</dt><dd>'+clicks+'回 / CTR '+ctr+'%</dd></dl>'+(a.review_reason?'<div class="ad-review-reason"><b>審査・停止理由</b><span>'+esc(a.review_reason)+'</span></div>':'')+(a.status==='pending_review'?'<button class="danger-soft ad-withdraw" data-withdraw-ad="'+esc(a.public_id)+'">申請を取り消す</button>':'')+'</div></article>';
 }).join(''):'<div class="empty">広告申請はまだありません。</div>';

 let h='<div class="page-head"><span>PROMOTION</span><h2>広告</h2><p>広告を申請し、審査状況・掲載期間・実績を確認できます。</p></div>';
 h+='<div class="section-title"><h3>広告を申請</h3><span>審査後に掲載</span></div><form id="adForm" class="panel-form">';
 h+='<label>掲載枠<select name="product_code" id="adProduct">'+products.map(x=>'<option value="'+esc(x.code)+'" data-placement="'+esc(x.placement)+'" data-duration="'+Number(x.duration_hours||0)+'">'+esc(x.name)+' · '+esc(placementLabel(x.placement))+(Number(x.base_price||0)>0?' · $'+Number(x.base_price):' · 無料')+'</option>').join('')+'</select><span id="adProductHint" class="hint"></span></label>';
 h+='<label>広告主名<input name="advertiser_name" maxlength="120" required placeholder="企業名・個人名"></label>';
 h+='<label>広告タイトル<input name="title" maxlength="160" required placeholder="広告に表示するタイトル"></label>';
 h+='<label>広告画像<input type="hidden" name="media_ref" id="adMedia"><button type="button" id="pickAdImage" class="secondary wide-btn">Galleryから広告画像を選択</button><div id="adPreview"><span class="hint">画像を選択してください。</span></div></label>';
 h+='<label>紐付けるイベント<select name="event_public_id" id="adEvent"><option value="">紐付けなし</option>'+events.map(e=>'<option value="'+esc(e.public_id)+'">'+esc(e.title)+'</option>').join('')+'</select><span id="adEventHint" class="hint">Featured / Top / Category はイベント指定が必要です。</span></label>';
 h+='<label>掲載開始<input type="datetime-local" name="starts_at" id="adStarts" required></label>';
 h+='<label>掲載終了<input type="datetime-local" name="ends_at" id="adEnds" required></label>';
 h+='<div class="ad-application-note">申請後は審査待ちになります。承認されると指定日時から自動掲載され、終了日時に自動で掲載終了します。</div>';
 h+='<button class="primary">広告を申請</button><p id="adStatus"></p></form>';
 h+='<div class="section-title"><h3>自分の広告</h3><span>'+myAds.length+'件</span></div><div class="my-ads">'+adRows+'</div>';
 view.innerHTML=h;
 document.querySelectorAll('#adForm>label').forEach(x=>x.classList.add('field-card'));

 const productInfo=()=>products.find(x=>x.code===$('#adProduct').value)||null;
 const localValue=d=>{const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
 const updateProduct=()=>{
  const p=productInfo(),hours=Number(p?.duration_hours||0),placement=p?.placement||'';
  $('#adProductHint').textContent=hours>0?'掲載期間: '+hours+'時間（'+Math.round(hours/24*10)/10+'日）':'掲載終了日時を指定してください。';
  const needsEvent=['featured','top_placement','category_banner'].includes(placement);
  $('#adEvent').required=needsEvent;
  $('#adEventHint').textContent=needsEvent?'この掲載枠はイベント指定が必須です。':'イベントにリンクする場合だけ指定してください。';
  $('#adEnds').readOnly=hours>0;
  if(hours>0&&$('#adStarts').value){const d=new Date($('#adStarts').value);d.setHours(d.getHours()+hours);$('#adEnds').value=localValue(d)}
 };
 const now=new Date(Date.now()+5*60000);now.setSeconds(0,0);$('#adStarts').value=localValue(now);updateProduct();
 $('#adProduct').onchange=updateProduct;$('#adStarts').onchange=updateProduct;
 $('#pickAdImage').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){$('#adMedia').value=m.media.src;$('#adPreview').innerHTML='<img class="cover-preview" src="'+esc(m.media.src)+'">'}};
 $('#adForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.currentTarget));if(!o.media_ref){$('#adStatus').textContent='広告画像を選択してください。';return}const p=productInfo();if(['featured','top_placement','category_banner'].includes(p?.placement)&&!o.event_public_id){$('#adStatus').textContent=errorText('AD_EVENT_REQUIRED');return}utcDates(o);const d=await nui('frame:createAd',o);if(d.ok){$('#adStatus').textContent='申請しました。審査待ちです。';setTimeout(ads,500)}else $('#adStatus').textContent=errorText(d.error)};
 document.querySelectorAll('[data-withdraw-ad]').forEach(b=>b.onclick=async()=>{if(!confirm('この広告申請を取り消しますか？'))return;b.disabled=true;const r=await nui('frame:withdrawAd',{public_id:b.dataset.withdrawAd});if(r.ok)ads();else{b.disabled=false;b.textContent=errorText(r.error)}})
}

async function staff(){
 const d=await nui('frame:getStaffDashboard');if(!d.ok){view.innerHTML='<div class="empty">'+esc(errorText(d.error))+'</div>';return}
 const s=d.stats||{},events=d.events||[],audit=d.audit||[];
 let h='<div class="page-head"><span>WEAZEL / STAFF</span><h2>Staff Console</h2><p>イベント・広告・監査ログを一元管理します。</p></div><div class="stats-grid"><div><b>'+Number(s.events||0)+'</b><span>イベント</span></div><div><b>'+Number(s.active||0)+'</b><span>開催中</span></div><div><b>'+Number(s.submissions||0)+'</b><span>応募</span></div><div><b>'+Number(s.pending_ads||0)+'</b><span>広告審査待ち</span></div></div>';
 h+='<div class="staff-filter"><input id="staffSearch" placeholder="イベント名・主催者を検索"><select id="staffStatus"><option value="">すべての状態</option>'+Object.entries(STATUS).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></div><div class="section-title"><h3>イベント監視</h3><span id="staffEventCount"></span></div><div id="staffEvents"></div>';
 h+='<div class="section-title"><h3>広告審査</h3><span>'+Number(s.pending_ads||0)+'件待ち</span></div>'+(d.ads||[]).map(a=>'<div class="staffrow"><b>'+esc(a.product_name)+' / '+esc(a.advertiser_name)+'</b><p>'+esc(a.status)+' · '+a.price_snapshot+'</p>'+(a.status==='pending_review'?'<button data-approve="'+esc(a.public_id)+'">承認</button> <button data-reject="'+esc(a.public_id)+'">却下</button>':'')+'</div>').join('');
 h+='<div class="section-title"><h3>監査ログ</h3><span>直近'+audit.length+'件</span></div><div class="audit-list">'+audit.map(a=>'<div class="audit-row"><b>'+esc(a.action)+'</b><span>'+esc(a.entity_type)+(a.entity_id?' / '+esc(a.entity_id):'')+'</span><small>'+esc(fmtDate(a.created_at))+'</small></div>').join('')+'</div>';
 view.innerHTML=h;
 const render=()=>{const q=$('#staffSearch').value.trim().toLowerCase(),st=$('#staffStatus').value;const rows=events.filter(e=>(!q||String(e.title+' '+e.organizer_name).toLowerCase().includes(q))&&(!st||e.status===st));$('#staffEventCount').textContent=rows.length+'件';$('#staffEvents').innerHTML=rows.map(e=>'<div class="staff-event-card"><button class="staff-event-main" data-staff-event="'+esc(e.public_id)+'"><span><b>'+esc(e.title)+'</b><small>'+esc(e.organizer_name)+' · '+esc(statusLabel(e.status))+'</small></span><em>'+Number(e.participant_count||0)+'人 / '+Number(e.submission_count||0)+'件</em></button>'+(['draft','scheduled','active','judging'].includes(e.status)?'<button class="danger-soft staff-stop" data-staff-stop="'+esc(e.public_id)+'">停止</button>':'')+'<button class="danger-soft staff-delete" data-staff-delete="'+esc(e.public_id)+'">削除</button></div>').join('');document.querySelectorAll('[data-staff-event]').forEach(b=>b.onclick=()=>detail(b.dataset.staffEvent));document.querySelectorAll('[data-staff-stop]').forEach(b=>b.onclick=async()=>{if(!confirm('このイベントを中止しますか？'))return;const r=await nui('frame:cancelEvent',{public_id:b.dataset.staffStop});if(r.ok)staff();else b.textContent=errorText(r.error)});document.querySelectorAll('[data-staff-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('運営権限でこのイベントを完全に削除しますか？\n\n開催中の場合も中止して削除され、元に戻せません。'))return;const r=await nui('frame:deleteEvent',{public_id:b.dataset.staffDelete,force:true});if(r.ok)staff();else b.textContent=errorText(r.error)})};
 $('#staffSearch').oninput=render;$('#staffStatus').onchange=render;render();
 document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{await nui('frame:reviewAd',{public_id:b.dataset.approve,decision:'approve'});staff()});document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{await nui('frame:reviewAd',{public_id:b.dataset.reject,decision:'reject'});staff()})
}
const views={home,mine,create,ads,staff};
function activateNav(name){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name))}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(!appReady&&b.dataset.view!=='home')return home();activateNav(b.dataset.view);views[b.dataset.view]?.()});
$('#themeToggle').onclick=()=>{const m=$('#themeMenu');m.hidden=!m.hidden;applyTheme(getTheme(),false)};
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice,true);closeThemeMenu()});
document.addEventListener('click',e=>{const m=$('#themeMenu');if(!m||m.hidden)return;if(!m.contains(e.target)&&e.target!==$('#themeToggle'))closeThemeMenu()});
$('#refresh').onclick=()=>{activateNav('home');home()};activateNav('home');applyTheme(getTheme(),false);home();
