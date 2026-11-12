(() => {
 const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||"").replace(/\/$/,""),$=id=>document.getElementById(id);
 $("year").textContent=new Date().getFullYear();
 const request=async(path,options={})=>{if(!api)throw new Error("Portal API is not configured.");const r=await fetch(api+path,{...options,credentials:"include",headers:{"Accept":"application/json",...(options.headers||{})}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Portal request failed ("+r.status+").");return b;};
 const backToLogin=()=>window.location.replace("portal.html");
 request("/api/me").then(data=>{
  if(!data.authenticated||!data.user){backToLogin();return;}
  const user=data.user;
  $("discordName").textContent=user.global_name||user.username||"Discord member";
  $("discordTag").textContent="@"+(user.username||"member");
  $("discordAvatar").src=user.avatar?"https://cdn.discordapp.com/avatars/"+encodeURIComponent(user.id)+"/"+encodeURIComponent(user.avatar)+".png?size=128":"https://cdn.discordapp.com/embed/avatars/0.png";
  $("dashboardMessage").textContent="Your Discord session is active. QBCore character services are not connected yet.";
 }).catch(error=>{$("dashboardMessage").textContent="We could not verify your sign-in session. Please sign in again.";setTimeout(backToLogin,1800);});
 $("signOut").addEventListener("click",async()=>{ $("signOut").disabled=true;try{await request("/api/logout",{method:"POST"});}catch(e){console.warn(e);}backToLogin();});
 $("startLink").addEventListener("click",()=>{$("linkNote").textContent="Secure in-game linking is not active yet. The QBCore verification resource must be installed before a code can be issued.";});
})();