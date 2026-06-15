/* lobby.js — домашній екран після входу: «хто на острові» + вхід у гру. (Чат — пізніше.) */
IR.lobby = {
  init(){
    document.getElementById('btnNewGame').onclick=()=>IR.menu.go('scrMode');
    document.getElementById('btnOptions').onclick=()=>IR.menu.info(IR.t('options'), '<p>'+IR.t('optBody')+'</p>');
    const dev=document.getElementById('btnDevHome'); if(dev) dev.onclick=()=>IR.menu.info(IR.t('developers'), '<p>'+IR.t('devBody')+'</p>');
    document.getElementById('btnLogout').onclick=()=>IR.auth.logout();
    if(IR.net) IR.net.on('peers', ()=>{ if(this.visible()) this.renderPeers(); });
  },
  visible(){ const e=document.getElementById('scrHome'); return e && e.classList.contains('show'); },
  show(){ const m=document.getElementById('homeMsg'); if(m) m.textContent=''; this.refresh(); IR.menu.go('scrHome'); },
  refresh(){ this.renderHeader(); this.renderPeers(); },
  renderHeader(){ const h=document.getElementById('homeHello');
    if(h) h.innerHTML=IR.t('hello',{name: IR.net.me?IR.net.me.name:''}); },
  renderPeers(){ const box=document.getElementById('onlineList'); if(!box) return;
    const list=IR.net.online(), others=list.filter(p=>!p.self);
    let html=list.map(p=>'<div class="peer"><span class="dot"></span>'+p.name+(p.self?' <i>'+IR.t('youSuffix')+'</i>':'')+'</div>').join('');
    if(!others.length) html+='<div class="hint">'+IR.t('nobodyElse')+'</div>';
    box.innerHTML=html; }
};