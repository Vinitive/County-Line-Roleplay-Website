(() => {
const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||'').replace(/\/$/,''),$=id=>document.getElementById(id);
let data={calls:[],units:[],bolos:[],access:''},dispatchMap=null,callMarkers=new Map(),placingCall=false,postalData=[];
const req=async(method='GET',body={})=>{const r=await fetch(api+'/api/cad',{method,credentials:'include',headers:{'Accept':'application/json','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'CAD request failed.');return b;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const note=t=>$('cadNotice').textContent=t;
const empty=t=>'<div class="cad-empty">'+esc(t)+'</div>';
const switchView=v=>{document.querySelectorAll('.cad-view').forEach(x=>x.classList.toggle('active',x.id==='cad-'+v));document.querySelectorAll('.cad-nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('cadTitle').textContent=({calls:'ACTIVE CALLS',units:'UNIT ROSTER',records:'CITIZEN SEARCH',bolos:'BOLO BOARD',map:'DISPATCH MAP'})[v];if(v==='map'){initDispatchMap();requestAnimationFrame(()=>dispatchMap&&dispatchMap.invalidateSize());}};
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
$('webNewReport')?.addEventListener('click',()=>form('NEW INCIDENT REPORT',[{name:'record_type',label:'REPORT TYPE',type:'select',options:['Incident Report','Arrest Report','Citation']},{name:'subject',label:'SUBJECT / CITIZEN ID',required:true},{name:'title',label:'REPORT TITLE',required:true},{name:'details',label:'NARRATIVE',type:'textarea',full:true,required:true}], 'createRecord'));
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
let lastCitizenSearch='';
let lastCitizenRecords=[];
const displayValue=value=>{
  if(value===null||value===undefined||value==='')return 'Not provided';
  if(typeof value==='boolean')return value?'Yes':'No';
  if(Array.isArray(value))return value.length?value.map(displayValue).join(', '):'None recorded';
  if(typeof value==='object')return Object.entries(value).filter(([k,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())+': '+displayValue(v)).join(' · ')||'No details recorded';
  return String(value);
};
const dataRows=(items,emptyText,formatter)=>{
  if(!Array.isArray(items)||!items.length)return empty(emptyText);
  return items.map((item,i)=>'<div class="citizen-data-row">'+(formatter?formatter(item,i):'<b>'+esc(item.label||item.name||item.title||item.model||item.id||('Record '+(i+1)))+'</b><span>'+esc(displayValue(item.details||item.value||item.description||''))+'</span>')+'</div>').join('');
};
const section=(title,content)=>'<section class="citizen-profile-section"><h3>'+esc(title)+'</h3>'+content+'</section>';
const fact=(label,value)=>'<span><b>'+esc(label)+'</b>'+esc(displayValue(value))+'</span>';
function renderCitizenResults(records){
  $('webResults').innerHTML=records.length?records.map(x=>{
    if(x.type==='person')return '<article class="cad-result citizen-search-result"><div class="cad-result-head"><div><h3>'+esc(x.name)+'</h3><p>CITIZEN ID · '+esc(x.citizenid)+'</p></div><button class="btn btn-gold" data-citizen-profile="'+esc(x.citizenid)+'">VIEW CITIZEN PROFILE ↗</button></div></article>';
    return '<article class="cad-result"><h3>'+esc(x.name||'Record')+'</h3><p>'+esc(x.details||'')+'</p></article>';
  }).join(''):empty('No matching citizens found.');
}
function closeCitizenReport(){ $('cadModal').hidden=true; $('cadModalBody').innerHTML=''; }
function openCitizenReportForm(kind,citizenid,charges=[]){
  const titles={arrest:'CREATE ARREST REPORT',incident:'CREATE INCIDENT REPORT',citation:'ISSUE CITATION'};
  let fields='';
  if(kind==='arrest'){
    fields='<div class="citizen-report-field full"><label>CHARGES <span>Select every applicable charge</span></label><div class="citizen-report-charge-list">'+charges.map(c=>'<label class="citizen-report-charge"><input type="checkbox" name="chargeIds" value="'+esc(c.id)+'"><span><b>'+esc(c.code)+' · '+esc(c.title)+'</b><small>'+esc(c.category||'')+' · '+esc(c.offense_class||'')+'</small></span><strong>$'+Number(c.roleplay_fine||0).toLocaleString()+' · '+Number(c.roleplay_jail_minutes||0)+' min</strong></label>').join('')+'</div></div><label class="citizen-report-field full">ARREST NARRATIVE<textarea name="narrative" rows="6" required placeholder="Describe the circumstances of the arrest, probable cause, and relevant details..."></textarea></label>';
  }else{
    fields='<label class="citizen-report-field full">'+(kind==='citation'?'VIOLATION / OFFENSE':'REPORT TITLE')+'<input name="title" required placeholder="'+(kind==='citation'?'Enter the cited violation':'Enter a clear report title')+'"></label><label class="citizen-report-field full">'+(kind==='citation'?'CITATION DETAILS':'INCIDENT NARRATIVE')+'<textarea name="details" rows="6" required placeholder="Enter the full details..."></textarea></label>';
    if(kind==='citation')fields+='<label class="citizen-report-field">FINE AMOUNT ($)<input name="fine" type="number" min="0" step="1" required placeholder="0"></label>';
  }
  $('cadModalBody').innerHTML='<div class="citizen-report-heading"><small>COUNTY LINE ROLEPLAY · CITIZEN DOSSIER</small><h2>'+titles[kind]+'</h2><p>Citizen ID: '+esc(citizenid)+'</p></div><form id="citizenReportForm" class="citizen-report-form">'+fields+'<div class="citizen-report-error" id="citizenReportError" role="alert"></div><div class="citizen-report-footer"><button type="button" class="btn btn-outline" id="citizenReportCancel">CANCEL</button><button type="submit" class="btn btn-gold" id="citizenReportSubmit">'+(kind==='citation'?'ISSUE CITATION':'SAVE REPORT')+'</button></div></form>';
  $('cadModal').hidden=false;
  $('citizenReportCancel').addEventListener('click',closeCitizenReport);
  $('citizenReportForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const submit=$('citizenReportSubmit'),error=$('citizenReportError');
    submit.disabled=true;submit.textContent='SAVING...';error.textContent='';
    try{
      const fd=new FormData(e.currentTarget);
      if(kind==='arrest'){
        const chargeIds=fd.getAll('chargeIds');
        if(!chargeIds.length)throw new Error('Select at least one charge.');
        const narrative=String(fd.get('narrative')||'').trim();
        if(!narrative)throw new Error('Enter the arrest narrative.');
        await req('POST',{action:'createArrest',citizenid,chargeIds,narrative});
      }else{
        const title=String(fd.get('title')||'').trim(),details=String(fd.get('details')||'').trim();
        if(!title||!details)throw new Error('Complete all required fields.');
        if(kind==='citation'){
          const fine=Number(fd.get('fine'));
          if(!Number.isFinite(fine)||fine<0)throw new Error('Enter a valid citation fine.');
          await req('POST',{action:'createRecord',record_type:'Citation',subject:citizenid,title,details:'Fine: $'+fine+' - '+details});
        }else{
          await req('POST',{action:'createRecord',record_type:'Incident Report',subject:citizenid,title,details});
        }
      }
      closeCitizenReport();note('Report saved.');await openCitizenProfile(citizenid);
    }catch(err){error.textContent=err.message||'Unable to save this report.';submit.disabled=false;submit.textContent=kind==='citation'?'ISSUE CITATION':'SAVE REPORT';}
  });
}
function openWeaponRegistration(citizenid){
  $('cadModalBody').innerHTML='<div class="citizen-report-heading"><small>COUNTY LINE ROLEPLAY · WEAPON REGISTRY</small><h2>REGISTER WEAPON</h2><p>Registration will be attached to Citizen ID: '+esc(citizenid)+'</p></div><form id="citizenWeaponForm" class="citizen-report-form"><label class="citizen-report-field full">WEAPON NAME / MODEL<input name="weaponName" required maxlength="120" placeholder="e.g. Pistol .50"></label><label class="citizen-report-field full">SERIAL NUMBER<input name="serial" required maxlength="100" placeholder="Enter unique serial number"></label><label class="citizen-report-field full">NOTES<textarea name="notes" rows="4" maxlength="1000" placeholder="Optional identifying details..."></textarea></label><div class="citizen-report-error" id="citizenWeaponError" role="alert"></div><div class="citizen-report-footer"><button type="button" class="btn btn-outline" id="citizenWeaponCancel">CANCEL</button><button type="submit" class="btn btn-gold" id="citizenWeaponSave">REGISTER WEAPON</button></div></form>';
  $('cadModal').hidden=false;
  $('citizenWeaponCancel').addEventListener('click',closeCitizenReport);
  $('citizenWeaponForm').addEventListener('submit',async e=>{
    e.preventDefault();const submit=$('citizenWeaponSave'),error=$('citizenWeaponError'),fd=new FormData(e.currentTarget);
    submit.disabled=true;submit.textContent='REGISTERING...';error.textContent='';
    try{
      await req('POST',{action:'createRegisteredWeapon',citizenid,weaponName:String(fd.get('weaponName')||'').trim(),serial:String(fd.get('serial')||'').trim(),notes:String(fd.get('notes')||'').trim()});
      closeCitizenReport();note('Weapon registered.');await openCitizenProfile(citizenid);
    }catch(err){error.textContent=err.message;submit.disabled=false;submit.textContent='REGISTER WEAPON';}
  });
}
async function startCitizenAction(kind,citizenid){
  try{
    if(kind==='arrest'){
      const r=await req('POST',{action:'getCharges'});
      const charges=r.charges||[];
      if(!charges.length)throw new Error('No active charges are available.');
      openCitizenReportForm(kind,citizenid,charges);
    }else openCitizenReportForm(kind,citizenid);
  }catch(error){note(error.message||'Unable to open report form.');}
}
async function openCitizenProfile(citizenid){
  $('webResults').innerHTML=empty('Loading citizen dossier...');
  try{
    const r=await req('POST',{action:'getCitizenProfile',citizenid});
    const c=r.citizen||{},p=c.profile||{},availability=r.dataAvailability||{};
    const status=c.online?'<span class="citizen-profile-status">● CURRENTLY ONLINE</span>':'<span class="citizen-profile-status citizen-offline">○ OFFLINE</span>';
    const profileFacts=[
      fact('DATE OF BIRTH',p.birthdate),
      fact('GENDER',p.gender),
      fact('NATIONALITY',p.nationality),
      fact('PHONE',p.phone),
      fact('JOB',c.job?.label||c.job?.name),
      fact('JOB GRADE',c.job?.gradeName||c.job?.grade),
      fact('GANG',c.gang?.label||c.gang?.name),
      fact('FIRST JOINED',c.firstJoined?new Date(c.firstJoined).toLocaleDateString():'Not provided'),
      fact('PLAYTIME',Math.floor((Number(c.playtimeSeconds)||0)/3600)+' hours')
    ].join('');
    const licenseContent=availability.licenses
      ?dataRows(Object.entries(r.licenses||{}).map(([name,value])=>({name,value})), 'No licenses are recorded.')
      :empty('License data has not been synced for this citizen.');
    const vehicleContent=dataRows(r.vehicles,'No registered vehicles found.',v=>'<b>'+esc(v.label||v.model||'Vehicle')+'</b><span>Plate: '+esc(v.plate||'Not provided')+' · Garage: '+esc(v.garage||'Not provided')+' · Status: '+esc(displayValue(v.state))+'</span>');
    const propertyContent=dataRows(r.properties,'No owned properties found.',v=>'<b>'+esc(v.label||v.name||v.id||'Property')+'</b><span>'+esc(v.address||v.street||v.id||'Property record')+'</span>');
    const arrestItems=(r.arrests||[]).map(a=>'<div class="citizen-data-row"><b>ARREST · '+esc(new Date(a.created_at).toLocaleString())+'</b><span>Officer: '+esc(a.officer_name||'Not recorded')+' · RP fine: $'+Number(a.total_roleplay_fine||0).toLocaleString()+' · RP jail: '+esc(a.total_roleplay_jail_minutes||0)+' min</span><p>'+esc(a.narrative||'No narrative recorded.')+'</p>'+(a.charges||[]).map(ch=>'<small>'+esc(ch.charge_code+' · '+ch.charge_title)+' — '+esc(ch.offense_class||'')+' · '+esc(ch.statute||'')+'</small>').join('')+'</div>').join('');
    const legacyArrests=dataRows(r.legacyArrests||[],'',a=>'<b>'+esc(a.title||a.reportId||'Prior arrest')+'</b><span>'+esc(a.datecreated||a.created_at||'Date not provided')+' · Officer: '+esc(a.officer_name||'Not recorded')+'</span>');
    const legacyCharges=dataRows(r.legacyCharges||[],'',ch=>'<b>'+esc(ch.charge||ch.title||'Prior charge')+'</b><span>Fine: $'+Number(ch.fine||0).toLocaleString()+' · Jail: '+esc(ch.time||0)+' min</span>');
    const arrestContent=arrestItems||legacyArrests+legacyCharges||empty('No prior arrests or charges are on file.');
    const warrantContent=availability.warrants?dataRows(r.warrants,'No active warrants.',w=>'<b>'+esc(w.title||w.type||'Warrant')+'</b><span>'+esc(w.status||'Active')+' · '+esc(w.details||'')+'</span>'):empty('Warrant records are not connected to the County Line CAD yet.');
    const weaponRows=(r.registeredWeapons||[]).map(w=>'<div class="citizen-data-row"><b>'+esc(w.weaponName||'Registered weapon')+'</b><span>Serial: '+esc(w.serial)+' · '+esc(w.status)+' · Registered by: '+esc(w.registeredBy||'Unknown')+'</span>'+(w.notes?'<p>'+esc(w.notes)+'</p>':'')+(w.status==='Registered'?'<button class="btn btn-outline citizen-weapon-revoke" data-revoke-weapon="'+esc(w.id)+'" data-citizen-id="'+esc(c.citizenid||citizenid)+'">REVOKE REGISTRATION</button>':'')+'</div>').join('');
    const weaponContent='<div class="citizen-weapon-toolbar"><button class="btn btn-gold" id="citizenRegisterWeapon" data-citizen-id="'+esc(c.citizenid||citizenid)+'">+ REGISTER WEAPON</button></div>'+(weaponRows||empty('No weapons are registered to this citizen.'));

    const reportContent=dataRows(r.reports||[],'No linked incident reports.',v=>'<b>'+esc(v.title||v.record_type||'Incident report')+'</b><span>'+esc(v.created_at?new Date(v.created_at).toLocaleString():'Date not provided')+' · '+esc(v.officer_name||'')+'</span><p>'+esc(v.details||'')+'</p>');
    $('webResults').innerHTML='<div class="citizen-profile"><div class="citizen-profile-top"><div><small>COUNTY LINE ROLEPLAY · CITIZEN DOSSIER</small><h2>'+esc(c.name||'Unknown Citizen')+'</h2><p>CITIZEN ID · '+esc(c.citizenid||citizenid)+'</p></div>'+status+'</div><div class="citizen-profile-facts">'+profileFacts+'</div><div class="citizen-profile-grid">'+section('LICENSES',licenseContent)+section('REGISTERED VEHICLES',vehicleContent)+section('OWNED PROPERTIES',propertyContent)+section('ARREST & CHARGE HISTORY',arrestContent)+section('ACTIVE WARRANTS',warrantContent)+section('REGISTERED WEAPONS',weaponContent)+section('LINKED INCIDENT REPORTS',reportContent)+'</div><div class="citizen-result-actions"><button data-citizen-action="arrest" data-citizen-id="'+esc(c.citizenid||citizenid)+'">ARREST REPORT</button><button data-citizen-action="incident" data-citizen-id="'+esc(c.citizenid||citizenid)+'">INCIDENT REPORT</button><button data-citizen-action="citation" data-citizen-id="'+esc(c.citizenid||citizenid)+'">CITATION</button><button id="citizenBackToSearch">← BACK TO CITIZEN SEARCH</button></div><p class="cad-muted">Profile data last synced: '+esc(c.updatedAt?new Date(c.updatedAt).toLocaleString():'Not available')+'</p></div>';
    $('citizenBackToSearch').addEventListener('click',()=>renderCitizenResults(lastCitizenRecords));
  }catch(error){$('webResults').innerHTML=empty(error.message||'Unable to load this citizen profile.');}
}
async function runRecordSearch(){
  $('webResults').innerHTML=empty('Searching citizens...');
  try{
    lastCitizenSearch=$('webSearchQuery').value;
    const r=await req('POST',{action:'search',searchType:'person',query:lastCitizenSearch});
    lastCitizenRecords=(r.records||[]).filter(x=>x.type==='person');
    renderCitizenResults(lastCitizenRecords);
  }catch(error){$('webResults').innerHTML=empty(error.message);}
}
$('webSearch').addEventListener('submit',async e=>{e.preventDefault();await runRecordSearch();});
$('webResults').addEventListener('click',async e=>{
  const profileButton=e.target.closest('[data-citizen-profile]');
  if(profileButton){await openCitizenProfile(profileButton.dataset.citizenProfile);return;}
  const registerWeapon=e.target.closest('#citizenRegisterWeapon');
  if(registerWeapon){openWeaponRegistration(registerWeapon.dataset.citizenId);return;}
  const revokeWeapon=e.target.closest('[data-revoke-weapon]');
  if(revokeWeapon){
    if(!confirm('Revoke this weapon registration?'))return;
    try{await req('POST',{action:'revokeRegisteredWeapon',id:revokeWeapon.dataset.revokeWeapon});note('Weapon registration revoked.');await openCitizenProfile(revokeWeapon.dataset.citizenId);}catch(err){note(err.message);}
    return;
  }
  const actionButton=e.target.closest('[data-citizen-action]');
  if(actionButton)startCitizenAction(actionButton.dataset.citizenAction,actionButton.dataset.citizenId).catch(error=>note(error.message));
});
async function openChargeCatalog(){
  try{
    const r=await req('POST',{action:'getCharges'});
    $('webResults').innerHTML='<div class="cad-catalog-head"><h3>COUNTY LINE CHARGE CATALOG</h3><p>County Line catalog penalty references are separate from the configurable roleplay fine and jail defaults.</p></div>'+(r.charges||[]).map(c=>'<article class="cad-result"><div class="cad-result-head"><div><h3>'+esc(c.code)+' · '+esc(c.title)+'</h3><p>'+esc(c.category)+' · '+esc(c.offense_class)+' · '+esc(c.statute)+'</p></div><div class="cad-rp-values">RP &#36;'+Number(c.roleplay_fine).toLocaleString()+'<br>'+esc(c.roleplay_jail_minutes)+' min</div></div><p>'+esc(c.description)+'</p><small class="cad-legal-penalty">County Line penalty reference: '+esc(c.statutory_penalty)+'</small></article>').join('');
  }catch(e){$('webResults').innerHTML=empty(e.message);}
}
$('webChargeCatalog')?.addEventListener('click',openChargeCatalog);
$('webCalls').addEventListener('click',e=>{const a=e.target.closest('[data-assign]'),u=e.target.closest('[data-update]');if(a)post('assignCall',{callId:a.dataset.assign});if(u){const id=u.dataset.update;post('updateCall',{callId:id,status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value});}});
(async()=>{try{const me=await fetch(api+'/api/me',{credentials:'include'});const m=await me.json();const p=m.access?.permissions||[];if(!m.authenticated||(!p.includes('*')&&!p.includes('mdt.leo')&&!p.includes('dispatch.access'))){note('Access denied. Law Enforcement or Dispatch permissions are required.');return;}if(!api){note('Portal API is not configured.');return;}if(!p.includes('*')&&!p.includes('mdt.leo')){document.querySelectorAll('#webNewReport,#webNewBolo,#webChargeCatalog').forEach(x=>x.hidden=true);document.querySelector('[data-view="records"]').hidden=true;}await refresh();setInterval(refresh,15000);}catch(e){note('Unable to verify CAD access. Please sign in through the Player Portal.');}})();
})();