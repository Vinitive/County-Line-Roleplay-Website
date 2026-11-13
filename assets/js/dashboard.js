(() => {
 const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||"").replace(/\/$/,""),$=id=>document.getElementById(id);
 $("year").textContent=new Date().getFullYear();

 const request=async(path,options={})=>{
  if(!api)throw new Error("Portal API is not configured.");
  const r=await fetch(api+path,{
   ...options,
   credentials:"include",
   headers:{"Accept":"application/json",...(options.headers||{})}
  });
  const b=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(b.error||"Portal request failed ("+r.status+").");
  return b;
 };

 const login=()=>window.location.replace("portal.html");
 const showView=name=>{
  document.querySelectorAll(".dash-view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
  document.querySelectorAll(".dash-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("viewCrumb").textContent=name.toUpperCase().replace("MY ","");
 };
 document.querySelectorAll(".dash-nav button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));

 const logout=async()=>{
  try{await request("/api/logout",{method:"POST"});}catch(e){console.warn(e);}
  login();
 };
 $("signOut").addEventListener("click",logout);
 $("settingsSignOut").addEventListener("click",logout);

 const node=(tag,className,text)=>{
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined&&text!==null)element.textContent=String(text);
  return element;
 };
 const money=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value)||0);
 const formatPlaytime=value=>{
  const hours=Math.floor((Number(value)||0)/3600),minutes=Math.floor(((Number(value)||0)%3600)/60);
  return hours+"h "+minutes+"m";
 };
 const addMetric=(parent,label,value)=>{
  const item=node("div","character-metric");
  item.append(node("small","",label),node("strong","",value));
  parent.append(item);
 };
 const addDetails=(parent,title,items,formatter,emptyText)=>{
  const details=node("details","character-details");
  const summary=node("summary","",title+" ("+(items||[]).length+")");
  const list=node("ul","character-detail-list");
  (items||[]).forEach(item=>list.append(node("li","",formatter(item))));
  if(!items||!items.length)list.append(node("li","muted-detail",emptyText||"No records to display."));
  details.append(summary,list);
  parent.append(details);
 };
 const renderCharacters=characters=>{
  const list=$("characterList");
  const totals=(characters||[]).reduce((sum,c)=>({
   seconds:sum.seconds+(Number(c.playtimeSeconds)||0),
   sessions:sum.sessions+(Number(c.sessionsCount)||0)
  }),{seconds:0,sessions:0});
  if($("overviewPlaytime"))$("overviewPlaytime").textContent=formatPlaytime(totals.seconds);
  if($("activityPlaytime"))$("activityPlaytime").textContent=formatPlaytime(totals.seconds);
  if($("activitySessions"))$("activitySessions").textContent=String(totals.sessions);
  const joined=(characters||[]).map(c=>Number(c.firstJoined)||0).filter(Boolean).sort((a,b)=>a-b)[0];
  if($("activityFirstJoined"))$("activityFirstJoined").textContent=joined?new Date(joined).toLocaleDateString():"—";
  if(!list)return;
  list.replaceChildren();

  if(!characters||!characters.length){
   list.append(node("div","dash-panel character-list-empty",""));
   const empty=list.firstChild;
   empty.append(node("b","","NO LINKED CHARACTERS YET"));
   empty.append(node("p","","Generate a linking code above, then use /linkportal CODE in-game."));
   $("characterRefreshStatus").textContent="NO CHARACTERS LINKED";
   $("characterStatus").textContent="NOT LINKED";
   $("settingsCharacter").textContent="NOT LINKED";
   if($("overviewCharacterTitle"))$("overviewCharacterTitle").textContent="NO CHARACTER LINKED";
   if($("overviewCharacterSummary"))$("overviewCharacterSummary").textContent="Link a FiveM character to see its profile, finances, job, vehicles, and properties here.";
   return;
  }

  $("characterRefreshStatus").textContent="AUTO-REFRESH · 30 SECONDS";
  $("characterStatus").textContent=characters.length+" LINKED";
  $("settingsCharacter").textContent=characters.length+" LINKED";
  if($("overviewCharacterTitle"))$("overviewCharacterTitle").textContent=characters.length+" CHARACTER"+(characters.length===1?"":"S")+" LINKED";
  if($("overviewCharacterSummary"))$("overviewCharacterSummary").textContent="Your "+characters.length+" linked character"+(characters.length===1?" is":"s are")+" available in My Character. Select a character to view its latest server information.";

  characters.forEach(character=>{
   const data=character.data||{};
   const profile=data.profile||{};
   const moneyData=data.money||{};
   const job=data.job||{};
   const gang=data.gang||{};
   const records=data.records||{};
   const card=node("article","dash-panel character-card");
   const header=node("div","character-card-header");
   const identity=node("div","character-card-identity");
   identity.append(node("span","section-kicker","CITIZEN ID · "+(character.citizenid||"—")));
   identity.append(node("h3","",character.characterName||"Unknown Character"));
   const status=node("span",character.isOnline?"character-online":"character-offline",character.isOnline?"ONLINE":"OFFLINE");
   header.append(identity,status);
   card.append(header);

   const metrics=node("div","character-metrics");
   addMetric(metrics,"CASH",money(moneyData.cash));
   addMetric(metrics,"BANK",money(moneyData.bank));
   addMetric(metrics,"JOB",(job.label||job.name||"Unemployed")+(job.gradeName?" · "+job.gradeName:""));
   addMetric(metrics,"GANG",gang.label||gang.name||"None");
   card.append(metrics);

   const profileText=[
    profile.birthdate?"DOB: "+profile.birthdate:"",
    profile.gender!==undefined?"Gender: "+(Number(profile.gender)===0?"Male":Number(profile.gender)===1?"Female":profile.gender):"",
    profile.nationality?"Nationality: "+profile.nationality:""
   ].filter(Boolean).join("  ·  ");
   if(profileText)card.append(node("p","character-profile-line",profileText));

   const vehicles=data.vehicles||[];
   const houses=data.houses||[];
   addDetails(card,"Vehicles",vehicles,v=>(v.label||v.model||"Vehicle")+" · Plate "+(v.plate||"—")+" · Garage "+(v.garage||"Unknown")+" · State "+(v.state===undefined?"Unknown":v.state),"No owned vehicles found.");
   addDetails(card,"Properties",houses,h=>(h.label||h.id||"Property"),"No owned properties found.");
   addDetails(card,"Arrest history",records.arrests||[],a=>(a.title||"Arrest record")+" · "+(a.datecreated||"Date unavailable"),"No arrest records found.");
   addDetails(card,"Recorded charges",records.charges||[],c=>(c.charge||"Charge")+" × "+(c.count||1)+" · Fine "+money(c.fine)+" · "+(c.datecreated||"Date unavailable"),"No recorded charges found.");
   addDetails(card,"Recorded fines",records.fines||[],f=>(f.charge||f.title||"Fine")+" · "+money(f.amount)+" · "+(f.date||"Date unavailable"),"No recorded fines found.");
   card.append(node("small","character-sync-time","LAST SYNC: "+(data.syncedAt?new Date(data.syncedAt*1000).toLocaleString():"Awaiting first sync")));
   list.append(card);
  });
 };

 const refreshServerStatus=async()=>{
  try{
   const status=await request("/api/server-status");
   const value=$("serverStatusValue"),detail=$("serverStatusDetail");
   if(value){value.textContent=status.online?"ONLINE":"OFFLINE";value.classList.toggle("stat-muted",!status.online);}
   if(detail)detail.textContent=status.online?(status.players+" / "+status.maxPlayers+" PLAYERS"):"No recent server heartbeat";
  }catch(error){
   if($("serverStatusValue")){$("serverStatusValue").textContent="UNAVAILABLE";$("serverStatusValue").classList.add("stat-muted");}
   if($("serverStatusDetail"))$("serverStatusDetail").textContent="Live status feed unavailable";
   console.warn("Server status refresh:",error.message);
  }
 };

 const refreshCharacters=async()=>{
  try{
   const result=await request("/api/characters");
   renderCharacters(result.characters||[]);
  }catch(error){
   if($("characterRefreshStatus"))$("characterRefreshStatus").textContent="SYNC NOT AVAILABLE";
   if($("linkNote")&&/404|Not found/i.test(error.message)){
    $("linkNote").textContent="The Cloudflare character API routes still need to be installed and deployed.";
   }
   console.warn("Character portal refresh:",error.message);
  }
 };

 $("startLink").addEventListener("click",async()=>{
  const button=$("startLink");
  const note=$("linkNote");
  button.disabled=true;
  button.textContent="GENERATING CODE...";
  note.textContent="Creating a secure one-time linking code...";
  try{
   const result=await request("/api/link-code",{method:"POST"});
   $("linkCode").textContent=result.code;
   $("linkCodeBox").hidden=false;
   $("linkExpiry").textContent="Expires at "+new Date(result.expiresAt).toLocaleTimeString()+" (10 minutes)";
   note.textContent="In FiveM, load the character you want to link and enter /linkportal "+result.code;
  }catch(error){
   note.textContent=error.message;
  }finally{
   button.disabled=false;
   button.textContent="GENERATE ANOTHER LINKING CODE →";
  }
 });

 request("/api/me").then(async data=>{
  if(!data.authenticated||!data.user){login();return;}
  const u=data.user,name=u.global_name||u.username||"Discord member",tag="@"+(u.username||"member");
  const avatar=u.avatar?"https://cdn.discordapp.com/avatars/"+encodeURIComponent(u.id)+"/"+encodeURIComponent(u.avatar)+".png?size=128":"https://cdn.discordapp.com/embed/avatars/0.png";
  $("discordName").textContent=name;
  $("discordTag").textContent=tag;
  ["overviewAvatar","settingsAvatar"].forEach(id=>$(id).src=avatar);
  ["overviewName","settingsName"].forEach(id=>$(id).textContent=name);
  ["overviewTag","settingsTag"].forEach(id=>$(id).textContent=tag);
  await refreshCharacters();
  await refreshServerStatus();
  window.setInterval(refreshCharacters,30000);
  window.setInterval(refreshServerStatus,30000);
 }).catch(error=>{
  $("viewCrumb").textContent="SESSION ERROR";
  const p=document.createElement("p");
  p.className="dash-session-error";
  p.textContent="Unable to verify your portal session. Returning to sign in...";
  document.querySelector(".dash-content").prepend(p);
  setTimeout(login,1800);
 });
})();