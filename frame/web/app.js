const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function nui(ev,data={}){try{const r=await fetch(`https://${(typeof GetParentResourceName==='function'?GetParentResourceName():(globalThis.resourceName||'frame'))}/${ev}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return await r.json()}catch{return {ok:false,error:'NUI_ERROR'}}}
const view=$('#view');let viewer={},appReady=false,playerRetryTimer=null;
function utcDates(o){for(const k of ['starts_at','submissions_open_at','submissions_close_at','judging_starts_at','results_at','ends_at'])if(o[k])o[k]=new Date(o[k]).toISOString().slice(0,19).replace('T',' ');return o}
const ERRORS={
 PLAYER_NOT_READY:'キャラクター情報を取得できません。',NOT_FOUND:'対象が見つかりません。',DATABASE_ERROR:'データベース処理に失敗しました。',
 FORBIDDEN:'この操作を行う権限がありません。',SUBMISSIONS_DISABLED:'このイベントは写真投稿を受け付けていません。',
 EVENT_NOT_ACTIVE:'イベント開催中のみ操作できます。',SUBMISSIONS_CLOSED:'投稿受付期間外です。',JOIN_REQUIRED:'先にイベントへ参加してください。',
 SUBMISSION_LIMIT_REACHED:'投稿上限に達しています。',INVALID_MEDIA:'画像を取得できませんでした。',NOT_OWNER_OR_NOT_DRAFT:'下書きの主催イベントだけ公開できます。',
 EDIT_DRAFT_ONLY:'編集できるのは下書き中だけです。',EVENT_ALREADY_CLOSED:'このイベントはすでに終了しています。',
 ACCESS_RULE_REQUIRED:'このイベントには参加条件があります。',NO_SUBMISSIONS:'応募作品がまだありません。',NO_RESULTS:'受賞作品を1件以上設定してください。',
 NOT_JUDGING:'審査中ではありません。',NOT_CONTEST:'コンテスト形式のイベントではありません。',INVALID_AWARD:'賞が見つかりません。',
 INVALID_SUBMISSION:'応募作品が見つかりません。',NAME_REQUIRED:'賞の名前を入力してください。',STATE_CHANGED:'状態が更新されています。画面を再読み込みしてください。',
 PHONE_CALLBACK_FAILED:'LB Phoneとの通信に失敗しました。',CALLBACK_FAILED:'処理に失敗しました。',NUI_ERROR:'アプリ通信に失敗しました。'
};
const STATUS={draft:'下書き',scheduled:'公開予定',active:'開催中',judging:'審査中',results:'結果発表',ended:'終了',cancelled:'中止'};
const TYPES={contest:'フォトコンテスト',mission:'フォトミッション',collection:'フォトコレクション',memorial:'メモリアル / アルバム'};
function errorText(code){return ERRORS[code]||String(code||'不明なエラーです。')}
function statusLabel(v){return STATUS[v]||v||'-'}
function typeLabel(v){return TYPES[v]||v||'-'}
function boolish(v){return v===true||Number(v)===1}
function fmtDate(v){if(!v)return '';const s=String(v);const d=new Date(s.includes('T')?s:(s.replace(' ','T')+'Z'));if(Number.isNaN(d.getTime()))return esc(s);return d.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function inputDate(v){if(!v)return '';const s=String(v);const d=new Date(s.includes('T')?s:(s.replace(' ','T')+'Z'));if(Number.isNaN(d.getTime()))return s.replace(' ','T').slice(0,16);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}
function option(value,label,current){return '<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(label)+'</option>'}
function cards(a,owned=false){return a?.length?a.map(e=>'<article class="card" data-id="'+esc(e.public_id)+'"><div class="meta">'+esc(typeLabel(e.event_type))+' · '+esc(statusLabel(e.status))+'</div><h3>'+esc(e.title)+'</h3>'+(e.description?'<p>'+esc(e.description)+'</p>':'')+(e.starts_at?'<small>'+esc(fmtDate(e.starts_at))+'</small>':'')+(owned?'<small>あなたが主催</small>':'')+'</article>').join(''):'<div class="empty">まだありません。</div>'}
async function banners(){const d=await nui('frame:getActiveAds');if(!d.ok)return '';return (d.ads||[]).filter(x=>x.placement==='home_banner').slice(0,2).map(x=>`<div class="banner" data-ad="${esc(x.public_id)}" data-link="${esc(x.link_value||'')}"><img src="${esc(x.media_ref)}"><span>${esc(x.title||'Sponsored')}</span></div>`).join('')}
async function home(){clearTimeout(playerRetryTimer);const d=await nui('frame:getInitialData');if(!d.ok&&d.error==='PLAYER_NOT_READY'){appReady=false;viewer={};$('#staffNav').hidden=true;view.innerHTML=`<section id="hero"><p>FRAME</p><strong>キャラクター選択を待っています。</strong></section><div class="empty">キャラクターを選択すると自動で読み込みます。</div>`;playerRetryTimer=setTimeout(home,1500);return}appReady=!!d.ok;viewer=d.viewer||{};$('#staffNav').hidden=!viewer.staff;view.innerHTML=`${await banners()}<section id="hero"><p>${esc(viewer.name||'Flecity')}さん</p><strong>見つける。撮る。参加する。</strong></section><h2>イベント</h2>${d.ok?cards(d.events):`<div class="empty">読み込みに失敗しました。<br>${esc(d.error||'UNKNOWN')}</div>`}`;bindCards();document.querySelectorAll('.banner').forEach(async b=>{await nui('frame:adImpression',{public_id:b.dataset.ad});b.onclick=async()=>{await nui('frame:adClick',{public_id:b.dataset.ad});if(b.dataset.link)detail(b.dataset.link)}})}
async function mine(){const d=await nui('frame:getMyEvents');view.innerHTML=`<h2>主催イベント</h2>${d.ok?cards(d.events,true):esc(d.error)}`;bindCards()}
function create(){renderEventForm(null)}
async function editEvent(id){const d=await nui('frame:getEvent',{public_id:id});if(!d.ok)return action(d);renderEventForm(d.event)}
function renderEventForm(e){
 const editing=!!e;
 let h='<h2>'+(editing?'イベント編集':'イベント作成')+'</h2><form id="eventForm">';
 h+='<label>イベント名<input name="title" maxlength="160" required value="'+esc(e?.title||'')+'"></label>';
 h+='<label>説明<textarea name="description" maxlength="8000" required>'+esc(e?.description||'')+'</textarea></label>';
 h+='<label>カバー画像<input type="hidden" name="cover_media_ref" id="coverMedia" value="'+esc(e?.cover_media_ref||'')+'"><button type="button" id="pickCover" class="secondary wide-btn">Galleryからカバー画像を選択</button><div id="coverPreview">'+(e?.cover_media_ref?'<img class="cover-preview" src="'+esc(e.cover_media_ref)+'">':'<span class="hint">未設定</span>')+'</div></label>';
 h+='<label>タイプ<select name="event_type">'+option('contest','Photo Contest',e?.event_type||'contest')+option('mission','Photo Mission',e?.event_type)+option('collection','Photo Collection',e?.event_type)+option('memorial','Memorial / Album',e?.event_type)+'</select></label>';
 h+='<label>公開範囲<select name="visibility">'+option('public','公開',e?.visibility||'public')+option('unlisted','限定リンク',e?.visibility)+option('private','招待制',e?.visibility)+option('restricted','条件付き',e?.visibility)+'</select></label>';
 h+='<label>投稿上限<input type="number" name="max_submissions" min="1" max="50" value="'+esc(e?.max_submissions||1)+'"></label>';
 h+='<label>開始日時<input type="datetime-local" name="starts_at" value="'+esc(inputDate(e?.starts_at))+'"></label>';
 h+='<label>投稿開始<input type="datetime-local" name="submissions_open_at" value="'+esc(inputDate(e?.submissions_open_at))+'"></label>';
 h+='<label>投稿締切<input type="datetime-local" name="submissions_close_at" value="'+esc(inputDate(e?.submissions_close_at))+'"></label>';
 h+='<label>結果発表<input type="datetime-local" name="results_at" value="'+esc(inputDate(e?.results_at))+'"></label>';
 h+='<label>終了日時<input type="datetime-local" name="ends_at" value="'+esc(inputDate(e?.ends_at))+'"></label>';
 h+='<button class="primary">'+(editing?'変更を保存':'下書きを作成')+'</button><p id="formStatus"></p></form>';
 view.innerHTML=h;
 $('#pickCover').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){$('#coverMedia').value=m.media.src;$('#coverPreview').innerHTML='<img class="cover-preview" src="'+esc(m.media.src)+'">'}};
 $('#eventForm').onsubmit=async ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(ev.currentTarget));o.max_submissions=+o.max_submissions;o.participation_required=true;o.submission_enabled=true;o.allow_submission_delete=true;o.allow_submission_edit=false;if(editing)o.public_id=e.public_id;utcDates(o);const d=await nui(editing?'frame:updateEvent':'frame:createEvent',o);$('#formStatus').textContent=d.ok?(editing?'保存しました':'作成しました'):errorText(d.error);if(d.ok)setTimeout(()=>editing?detail(e.public_id):mine(),250)}
}
function bindCards(){document.querySelectorAll('.card[data-id]').forEach(x=>x.onclick=()=>detail(x.dataset.id))}
async function detail(id){
 const d=await nui('frame:getEvent',{public_id:id});if(!d.ok){view.innerHTML='<div class="empty">'+esc(errorText(d.error))+'</div>';return}
 const e=d.event,max=Number(e.max_submissions||1),used=Number(d.own_submission_count||0),remaining=Math.max(0,max-used);
 let controls='',dates='';
 if(e.starts_at)dates+='<dt>開始</dt><dd>'+esc(fmtDate(e.starts_at))+'</dd>';
 if(e.submissions_close_at)dates+='<dt>投稿締切</dt><dd>'+esc(fmtDate(e.submissions_close_at))+'</dd>';
 if(e.results_at)dates+='<dt>結果発表</dt><dd>'+esc(fmtDate(e.results_at))+'</dd>';
 if(e.ends_at)dates+='<dt>終了</dt><dd>'+esc(fmtDate(e.ends_at))+'</dd>';
 if(d.is_owner&&e.status==='draft')controls+='<button id="editEvent">編集</button><button id="publish" class="primary">イベントを公開</button>';
 if(e.status==='active'){
   controls+=d.joined?'<button disabled class="done">参加済み</button>':'<button id="join">参加する</button>';
   if(boolish(e.submission_enabled)){
     if(!d.joined)controls+='<div class="hint">参加後に写真を投稿できます。</div>';
     else if(remaining>0)controls+='<button id="gallery">Galleryから投稿</button><button id="camera">撮影して投稿</button><div class="hint">あと '+remaining+' 枚投稿できます。</div>';
     else controls+='<div class="hint">投稿上限の '+max+' 枚に達しています。</div>';
   }else controls+='<div class="hint">このイベントは写真投稿を受け付けていません。</div>';
 }else if(e.status==='scheduled')controls+='<div class="hint">開始時刻になると参加・投稿できます。</div>';
 else if(e.status==='judging')controls+='<div class="hint">現在、審査中です。</div>';
 else if(e.status==='results')controls+='<div class="hint">結果が発表されています。</div>';
 else if(e.status==='cancelled')controls+='<div class="hint">このイベントは中止されました。</div>';
 if(d.can_manage)controls+='<button id="manage">応募作品・審査を管理</button>';
 if(d.can_manage&&!['ended','cancelled'].includes(e.status))controls+='<button id="cancelEvent" class="danger-soft">イベントを中止</button>';
 view.innerHTML='<button class="back">← 戻る</button><article class="detail">'+(e.cover_media_ref?'<img class="cover" src="'+esc(e.cover_media_ref)+'">':'')+'<div class="meta">'+esc(typeLabel(e.event_type))+' · '+esc(statusLabel(e.status))+'</div><h2>'+esc(e.title)+'</h2><p>'+esc(e.description)+'</p><dl><dt>主催</dt><dd>'+esc(e.organizer_name)+'</dd><dt>参加者</dt><dd>'+Number(d.participant_count||0)+'人</dd><dt>応募作品</dt><dd>'+Number(d.submission_count||0)+'件</dd><dt>投稿上限</dt><dd>'+max+'枚</dd>'+dates+'</dl><div class="actions">'+controls+'</div><p id="actionStatus"></p><div id="mineSubs"></div><div id="results"></div></article>';
 $('.back').onclick=home;
 if($('#editEvent'))$('#editEvent').onclick=()=>editEvent(id);
 if($('#publish'))$('#publish').onclick=async()=>{const r=await nui('frame:publishEvent',{public_id:id});if(r?.ok)detail(id);else action(r)};
 if($('#join'))$('#join').onclick=async()=>{const r=await nui('frame:joinEvent',{public_id:id});if(r?.ok)detail(id);else action(r)};
 if($('#gallery'))$('#gallery').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){const r=await nui('frame:submitPhoto',{public_id:id,media_ref:m.media.src,caption:''});if(r?.ok)detail(id);else action(r)}};
 if($('#camera'))$('#camera').onclick=async()=>{const m=await nui('frame:takePhoto');if(m?.url){const r=await nui('frame:submitPhoto',{public_id:id,media_ref:m.url,caption:''});if(r?.ok)detail(id);else action(r)}};
 if($('#manage'))$('#manage').onclick=()=>manage(id);
 if($('#cancelEvent'))$('#cancelEvent').onclick=async()=>{if(!confirm('このイベントを中止しますか？'))return;const r=await nui('frame:cancelEvent',{public_id:id});if(r?.ok)detail(id);else action(r)};
 loadMine(id);loadResults(id)
}
function action(d){const el=$('#actionStatus');if(el)el.textContent=d?.ok?'完了しました':errorText(d?.error)}
async function loadMine(id){const d=await nui('frame:getMySubmissions',{public_id:id});if(d.ok&&d.submissions?.length){$('#mineSubs').innerHTML='<h3>自分の投稿</h3>'+d.submissions.map((x,i)=>'<div class="submission mine"><span class="badge">#'+(i+1)+'</span><img class="thumb" src="'+esc(x.media_ref)+'">'+(x.caption?'<p>'+esc(x.caption)+'</p>':'')+'</div>').join('')}}
async function loadResults(id){const d=await nui('frame:getResults',{public_id:id});if(d.ok&&d.results?.length)$('#results').innerHTML='<h3>結果</h3>'+d.results.map(r=>'<div class="submission result"><b>'+esc(r.award_name)+'</b><img class="thumb" src="'+esc(r.media_ref)+'">'+(r.prize_text?'<p>'+esc(r.prize_text)+'</p>':'')+(r.comment?'<p>'+esc(r.comment)+'</p>':'')+'</div>').join('')}
async function manage(id){
 const [ed,sd,ad]=await Promise.all([nui('frame:getEvent',{public_id:id}),nui('frame:getEventSubmissions',{public_id:id}),nui('frame:getEventAwards',{public_id:id})]);
 if(!ed.ok){view.innerHTML='<div class="empty">'+esc(errorText(ed.error))+'</div>';return}
 const e=ed.event,subs=sd.ok?(sd.submissions||[]):[],awards=ad.ok?(ad.awards||[]):[];
 let h='<button class="back">← 戻る</button><div class="section-title"><h2>応募作品・審査</h2><span>'+esc(statusLabel(e.status))+'</span></div>';
 h+='<div class="manage-summary"><b>'+esc(e.title)+'</b><span>応募 '+subs.length+'件</span></div>';
 if(e.event_type==='contest'){
   if(e.status==='active')h+='<button id="beginJudging" class="primary wide-btn">審査を開始して投稿受付を終了</button>';
   h+='<form id="awardForm" class="award-form"><label>賞の名前<input name="name" maxlength="100" placeholder="例：グランプリ" required></label><label>賞品・説明<input name="prize_text" maxlength="2000" placeholder="例：賞金 $50,000"></label><button class="primary">賞を追加</button><p id="awardStatus"></p></form>';
   if(awards.length)h+='<div class="award-list"><h3>賞</h3>'+awards.map(a=>'<div class="award-row"><b>'+esc(a.name)+'</b><span>'+(a.submission_id?'受賞作品設定済み':'未設定')+'</span></div>').join('')+'</div>';
   if(e.status==='judging')h+='<button id="publishResults" class="primary wide-btn">結果を公開</button>';
 }
 h+='<h3>応募作品</h3>';
 h+=subs.length?subs.map((s,i)=>{let x='<div class="submission"><span class="badge">#'+(i+1)+'</span><img class="thumb" src="'+esc(s.media_ref)+'">'+(s.caption?'<p>'+esc(s.caption)+'</p>':'')+'<button data-save="'+esc(s.public_id)+'">Galleryへ保存</button>';if(e.event_type==='contest'&&awards.length&&(e.status==='judging'||e.status==='results'))x+='<div class="winner-pick"><select data-award-select="'+esc(s.public_id)+'">'+awards.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('')+'</select><button data-winner="'+esc(s.public_id)+'">この作品を受賞に設定</button></div>';return x+'</div>'}).join(''):'<div class="empty">応募作品はまだありません。</div>';
 view.innerHTML=h;$('.back').onclick=()=>detail(id);
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const r=await nui('frame:saveSubmission',{public_id:id,submission_id:b.dataset.save});b.textContent=r.ok?'保存しました':errorText(r.error)});
 if($('#beginJudging'))$('#beginJudging').onclick=async()=>{const r=await nui('frame:beginJudging',{public_id:id});if(r.ok)manage(id);else $('#awardStatus').textContent=errorText(r.error)};
 if($('#awardForm'))$('#awardForm').onsubmit=async ev=>{ev.preventDefault();const o=Object.fromEntries(new FormData(ev.currentTarget));o.public_id=id;const r=await nui('frame:addAward',o);if(r.ok)manage(id);else $('#awardStatus').textContent=errorText(r.error)};
 document.querySelectorAll('[data-winner]').forEach(b=>b.onclick=async()=>{const sid=b.dataset.winner,sel=document.querySelector('[data-award-select="'+CSS.escape(sid)+'"]');const r=await nui('frame:setWinner',{public_id:id,submission_id:sid,award_id:Number(sel.value)});if(r.ok)manage(id);else b.textContent=errorText(r.error)});
 if($('#publishResults'))$('#publishResults').onclick=async()=>{const r=await nui('frame:publishResults',{public_id:id});if(r.ok)detail(id);else $('#awardStatus').textContent=errorText(r.error)}
}
async function ads(){const p=await nui('frame:getAdProducts');let h='<h2>広告を作成</h2><form id="adForm"><label>商品<select name="product_code">'+(p.products||[]).map(x=>'<option value="'+esc(x.code)+'">'+esc(x.name)+' ('+x.base_price+')</option>').join('')+'</select></label><label>広告主名<input name="advertiser_name" required></label><label>タイトル<input name="title"></label><label>広告画像<input type="hidden" name="media_ref" id="adMedia"><button type="button" id="pickAdImage" class="secondary wide-btn">Galleryから広告画像を選択</button><div id="adPreview"><span class="hint">画像を選択してください。</span></div></label><label>紐付けるイベントID<input name="event_public_id"></label><label>掲載開始<input type="datetime-local" name="starts_at" required></label><label>掲載終了<input type="datetime-local" name="ends_at" required></label><button class="primary">広告を申請</button><p id="adStatus"></p></form>';view.innerHTML=h;$('#pickAdImage').onclick=async()=>{const m=await nui('frame:pickGallery');if(m?.media?.src){$('#adMedia').value=m.media.src;$('#adPreview').innerHTML='<img class="cover-preview" src="'+esc(m.media.src)+'">'}};$('#adForm').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.currentTarget));if(!o.media_ref){$('#adStatus').textContent='広告画像を選択してください。';return}o.link_type='event';o.link_value=o.event_public_id;utcDates(o);const d=await nui('frame:createAd',o);$('#adStatus').textContent=d.ok?'申請しました ('+d.status+')':errorText(d.error)}}
async function staff(){const d=await nui('frame:getStaffDashboard');view.innerHTML=`<h2>Staff Console</h2>${d.ok?(d.ads||[]).map(a=>`<div class="staffrow"><b>${esc(a.product_name)} / ${esc(a.advertiser_name)}</b><p>${esc(a.status)} · ${a.price_snapshot}</p>${a.status==='pending_review'?`<button data-approve="${esc(a.public_id)}">承認</button> <button data-reject="${esc(a.public_id)}">却下</button>`:''}</div>`).join(''):esc(d.error)}`;document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{await nui('frame:reviewAd',{public_id:b.dataset.approve,decision:'approve'});staff()});document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=async()=>{await nui('frame:reviewAd',{public_id:b.dataset.reject,decision:'reject'});staff()})}
const views={home,mine,create,ads,staff};document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(!appReady&&b.dataset.view!=='home')return home();views[b.dataset.view]?.()});$('#refresh').onclick=home;home();
