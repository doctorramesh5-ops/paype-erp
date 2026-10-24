/* notify-sara-1 */
(function(){
  var API='https://erpapi.paype.co.in',bell=null,badge=null,panel=null,built=false,recip=null;
  function tok(){try{return localStorage.getItem('erp_token')||'';}catch(e){return '';}}
  function me(){try{return JSON.parse(localStorage.getItem('erp_user')||'null');}catch(e){return null;}}
  function api(m,p,b){return fetch(API+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok()},body:b?JSON.stringify(b):undefined}).then(function(r){return r.json();});}
  function el(t,css,txt){var e=document.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
  function ago(d){var s=Math.max(1,Math.round((Date.now()-new Date(d).getTime())/1000));if(s<60)return 'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';return Math.round(s/86400)+' d ago';}
  function build(){
    if(built)return;built=true;
    var st=el('style');st.textContent='.tb-bell,#notif-panel{display:none!important}';document.head.appendChild(st);
    bell=el('button','position:relative;flex-shrink:0;margin:0 10px;width:34px;height:34px;border-radius:50%;border:1px solid #d9e0e8;background:#fff;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;','🔔');
    bell.title='Notifications';
    badge=el('span','position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;border-radius:9px;background:#e53e3e;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px;','0');
    bell.appendChild(badge);
    panel=el('div','position:fixed;top:52px;right:14px;z-index:1500;width:340px;max-width:calc(100vw - 28px);max-height:75vh;overflow:auto;background:#fff;border:1px solid #d9e0e8;border-radius:12px;box-shadow:0 10px 36px rgba(0,0,0,.2);display:none;font-family:inherit;');
    bell.style.display='none';
    bell.onclick=function(){var open=panel.style.display==='block';panel.style.display=open?'none':'block';if(!open)load(true);};
    var av=document.getElementById('tb-avatar');if(av&&av.parentNode)av.parentNode.insertBefore(bell,av);else{bell.style.position='fixed';bell.style.top='9px';bell.style.right='70px';bell.style.zIndex='1500';document.body.appendChild(bell);}document.body.appendChild(panel);
  }
  function setBadge(n){if(!badge)return;badge.textContent=n>99?'99+':String(n);badge.style.display=n>0?'flex':'none';}
  function composer(){
    var u=me();if(!u||(u.role!=='admin'&&u.role!=='manager'))return null;
    var box=el('div','padding:10px 14px;border-top:1px solid #eef1f5;background:#f8fafc;');
    box.appendChild(el('div','font-size:11px;font-weight:700;color:#4a5568;margin-bottom:6px;','✉ Send a message'));
    var sel=el('select','width:100%;padding:6px;border:1px solid #d9e0e8;border-radius:6px;font-size:12px;margin-bottom:6px;');
    var o=el('option',null,'All employees');o.value='all';sel.appendChild(o);
    var ta=el('textarea','width:100%;box-sizing:border-box;padding:6px;border:1px solid #d9e0e8;border-radius:6px;font-size:12px;height:54px;resize:none;');ta.placeholder='Type your message (max 500 characters)';ta.maxLength=500;
    var btn=el('button','margin-top:6px;padding:7px 14px;border:none;border-radius:6px;background:#00a896;color:#fff;font-size:12px;font-weight:700;cursor:pointer;','Send');
    var msg=el('span','margin-left:8px;font-size:11px;color:#2f855a;','');
    function fill(list){list.forEach(function(p){var op=el('option',null,p.name+' ('+p.role+')');op.value=p.id;sel.appendChild(op);});}
    if(recip)fill(recip);else api('GET','/api/notifications/recipients').then(function(d){if(d.success){recip=d.data;fill(recip);}});
    btn.onclick=function(){var t=ta.value.trim();if(!t){msg.style.color='#c53030';msg.textContent='Type a message';return;}btn.disabled=true;api('POST','/api/notifications/send',{to:sel.value,message:t}).then(function(d){btn.disabled=false;msg.style.color=d.success?'#2f855a':'#c53030';msg.textContent=d.success?'Sent ✓':(d.message||'Failed');if(d.success)ta.value='';});};
    box.appendChild(sel);box.appendChild(ta);box.appendChild(btn);box.appendChild(msg);return box;
  }
  function render(d){
    panel.textContent='';
    var head=el('div','padding:12px 14px;border-bottom:1px solid #eef1f5;display:flex;justify-content:space-between;align-items:center;');
    head.appendChild(el('strong','font-size:13px;color:#102a43;','Notifications'));
    var mk=el('span','font-size:11px;color:#00a896;cursor:pointer;','Mark all read');
    mk.onclick=function(){api('POST','/api/notifications/read',{}).then(function(){load(true);});};
    head.appendChild(mk);panel.appendChild(head);
    if(!d.data.length)panel.appendChild(el('div','padding:22px 14px;font-size:12px;color:#718096;text-align:center;','No notifications yet.'));
    d.data.forEach(function(n){
      var row=el('div','padding:11px 14px;border-bottom:1px solid #f1f4f8;display:flex;gap:10px;cursor:pointer;'+(n.is_read?'':'background:#f0fbf9;'));
      row.appendChild(el('div','width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;background:'+(n.is_read?'#cbd5e0':(n.kind==='message'?'#805ad5':n.kind==='decision'?'#dd6b20':'#00a896'))+';'));
      var c=el('div');c.appendChild(el('div','font-size:12px;font-weight:600;color:#102a43;',n.title));
      if(n.body)c.appendChild(el('div','font-size:12px;color:#4a5568;margin-top:2px;white-space:pre-wrap;',n.body));
      c.appendChild(el('div','font-size:10px;color:#a0aec0;margin-top:3px;',ago(n.created_at)));
      row.appendChild(c);
      row.onclick=function(){api('POST','/api/notifications/read',{id:n.id}).then(function(){if(n.link)window.location=n.link;else load(true);});};
      panel.appendChild(row);
    });
    var cp=composer();if(cp)panel.appendChild(cp);
  }
  function load(draw){
    if(!tok())return;
    api('GET','/api/notifications').then(function(d){if(!d||!d.success)return;build();setBadge(d.unread||0);if(draw&&panel.style.display==='block')render(d);}).catch(function(){});
  }
  /* ui-fixes-1 */
  var lastLoad=0;
  function appShown(){var a=document.getElementById('erp-app');if(!a)return false;var s=getComputedStyle(a);return s.display!=='none'&&a.offsetParent!==null;}
  function sync(){if(!built)return;var on=!!tok()&&appShown();bell.style.display=on?'flex':'none';if(!on)panel.style.display='none';}
  function tick(){var on=!!tok()&&appShown();if(on&&(!built||Date.now()-lastLoad>60000)){lastLoad=Date.now();load(false);}sync();}
  setInterval(tick,2000);setTimeout(tick,800);
  document.addEventListener('click',function(e){if(panel&&panel.style.display==='block'&&!panel.contains(e.target)&&e.target!==bell&&!bell.contains(e.target))panel.style.display='none';});
})();
