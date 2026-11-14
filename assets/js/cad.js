(() => {
const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||'').replace(/\/$/,''),$=id=>document.getElementById(id);
let data={calls:[],units:[],bolos:[],access:''},dispatchMap=null,callMarkers=new Map(),placingCall=false,postalData=[];
const req=async(method='GET',body={})=>{const r=await fetch(api+'/api/cad',{method,credentials:'include',headers:{'Accept':'application/json','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'CAD request failed.');return b;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const note=t=>$('cadNotice').textContent=t;
const empty=t=>'<div class="cad-empty">'+esc(t)+'</div>';
const switchView=v=>{document.querySelectorAll('.cad-view').forEach(x=>x.classList.toggle('active',x.id==='cad-'+v));document.querySelectorAll('.cad-nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('cadTitle').textContent=({calls:'ACTIVE CALLS',units:'UNIT ROSTER',records:'RECORDS TERMINAL',bolos:'BOLO BOARD',map:'DISPATCH MAP'})[v];if(v==='map'){initDispatchMap();requestAnimationFrame(()=>dispatchMap&&dispatchMap.invalidateSize());}};
document.querySelectorAll('.cad-nav').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
async function refresh(){try{data=await req();render();note('Secure CAD session active · '+(data.officer?.name||'Authorized user'));}catch(e){note(e.message);}}
function render(){const calls=data.calls||[],units=data.units||[],bolos=data.bolos||[];$('navCallCount').textContent=calls.length;$('metricCalls').textContent=calls.length;$('metricUnits').textContent=units.length;$('metricAvailable').textContent=units.filter(x=>x.status==='Available').length;$('metricBolos').textContent=bolos.length;
$('webCalls').innerHTML=calls.length?calls.map(c=>'<article class="cad-call"><div class="cad-call-top"><span class="cad-call-code">'+esc(c.call_number)+'</span><span class="cad-panel-head">'+esc(c.status)+'</span></div><h3>'+esc(c.call_type)+'</h3><p>'+esc(c.location)+' · '+esc(c.postal||'')+'</p><p>'+esc(c.description)+'</p><div class="cad-call-meta"><span>PRIORITY '+esc(c.priority)+'</span><span>UNITS: '+esc((c.units||[]).map(u=>u.callsign||u.name).join(', ')||'UNASSIGNED')+'</span></div><div class="cad-controls"><select data-status="'+esc(c.id)+'"><option>Pending</option><option>Dispatched</option><option>On Scene</option><option>Closed</option></select><button class="btn btn-outline" data-assign="'+esc(c.id)+'">ASSIGN ME</button><button class="btn btn-outline" data-update="'+esc(c.id)+'">UPDATE</button></div></article>').join(''):empty('No active calls in the queue.');
$('webUnits').innerHTML=units.length?units.map(u=>'<article class="cad-unit"><strong>'+esc(u.callsign||'UNIT')+' · '+esc(u.name)+'</strong><small>'+esc(u.job)+' · '+esc(u.status)+'</small></article>').join(''):empty('No units are currently signed into CAD.');
$('webBolos').innerHTML=bolos.length?bolos.map(b=>'<article class="cad-bolo"><span class="cad-call-code">'+esc(b.bolo_type)+'</span><h3>'+esc(b.title)+'</h3><p>'+esc(b.description)+'</p></article>').join(''):empty('No active BOLO notices.');drawCallMarkers();
}
async function post(action,body){try{const r=await req('POST',{action,...body});note(r.message||'CAD updated.');await refresh();}catch(e){note(e.message);}}
function form(title,fields,action){const controls=fields.map(f=>{if(f.type==='hidden')return '<input type="hidden" name="'+f.name+'" value="'+esc(f.value)+'">';let control='';if(f.type==='textarea')control='<textarea name="'+f.name+'" rows="4" '+(f.required?'required':'')+'></textarea>';else if(f.type==='select')control='<select name="'+f.name+'">'+f.options.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select>';else control='<input name="'+f.name+'" '+(f.required?'required':'')+'>';return '<label class="cad-field '+(f.full?'full':'')+'">'+esc(f.label)+control+'</label>';}).join('');$('cadModalBody').innerHTML='<h2>'+esc(title)+'</h2><form id="cadForm" class="cad-form-grid">'+controls+'<div class="full"><button class="btn btn-gold cad-form-submit">CREATE CALL</button></div></form>';$('cadModal').hidden=false;$('cadForm').addEventListener('submit',async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());if(action==='createCall'&&payload.postal){payload.location=payload.location+' (Postal '+payload.postal+')';}await post(action,payload);$('cadModal').hidden=true;});}
$('cadModalClose').addEventListener('click',()=>$('cadModal').hidden=true);
$('webNewCall').addEventListener('click',()=>{switchView('map');placingCall=true;$('mapHint').textContent='Click the incident location on the map to continue.';note('Map placement active · Click the incident location.');});
$('webNewReport').addEventListener('click',()=>form('NEW INCIDENT REPORT',[{name:'record_type',label:'REPORT TYPE',type:'select',options:['Incident Report','Arrest Report','Citation']},{name:'subject',label:'SUBJECT / CITIZEN ID',required:true},{name:'title',label:'REPORT TITLE',required:true},{name:'details',label:'NARRATIVE',type:'textarea',full:true,required:true}], 'createRecord'));
$('webNewBolo').addEventListener('click',()=>form('CREATE BOLO',[{name:'bolo_type',label:'BOLO TYPE',type:'select',options:['Person','Vehicle','Other']},{name:'title',label:'SUBJECT / VEHICLE',required:true},{name:'description',label:'DESCRIPTION',type:'textarea',full:true,required:true}], 'createBolo'));
$('mapPlaceCall').addEventListener('click',()=>{switchView('map');placingCall=true;$('mapHint').textContent='Click the incident location on the map to continue.';note('Map placement active · Click the incident location.');});
$('mapReset').addEventListener('click',()=>{if(dispatchMap)dispatchMap.fitBounds([[-5100,-4140],[8400,4860]]);});
async function loadPostalOverlay(){
  const postalTiles='https://postal-code-map-tile.pages.dev/tiles/{z}/{x}/{y}.png';
  L.tileLayer(postalTiles,{tileSize:256,minZoom:0,maxZoom:6,maxNativeZoom:6,noWrap:true,bounds:[[-5100,-4140],[8400,4860]],attribution:'Four-digit postal map · Virus_City / Acc-Off'}).addTo(dispatchMap);
  try{
    const response=await fetch('assets/data/postals.json',{cache:'force-cache'});
    if(!response.ok)throw new Error('Postal coordinate data unavailable');
    postalData=(await response.json()).filter(p=>/^\\d{4}$/.test(String(p.code)));
    $('mapHint').textContent='Four-digit postal map loaded · Select “Place New Call” to create an incident.';
  }catch(error){console.warn('CLRP postal lookup:',error);$('mapHint').textContent='Postal map loaded; automatic postal lookup is unavailable.';}
}
function nearestPostal(x,y){
  if(!postalData.length)return null;
  let nearest=null,best=Infinity;
  for(const p of postalData){const d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<best){best=d;nearest=p;}}
  return nearest;
}
function initDispatchMap(){
  if(dispatchMap||!window.L)return;
  const config={image:[6144,9216],topLeft:[-4140,8400],bottomRight:[4860,-5100],maxZoom:6};
  const crs=Object.create(L.CRS.Simple);
  const u=config.image[0]/((config.bottomRight[0]-config.topLeft[0])*Math.pow(2,config.maxZoom));
  const d=config.image[1]/((config.bottomRight[1]-config.topLeft[1])*Math.pow(2,config.maxZoom));
  crs.transformation=new L.Transformation(u,-u*config.topLeft[0],d,-d*config.topLeft[1]);
  crs.wrapLng=[config.topLeft[0],config.bottomRight[0]];
  crs.wrapLat=[config.bottomRight[1],config.topLeft[1]];
  crs.infinite=false;
  crs.scale=zoom=>Math.pow(2,zoom);
  crs.zoom=scale=>Math.log(scale)/Math.LN2;
  crs.distance=(a,b)=>Math.hypot(b.lng-a.lng,b.lat-a.lat);
  const bounds=[[-5100,-4140],[8400,4860]];
  dispatchMap=L.map('clrpDispatchMap',{crs,minZoom:0,maxZoom:6,zoomControl:true,attributionControl:true,maxBounds:bounds,maxBoundsViscosity:1,preferCanvas:true});
  loadPostalOverlay();
  dispatchMap.fitBounds(bounds);
  dispatchMap.on('click',e=>{
    if(!placingCall)return;
    placingCall=false;
    const x=e.latlng.lng,y=e.latlng.lat;
    const postal=nearestPostal(x,y),postalCode=postal?String(postal.code):'';
    $('mapHint').textContent='Location selected · Postal '+(postalCode||'not found')+'. Complete the call details.';
    form('CREATE DISPATCH CALL',[
      {name:'call_type',label:'CALL TYPE',required:true},
      {name:'location',label:'LOCATION / ADDRESS',required:true},
      {name:'priority',label:'PRIORITY',type:'select',options:['1 - Emergency','2 - Urgent','3 - Routine','4 - Information']},
      {name:'description',label:'CALL DETAILS',type:'textarea',full:true},
      {name:'postal',type:'hidden',value:postalCode},
      {name:'mapX',type:'hidden',value:x.toFixed(2)},
      {name:'mapY',type:'hidden',value:y.toFixed(2)}
    ],'createCall');
  });
  drawCallMarkers();
}
function priorityColor(p){return String(p||'').startsWith('1')?'#ef4444':String(p||'').startsWith('2')?'#f97316':String(p||'').startsWith('4')?'#3b82f6':'#eab308';}
function drawCallMarkers(){if(!dispatchMap||!window.L)return;const active=new Set();(data.calls||[]).forEach(c=>{if(c.mapX==null||c.mapY==null||Number(c.mapX)<-4140||Number(c.mapX)>4860||Number(c.mapY)<-5100||Number(c.mapY)>8400)return;active.add(c.id);let marker=callMarkers.get(c.id);const color=priorityColor(c.priority);const html='<div class="cad-map-popup"><b>'+esc(c.call_number)+' · '+esc(c.call_type)+'</b><p>'+esc(c.location)+'</p><small>Priority '+esc(c.priority)+' · '+esc(c.status)+'</small><p>'+esc(c.description||'')+'</p></div>';const icon=L.divIcon({className:'cad-call-marker-wrap',html:'<span class="cad-call-marker" style="--marker-color:'+color+'"></span>',iconSize:[24,24],iconAnchor:[12,12]});if(!marker){marker=L.marker([Number(c.mapY),Number(c.mapX)],{icon,draggable:data.access==='dispatch',autoPan:true}).addTo(dispatchMap);callMarkers.set(c.id,marker);marker.on('dragend',()=>{const p=marker.getLatLng();post('moveCallBlip',{callId:c.id,mapX:p.lng,mapY:p.lat});});}else{marker.setLatLng([Number(c.mapY),Number(c.mapX)]);marker.setIcon(icon);if(marker.dragging)data.access==='dispatch'?marker.dragging.enable():marker.dragging.disable();}marker.bindPopup(html);});for(const [id,m] of callMarkers){if(!active.has(id)){dispatchMap.removeLayer(m);callMarkers.delete(id);}}}
$('webUnitStatus').addEventListener('change',e=>post('setStatus',{status:e.target.value}));
async function runRecordSearch(){
  $('webResults').innerHTML=empty('Searching records...');
  try{
    const r=await req('POST',{action:'search',searchType:$('webSearchType').value,query:$('webSearchQuery').value});
    $('webResults').innerHTML=(r.records||[]).length?r.records.map(x=>{
      if(x.type==='person'){
        const history=(x.history||[]).length?(x.history||[]).map(a=>'<div class="cad-history-item"><b>ARREST · '+new Date(a.created_at).toLocaleString()+'</b><small>Officer: '+esc(a.officer_name)+' · RP fine: &#36;'+Number(a.total_roleplay_fine||0).toLocaleString()+' · RP jail: '+esc(a.total_roleplay_jail_minutes)+' min</small><p>'+esc(a.narrative)+'</p><ul>'+a.charges.map(c=>'<li><b>'+esc(c.charge_code)+' — '+esc(c.charge_title)+'</b> · '+esc(c.offense_class)+' · '+esc(c.statute)+'<small>County Line penalty reference: '+esc(c.statutory_penalty)+'<br>RP fine: &#36;'+Number(c.roleplay_fine||0).toLocaleString()+' · RP jail: '+esc(c.roleplay_jail_minutes)+' min</small></li>').join('')+'</ul></div>').join(''):'<p class="cad-muted">No arrest history on file.</p>';
        return '<article class="cad-result citizen-search-result"><div class="cad-result-head"><div><h3>'+esc(x.name)+'</h3><p>'+esc(x.details)+'</p></div><div class="citizen-result-actions"><button class="btn btn-gold" data-profile="'+esc(x.citizenid)+'">OPEN CITIZEN PROFILE ↗</button><button class="btn btn-outline" data-arrest="'+esc(x.citizenid)+'" data-name="'+esc(x.name)+'">＋ CREATE ARREST</button></div></div></article>';
      }
      return '<article class="cad-result"><h3>'+esc(x.name||'Record')+'</h3><p>'+esc(x.details||'')+'</p></article>';
    }).join(''):empty('No matching records found.');
  }catch(x){$('webResults').innerHTML=empty(x.message);}
}
$('webSearch').addEventListener('submit',async e=>{e.preventDefault();await runRecordSearch();});
async function openCitizenProfile(citizenid){
  $('webResults').innerHTML=empty('Loading citizen profile...');
  try{
    const p=await req('POST',{action:'getCitizenProfile',citizenid}),c=p.citizen||{},profile=c.profile||{},availability=p.dataAvailability||{};
    const section=(title,body)=>'<section class="citizen-profile-section"><h3>'+esc(title)+'</h3>'+body+'</section>';
    const rows=(items,render,msg)=>Array.isArray(items)&&items.length?items.map(render).join(''):empty(msg);
    const license=availability.licenses?'<pre>'+esc(JSON.stringify(p.licenses,null,2))+'</pre>':empty('License information is not currently synced.');
    const vehicles=rows(p.vehicles,v=>'<article class="citizen-data-row"><b>'+esc(v.label||v.model||'Vehicle')+'</b><span>Plate: '+esc(v.plate||'—')+'</span><small>Garage: '+esc(v.garage||'—')+'</small></article>','No vehicles on file.');
    const houses=rows(p.properties,v=>'<article class="citizen-data-row"><b>'+esc(v.label||v.id||'Property')+'</b></article>','No properties on file.');
    const arrests=rows(p.arrests,a=>'<article class="citizen-data-row"><b>CAD ARREST · '+esc(new Date(Number(a.created_at)).toLocaleString())+'</b><span>'+esc(a.officer_name)+' · RP fine 
  try{
    const r=await req('POST',{action:'getCharges'});
    $('webResults').innerHTML='<div class="cad-catalog-head"><h3>COUNTY LINE CHARGE CATALOG</h3><p>County Line catalog penalty references are separate from the configurable roleplay fine and jail defaults.</p></div>'+(r.charges||[]).map(c=>'<article class="cad-result"><div class="cad-result-head"><div><h3>'+esc(c.code)+' · '+esc(c.title)+'</h3><p>'+esc(c.category)+' · '+esc(c.offense_class)+' · '+esc(c.statute)+'</p></div><div class="cad-rp-values">RP &#36;'+Number(c.roleplay_fine).toLocaleString()+'<br>'+esc(c.roleplay_jail_minutes)+' min</div></div><p>'+esc(c.description)+'</p><small class="cad-legal-penalty">County Line penalty reference: '+esc(c.statutory_penalty)+'</small></article>').join('');
  }catch(e){$('webResults').innerHTML=empty(e.message);}
}
$('webChargeCatalog')?.addEventListener('click',openChargeCatalog);
$('webResults').addEventListener('click',async e=>{
  const profileButton=e.target.closest('[data-profile]');
  if(profileButton){await openCitizenProfile(profileButton.dataset.profile);return;}
  const b=e.target.closest('[data-arrest]');if(!b)return;
  try{
    const r=await req('POST',{action:'getCharges'}),charges=r.charges||[];
    $('cadModalBody').innerHTML='<h2>CREATE ARREST · '+esc(b.dataset.name)+'</h2><form id="cadArrestForm"><input type="hidden" name="citizenid" value="'+esc(b.dataset.arrest)+'"><label class="cad-field full">ARREST NARRATIVE<textarea name="narrative" rows="4" required></textarea></label><h3 class="full">SELECT CHARGES</h3><div class="cad-charge-picker">'+charges.map(c=>'<label class="cad-charge-option"><input type="checkbox" name="charge" value="'+esc(c.id)+'" data-fine="'+Number(c.roleplay_fine)+'" data-jail="'+Number(c.roleplay_jail_minutes)+'"><span><b>'+esc(c.code)+' · '+esc(c.title)+'</b><small>'+esc(c.offense_class)+' · '+esc(c.statute)+'</small><small>County Line: '+esc(c.statutory_penalty)+'</small><small>RP default: &#36;'+Number(c.roleplay_fine).toLocaleString()+' · '+esc(c.roleplay_jail_minutes)+' min</small></span></label>').join('')+'</div><div class="cad-arrest-totals"><b>RP FINE TOTAL: &#36;<span id="arrestFineTotal">0</span></b><b>RP JAIL TOTAL: <span id="arrestJailTotal">0</span> MIN</b></div><button class="btn btn-gold cad-form-submit">SAVE ARREST</button></form>';
    $('cadModal').hidden=false;
    const f=$('cadArrestForm');
    f.addEventListener('change',()=>{
      const selected=[...f.querySelectorAll('input[name="charge"]:checked')];
      $('arrestFineTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.fine),0).toLocaleString();
      $('arrestJailTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.jail),0).toLocaleString();
    });
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const ids=[...f.querySelectorAll('input[name="charge"]:checked')].map(x=>x.value);
      try{
        const result=await req('POST',{action:'createArrest',citizenid:b.dataset.arrest,narrative:f.elements.narrative.value,chargeIds:ids});
        note(result.message||'Arrest saved.');$('cadModal').hidden=true;await runRecordSearch();
      }catch(err){note(err.message);}
    });
  }catch(err){note(err.message);}
});
$('webCalls').addEventListener('click',e=>{const a=e.target.closest('[data-assign]'),u=e.target.closest('[data-update]');if(a)post('assignCall',{callId:a.dataset.assign});if(u){const id=u.dataset.update;post('updateCall',{callId:id,status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value});}});
(async()=>{try{if(!api){note('Portal API is not configured.');return;}const me=await fetch(api+'/api/me',{credentials:'include'});const m=await me.json();const p=m.access?.permissions||[];if(!m.authenticated||(!p.includes('*')&&!p.includes('mdt.leo')&&!p.includes('dispatch.access'))){note('Access denied. Law Enforcement or Dispatch permissions are required.');return;}if(!p.includes('*')&&!p.includes('mdt.leo')){document.querySelectorAll('#webNewReport,#webNewBolo,#webChargeCatalog').forEach(x=>x.hidden=true);document.querySelector('[data-view="records"]').hidden=true;}await refresh();setInterval(refresh,15000);}catch(e){note('Unable to verify CAD access. Please sign in through the Player Portal.');}})();
})();+Number(a.total_roleplay_fine||0).toLocaleString()+' · RP jail '+esc(a.total_roleplay_jail_minutes)+' min</span><p>'+esc(a.narrative)+'</p><ul>'+(a.charges||[]).map(ch=>'<li>'+esc(ch.charge_code)+' · '+esc(ch.charge_title)+'</li>').join('')+'</ul></article>','No custom CAD arrests on file.');
    const legacy=rows(p.legacyArrests,a=>'<article class="citizen-data-row"><b>'+esc(a.title||'Prior arrest')+'</b><small>'+esc(a.datecreated||'')+'</small></article>','');
    const charges=rows(p.legacyCharges,a=>'<article class="citizen-data-row"><b>'+esc(a.charge||'Charge')+'</b><span>Fine: 
  try{
    const r=await req('POST',{action:'getCharges'});
    $('webResults').innerHTML='<div class="cad-catalog-head"><h3>COUNTY LINE CHARGE CATALOG</h3><p>County Line catalog penalty references are separate from the configurable roleplay fine and jail defaults.</p></div>'+(r.charges||[]).map(c=>'<article class="cad-result"><div class="cad-result-head"><div><h3>'+esc(c.code)+' · '+esc(c.title)+'</h3><p>'+esc(c.category)+' · '+esc(c.offense_class)+' · '+esc(c.statute)+'</p></div><div class="cad-rp-values">RP &#36;'+Number(c.roleplay_fine).toLocaleString()+'<br>'+esc(c.roleplay_jail_minutes)+' min</div></div><p>'+esc(c.description)+'</p><small class="cad-legal-penalty">County Line penalty reference: '+esc(c.statutory_penalty)+'</small></article>').join('');
  }catch(e){$('webResults').innerHTML=empty(e.message);}
}
$('webChargeCatalog')?.addEventListener('click',openChargeCatalog);
$('webResults').addEventListener('click',async e=>{
  const b=e.target.closest('[data-arrest]');if(!b)return;
  try{
    const r=await req('POST',{action:'getCharges'}),charges=r.charges||[];
    $('cadModalBody').innerHTML='<h2>CREATE ARREST · '+esc(b.dataset.name)+'</h2><form id="cadArrestForm"><input type="hidden" name="citizenid" value="'+esc(b.dataset.arrest)+'"><label class="cad-field full">ARREST NARRATIVE<textarea name="narrative" rows="4" required></textarea></label><h3 class="full">SELECT CHARGES</h3><div class="cad-charge-picker">'+charges.map(c=>'<label class="cad-charge-option"><input type="checkbox" name="charge" value="'+esc(c.id)+'" data-fine="'+Number(c.roleplay_fine)+'" data-jail="'+Number(c.roleplay_jail_minutes)+'"><span><b>'+esc(c.code)+' · '+esc(c.title)+'</b><small>'+esc(c.offense_class)+' · '+esc(c.statute)+'</small><small>County Line: '+esc(c.statutory_penalty)+'</small><small>RP default: &#36;'+Number(c.roleplay_fine).toLocaleString()+' · '+esc(c.roleplay_jail_minutes)+' min</small></span></label>').join('')+'</div><div class="cad-arrest-totals"><b>RP FINE TOTAL: &#36;<span id="arrestFineTotal">0</span></b><b>RP JAIL TOTAL: <span id="arrestJailTotal">0</span> MIN</b></div><button class="btn btn-gold cad-form-submit">SAVE ARREST</button></form>';
    $('cadModal').hidden=false;
    const f=$('cadArrestForm');
    f.addEventListener('change',()=>{
      const selected=[...f.querySelectorAll('input[name="charge"]:checked')];
      $('arrestFineTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.fine),0).toLocaleString();
      $('arrestJailTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.jail),0).toLocaleString();
    });
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const ids=[...f.querySelectorAll('input[name="charge"]:checked')].map(x=>x.value);
      try{
        const result=await req('POST',{action:'createArrest',citizenid:b.dataset.arrest,narrative:f.elements.narrative.value,chargeIds:ids});
        note(result.message||'Arrest saved.');$('cadModal').hidden=true;await runRecordSearch();
      }catch(err){note(err.message);}
    });
  }catch(err){note(err.message);}
});
$('webCalls').addEventListener('click',e=>{const a=e.target.closest('[data-assign]'),u=e.target.closest('[data-update]');if(a)post('assignCall',{callId:a.dataset.assign});if(u){const id=u.dataset.update;post('updateCall',{callId:id,status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value});}});
(async()=>{try{const me=await fetch(api+'/api/me',{credentials:'include'});const m=await me.json();const p=m.access?.permissions||[];if(!m.authenticated||(!p.includes('*')&&!p.includes('mdt.leo')&&!p.includes('dispatch.access'))){note('Access denied. Law Enforcement or Dispatch permissions are required.');return;}if(!api){note('Portal API is not configured.');return;}if(!p.includes('*')&&!p.includes('mdt.leo')){document.querySelectorAll('#webNewReport,#webNewBolo,#webChargeCatalog').forEach(x=>x.hidden=true);document.querySelector('[data-view="records"]').hidden=true;}await refresh();setInterval(refresh,15000);}catch(e){note('Unable to verify CAD access. Please sign in through the Player Portal.');}})();
})();+Number(a.fine||0).toLocaleString()+' · Jail: '+esc(a.time||0)+' min</span></article>','No legacy charge history.');
    const warrants=availability.warrants?rows(p.warrants,w=>'<article class="citizen-data-row">'+esc(w.title||w.type||'Warrant')+'</article>','No active warrants on file.'):empty('Warrant data is not currently synced.');
    const weapons=availability.registeredWeapons?rows(p.registeredWeapons,w=>'<article class="citizen-data-row">'+esc(w.label||w.weapon||w.serial||'Registered weapon')+'</article>','No registered weapons on file.'):empty('Registered weapon data is not currently synced.');
    $('webResults').innerHTML='<div class="citizen-profile"><div class="citizen-profile-top"><div><small>COUNTY LINE ROLEPLAY · CITIZEN DOSSIER</small><h2>'+esc(c.name||'Unknown Citizen')+'</h2><p>CITIZEN ID: '+esc(c.citizenid)+'</p></div><b>'+(c.online?'ONLINE':'OFFLINE')+'</b></div><div class="citizen-profile-facts"><span><b>BIRTHDATE</b>'+esc(profile.birthdate||'Not available')+'</span><span><b>GENDER</b>'+esc(profile.gender||'Not available')+'</span><span><b>NATIONALITY</b>'+esc(profile.nationality||'Not available')+'</span><span><b>PHONE</b>'+esc(profile.phone||'Not available')+'</span><span><b>JOB</b>'+esc(c.job?.label||'Not available')+'</span></div><div class="citizen-profile-grid">'+section('LICENSES',license)+section('OWNED VEHICLES',vehicles)+section('OWNED PROPERTIES',houses)+section('PRIOR ARRESTS',arrests+legacy)+section('CHARGE HISTORY',charges)+section('ACTIVE WARRANTS',warrants)+section('REGISTERED WEAPONS',weapons)+'</div><button class="btn btn-outline" id="citizenBack">← BACK TO CITIZEN SEARCH</button></div>';
    $('citizenBack').addEventListener('click',runRecordSearch);
  }catch(e){$('webResults').innerHTML=empty(e.message);}
}
async function openChargeCatalog(){
  try{
    const r=await req('POST',{action:'getCharges'});
    $('webResults').innerHTML='<div class="cad-catalog-head"><h3>COUNTY LINE CHARGE CATALOG</h3><p>County Line catalog penalty references are separate from the configurable roleplay fine and jail defaults.</p></div>'+(r.charges||[]).map(c=>'<article class="cad-result"><div class="cad-result-head"><div><h3>'+esc(c.code)+' · '+esc(c.title)+'</h3><p>'+esc(c.category)+' · '+esc(c.offense_class)+' · '+esc(c.statute)+'</p></div><div class="cad-rp-values">RP &#36;'+Number(c.roleplay_fine).toLocaleString()+'<br>'+esc(c.roleplay_jail_minutes)+' min</div></div><p>'+esc(c.description)+'</p><small class="cad-legal-penalty">County Line penalty reference: '+esc(c.statutory_penalty)+'</small></article>').join('');
  }catch(e){$('webResults').innerHTML=empty(e.message);}
}
$('webChargeCatalog')?.addEventListener('click',openChargeCatalog);
$('webResults').addEventListener('click',async e=>{
  const b=e.target.closest('[data-arrest]');if(!b)return;
  try{
    const r=await req('POST',{action:'getCharges'}),charges=r.charges||[];
    $('cadModalBody').innerHTML='<h2>CREATE ARREST · '+esc(b.dataset.name)+'</h2><form id="cadArrestForm"><input type="hidden" name="citizenid" value="'+esc(b.dataset.arrest)+'"><label class="cad-field full">ARREST NARRATIVE<textarea name="narrative" rows="4" required></textarea></label><h3 class="full">SELECT CHARGES</h3><div class="cad-charge-picker">'+charges.map(c=>'<label class="cad-charge-option"><input type="checkbox" name="charge" value="'+esc(c.id)+'" data-fine="'+Number(c.roleplay_fine)+'" data-jail="'+Number(c.roleplay_jail_minutes)+'"><span><b>'+esc(c.code)+' · '+esc(c.title)+'</b><small>'+esc(c.offense_class)+' · '+esc(c.statute)+'</small><small>County Line: '+esc(c.statutory_penalty)+'</small><small>RP default: &#36;'+Number(c.roleplay_fine).toLocaleString()+' · '+esc(c.roleplay_jail_minutes)+' min</small></span></label>').join('')+'</div><div class="cad-arrest-totals"><b>RP FINE TOTAL: &#36;<span id="arrestFineTotal">0</span></b><b>RP JAIL TOTAL: <span id="arrestJailTotal">0</span> MIN</b></div><button class="btn btn-gold cad-form-submit">SAVE ARREST</button></form>';
    $('cadModal').hidden=false;
    const f=$('cadArrestForm');
    f.addEventListener('change',()=>{
      const selected=[...f.querySelectorAll('input[name="charge"]:checked')];
      $('arrestFineTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.fine),0).toLocaleString();
      $('arrestJailTotal').textContent=selected.reduce((n,x)=>n+Number(x.dataset.jail),0).toLocaleString();
    });
    f.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const ids=[...f.querySelectorAll('input[name="charge"]:checked')].map(x=>x.value);
      try{
        const result=await req('POST',{action:'createArrest',citizenid:b.dataset.arrest,narrative:f.elements.narrative.value,chargeIds:ids});
        note(result.message||'Arrest saved.');$('cadModal').hidden=true;await runRecordSearch();
      }catch(err){note(err.message);}
    });
  }catch(err){note(err.message);}
});
$('webCalls').addEventListener('click',e=>{const a=e.target.closest('[data-assign]'),u=e.target.closest('[data-update]');if(a)post('assignCall',{callId:a.dataset.assign});if(u){const id=u.dataset.update;post('updateCall',{callId:id,status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value});}});
(async()=>{try{const me=await fetch(api+'/api/me',{credentials:'include'});const m=await me.json();const p=m.access?.permissions||[];if(!m.authenticated||(!p.includes('*')&&!p.includes('mdt.leo')&&!p.includes('dispatch.access'))){note('Access denied. Law Enforcement or Dispatch permissions are required.');return;}if(!api){note('Portal API is not configured.');return;}if(!p.includes('*')&&!p.includes('mdt.leo')){document.querySelectorAll('#webNewReport,#webNewBolo,#webChargeCatalog').forEach(x=>x.hidden=true);document.querySelector('[data-view="records"]').hidden=true;}await refresh();setInterval(refresh,15000);}catch(e){note('Unable to verify CAD access. Please sign in through the Player Portal.');}})();
})();