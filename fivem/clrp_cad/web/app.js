(() => {
const resource = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'clrp_cad';
const $ = id => document.getElementById(id);
let state = { access:'leo', officer:{}, calls:[], units:[], bolos:[] };
let requestCounter = 0, dispatchMap = null, postalData = [], placingCall = false, callMarkers = new Map();
const nui = (name,data={}) => fetch(`https://${resource}/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(()=>{});
const send = (name,data={}) => { data.requestId = ++requestCounter; nui(name,data); return data.requestId; };
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = text => { $('message').textContent = text || 'CAD connected.'; };
const switchPanel = name => {
 document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
 $('panelTitle').textContent = ({calls:'ACTIVE CALLS',units:'UNIT ROSTER',records:'RECORDS TERMINAL',bolos:'BOLO BOARD',map:'DISPATCH MAP'})[name] || 'DISPATCH MAP';
 if(name==='map'){initDispatchMap();setTimeout(()=>dispatchMap&&dispatchMap.invalidateSize(),100);}
};
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>switchPanel(b.dataset.panel)));
$('closeBtn').addEventListener('click',()=>nui('close'));
$('modalClose').addEventListener('click',()=>{$('modal').hidden=true;});
$('unitStatus').addEventListener('change',e=>send('setStatus',{status:e.target.value}));
const empty = text => `<div class="empty">${esc(text)}</div>`;
function render(){
 const calls=state.calls||[],units=state.units||[],bolos=state.bolos||[];
 $('callCount').textContent=calls.length;$('statCalls').textContent=calls.length;
 $('statUnits').textContent=units.length;$('statAvailable').textContent=units.filter(u=>u.status==='Available').length;
 $('statBolos').textContent=bolos.length;
 $('callsList').innerHTML=calls.length?calls.map(c=>`<article class="call-card"><div class="call-top"><span class="call-code">${esc(c.call_number||c.id||'CALL')}</span><span class="tag">${esc(c.status||'PENDING')}</span></div><h3>${esc(c.call_type||c.title||'Incident')}</h3><p>${esc(c.location||'Location not provided')} · ${esc(c.postal||'')}</p><p>${esc(c.description||'No additional details.')}</p><div class="call-meta"><span>PRIORITY ${esc(c.priority||'3')}</span><span>UNITS: ${esc((c.units||[]).map(u=>u.callsign||u.name).join(', ')||'UNASSIGNED')}</span><span>${esc(c.created_at||'')}</span></div><div class="call-controls"><select data-status="${esc(c.id)}"><option>Pending</option><option>Dispatched</option><option>On Scene</option><option>Closed</option></select><button class="secondary" data-assign="${esc(c.id)}">ASSIGN ME</button><button class="secondary" data-update="${esc(c.id)}">UPDATE</button></div></article>`).join(''):empty('No active calls in the queue.');
 $('unitsList').innerHTML=units.length?units.map(u=>`<article class="unit-card"><div class="unit-top"><strong>${esc(u.callsign||'UNIT')} · ${esc(u.name||'Officer')}</strong><span class="unit-status">${esc((u.status||'Available').toUpperCase())}</span></div><p>${esc(u.job||'Law Enforcement')}</p><small>${esc(u.current_call||'Not assigned to a call')}</small></article>`).join(''):empty('No units are currently signed into CAD.');
 $('bolosList').innerHTML=bolos.length?bolos.map(b=>`<article class="bolo-card"><span class="call-code">${esc(b.bolo_type||'BOLO')}</span><h3>${esc(b.title||b.subject||'Notice')}</h3><p>${esc(b.description||'')}</p><small>${esc(b.created_at||'')}</small></article>`).join(''):empty('There are no active BOLO notices.');
 drawCallMarkers();
}
function openForm(title,fields,submitName){
 $('modalContent').innerHTML=`<h2>${esc(title)}</h2><form id="modalForm" class="form-grid">${fields.map(f=>f.type==='hidden'?`<input type="hidden" name="${esc(f.name)}" value="${esc(f.value)}">`:`<label class="form-field ${f.full?'full':''}">${esc(f.label)}${f.type==='textarea'?'<textarea class="form-control" name="'+esc(f.name)+'" rows="3" '+(f.required?'required':'')+'></textarea>':f.type==='select'?'<select class="form-control" name="'+esc(f.name)+'">'+f.options.map(o=>'<option>'+esc(o)+'</option>').join('')+'</select>':'<input class="form-control" name="'+esc(f.name)+'" '+(f.required?'required':'')+'>'}</label>`).join('')}<div class="full"><button class="primary form-submit">SUBMIT</button></div></form>`;
 $('modal').hidden=false;
 $('modalForm').addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());send(submitName,data);$('modal').hidden=true;message('Request submitted.');});
}
$('newCallBtn').addEventListener('click',startMapPlacement);
$('newReportBtn').addEventListener('click',()=>openForm('NEW INCIDENT REPORT',[{name:'record_type',label:'REPORT TYPE',type:'select',options:['Incident Report','Arrest Report','Citation']},{name:'subject',label:'SUBJECT / CITIZEN ID',required:true},{name:'title',label:'REPORT TITLE',required:true},{name:'details',label:'NARRATIVE',type:'textarea',full:true,required:true}], 'createRecord'));
$('newBoloBtn').addEventListener('click',()=>openForm('CREATE BOLO',[{name:'bolo_type',label:'BOLO TYPE',type:'select',options:['Person','Vehicle','Other']},{name:'title',label:'SUBJECT / VEHICLE',required:true},{name:'description',label:'DESCRIPTION',type:'textarea',full:true,required:true}], 'createBolo'));
$('searchForm').addEventListener('submit',e=>{e.preventDefault();$('searchResults').innerHTML=empty('Searching records...');send('search',{searchType:$('searchType').value,query:$('searchQuery').value});});
$('callsList').addEventListener('click',e=>{const assign=e.target.closest('[data-assign]'),update=e.target.closest('[data-update]');if(assign)send('assignCall',{callId:assign.dataset.assign});if(update){const id=update.dataset.update;const select=document.querySelector('[data-status="'+CSS.escape(id)+'"]');send('updateCall',{callId:id,status:select?.value||'Pending'});}});
function nearestPostal(x,y){let best=Infinity,hit=null;for(const p of postalData){const d=(p.x-x)**2+(p.y-y)**2;if(d<best){best=d;hit=p;}}return hit;}
function startMapPlacement(){if(state.access!=='dispatch'){message('Only Dispatch can place calls on the map.');return;}switchPanel('map');placingCall=true;$('mapHint').textContent='Click the incident location on the map.';message('Map placement active · click the incident location.');}
function initDispatchMap(){
 if(dispatchMap||!window.L)return;
 const cfg={image:[6144,9216],topLeft:[-4140,8400],bottomRight:[4860,-5100],maxZoom:6};
 const crs=Object.create(L.CRS.Simple);
 const u=cfg.image[0]/((cfg.bottomRight[0]-cfg.topLeft[0])*Math.pow(2,cfg.maxZoom));
 const d=cfg.image[1]/((cfg.bottomRight[1]-cfg.topLeft[1])*Math.pow(2,cfg.maxZoom));
 crs.transformation=new L.Transformation(u,-u*cfg.topLeft[0],d,-d*cfg.topLeft[1]);
 crs.infinite=false;crs.scale=z=>Math.pow(2,z);crs.zoom=s=>Math.log(s)/Math.LN2;crs.distance=(a,b)=>Math.hypot(b.lng-a.lng,b.lat-a.lat);
 const bounds=[[-5100,-4140],[8400,4860]];
 dispatchMap=L.map('clrpDispatchMap',{crs,minZoom:0,maxZoom:6,zoomControl:true,attributionControl:true,maxBounds:bounds,maxBoundsViscosity:1,preferCanvas:true});
 L.tileLayer('https://postal-code-map-tile.pages.dev/tiles/{z}/{x}/{y}.png',{tileSize:256,minZoom:0,maxZoom:6,maxNativeZoom:6,noWrap:true,bounds,attribution:'Four-digit postal map · Virus_City / Acc-Off'}).addTo(dispatchMap);
 dispatchMap.fitBounds(bounds);
 fetch('postals.json').then(r=>{if(!r.ok)throw new Error('Postal coordinate data unavailable');return r.json();}).then(rows=>{postalData=rows.filter(p=>/^\\d{4}$/.test(String(p.code)));$('mapHint').textContent='Postal map ready · Dispatch can place calls by selecting a location.';}).catch(err=>{console.warn(err);$('mapHint').textContent='Map loaded; postal lookup data unavailable.';});
 dispatchMap.on('click',e=>{if(!placingCall)return;placingCall=false;const x=e.latlng.lng,y=e.latlng.lat,postal=nearestPostal(x,y);$('mapHint').textContent='Selected postal: '+(postal?postal.code:'not found')+'. Complete call details.';openForm('CREATE DISPATCH CALL',[{name:'call_type',label:'CALL TYPE',required:true},{name:'location',label:'LOCATION / ADDRESS',required:true},{name:'priority',label:'PRIORITY',type:'select',options:['1 - Emergency','2 - Urgent','3 - Routine','4 - Information']},{name:'description',label:'CALL DETAILS',type:'textarea',full:true},{name:'postal',type:'hidden',value:postal?postal.code:''},{name:'mapX',type:'hidden',value:x.toFixed(2)},{name:'mapY',type:'hidden',value:y.toFixed(2)}],'createCall');});
 $('mapPlaceCall').addEventListener('click',startMapPlacement);$('mapReset').addEventListener('click',()=>dispatchMap.fitBounds(bounds));
}
function drawCallMarkers(){if(!dispatchMap||!window.L)return;const active=new Set();(state.calls||[]).forEach(c=>{if(c.mapX==null||c.mapY==null)return;const x=Number(c.mapX),y=Number(c.mapY);if(!Number.isFinite(x)||!Number.isFinite(y)||x< -4140||x>4860||y< -5100||y>8400)return;active.add(c.id);let marker=callMarkers.get(c.id);const color=String(c.priority||'').startsWith('1')?'#ef4444':String(c.priority||'').startsWith('2')?'#f97316':'#eab308';const icon=L.divIcon({className:'call-marker-wrap',html:'<span class="call-marker" style="--marker-color:'+color+'"></span>',iconSize:[24,24],iconAnchor:[12,12]});if(!marker){marker=L.marker([y,x],{icon,draggable:state.access==='dispatch'}).addTo(dispatchMap);callMarkers.set(c.id,marker);marker.on('dragend',()=>{const p=marker.getLatLng();send('request',{action:'moveCallBlip',callId:c.id,mapX:p.lng,mapY:p.lat});});}else{marker.setLatLng([y,x]);marker.setIcon(icon);if(marker.dragging)state.access==='dispatch'?marker.dragging.enable():marker.dragging.disable();}marker.bindPopup('<b>'+esc(c.call_number)+' · '+esc(c.call_type)+'</b><br>'+esc(c.location)+'<br>Postal '+esc(c.postal||'—')+' · '+esc(c.status));});for(const [id,m] of callMarkers)if(!active.has(id)){dispatchMap.removeLayer(m);callMarkers.delete(id);}}
window.addEventListener('message',e=>{
 const d=e.data||{};
 if(d.action==='open'){document.body.style.setProperty('visibility','visible','important');$('app').hidden=false;}
 if(d.action==='close'){$('app').hidden=true;$('modal').hidden=true;document.body.style.setProperty('visibility','hidden','important');}
 if(d.action==='bootstrap'){state={...state,...(d.data||{})};$('unitName').textContent=state.officer?.callsign||state.officer?.name||'AUTHORIZED UNIT';if(state.status)$('unitStatus').value=state.status;render();message('Secure connection established.');}
 if(d.action==='result'){
  if(d.data?.error){message(d.data.error);return;}
  if(d.data?.calls||d.data?.units||d.data?.bolos){state={...state,...d.data};render();}
  if(d.data?.records){$('searchResults').innerHTML=d.data.records.length?d.data.records.map(r=>`<article class="result-card"><h3>${esc(r.name||r.title||r.plate||'Record')}</h3><p>${esc(r.details||r.description||r.citizenid||r.plate||'')}</p></article>`).join(''):empty('No matching records found.');}
  if(d.data?.message)message(d.data.message);else message('CAD updated.');
 }
});
})();