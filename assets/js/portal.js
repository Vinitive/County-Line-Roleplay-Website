(() => {
 const cfg=window.CLRP_CONFIG||{},api=String(cfg.portalApiUrl||"").replace(/\/$/,""),$=id=>document.getElementById(id);
 $("year").textContent=new Date().getFullYear();
 const showError=message=>{$("authError").textContent=message||"";};
 const authResult=new URLSearchParams(window.location.search).get("auth");
 if(authResult){const messages={failed:"Discord sign-in was cancelled or did not complete.",invalid_state:"Your sign-in session expired. Please try again.",discord_error:"Discord could not complete authentication. Please try again.",profile_error:"We could not retrieve your Discord profile. Please try again."};showError(messages[authResult]||"Discord sign-in could not be completed.");window.history.replaceState({},document.title,window.location.pathname);}
 const request=async path=>{if(!api)throw new Error("The portal API has not been configured yet.");const r=await fetch(api+path,{credentials:"include",headers:{"Accept":"application/json"}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Portal request failed ("+r.status+").");return b;};
 $("discordLogin").addEventListener("click",()=>{showError("");if(!api){showError("Portal backend not configured. Ask a server administrator to finish the secure backend setup.");return;}window.location.href=api+"/auth/discord";});
 if(api)request("/api/me").then(data=>{if(data.authenticated&&data.user)window.location.replace("dashboard.html");}).catch(error=>{if(!/401|Unauthorized/i.test(error.message))showError(error.message);});
})();