(() => {
 const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||"").replace(/\/$/,""),$=id=>document.getElementById(id);
 $("year").textContent=new Date().getFullYear();
 const request=async(path,options={})=>{if(!api)throw new Error("Portal API is not configured.");const r=await fetch(api+path,{...options,credentials:"include",headers:{"Accept":"application/json",...(options.headers||{})}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Portal request failed ("+r.status+").");return b;};
 const login=()=>window.location.replace("portal.html");
 const showView=name=>{document.querySelectorAll(".dash-view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));document.querySelectorAll(".dash-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));$("viewCrumb").textContent=name.toUpperCase().replace("MY ","");};
 document.querySelectorAll(".dash-nav button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
 const logout=async()=>{try{await request("/api/logout",{method:"POST"});}catch(e){console.warn(e);}login();};
 $("signOut").addEventListener("click",logout);$("settingsSignOut").addEventListener("click",logout);
 $("startLink").addEventListener("click",()=>{$("linkNote").textContent="Secure in-game linking is not active yet. The QBCore verification resource must be installed before a code can be issued.";});
 request("/api/me").then(data=>{
  if(!data.authenticated||!data.user){login();return;}
  const u=data.user,name=u.global_name||u.username||"Discord member",tag="@"+(u.username||"member");
  const avatar=u.avatar?"https://cdn.discordapp.com/avatars/"+encodeURIComponent(u.id)+"/"+encodeURIComponent(u.avatar)+".png?size=128":"https://cdn.discordapp.com/embed/avatars/0.png";
  $("discordName").textContent=name;$("discordTag").textContent=tag;
  ["overviewAvatar","settingsAvatar"].forEach(id=>$(id).src=avatar);
  ["overviewName","settingsName"].forEach(id=>$(id).textContent=name);
  ["overviewTag","settingsTag"].forEach(id=>$(id).textContent=tag);
 }).catch(error=>{$("viewCrumb").textContent="SESSION ERROR";const p=document.createElement("p");p.className="dash-session-error";p.textContent="Unable to verify your portal session. Returning to sign in...";document.querySelector(".dash-content").prepend(p);setTimeout(login,1800);});
})();