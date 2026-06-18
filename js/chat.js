/* chat.js — внутрішньоігровий текстовий чат (справа вгорі). Прямий обмін між учасниками кімнати
   через транспорт (не через стан гри). Згортний, з лічильником непрочитаних. */
IR.chat = {
  code:null, msgs:[], open:false, unread:0,
  toggleEl:null, boxEl:null, logEl:null, inputEl:null,
  init(){
    this.toggleEl=document.getElementById('chatToggle');
    this.boxEl=document.getElementById('chatBox');
    this.logEl=document.getElementById('chatLog');
    this.inputEl=document.getElementById('chatText');
    if(this.toggleEl) this.toggleEl.onclick=()=>this.toggle();
    const sb=document.getElementById('chatSend'); if(sb) sb.onclick=()=>this.send();
    if(this.inputEl) this.inputEl.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); this.send(); } });
    if(IR.net) IR.net.on('chat', m=>this.onMsg(m));
  },
  start(code){ this.code=code; this.msgs=[]; this.open=false; this.unread=0; this.render(); },
  stop(){ this.code=null; this.msgs=[]; this.open=false; this.unread=0;
    if(this.boxEl) this.boxEl.style.display='none'; },
  toggle(){ this.open=!this.open; if(this.open){ this.unread=0; document.body.classList.remove('panelOpen'); setTimeout(()=>this.inputEl&&this.inputEl.focus(),0); } this.render(); },
  esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
  send(){ if(!this.code||!IR.net.me||!this.inputEl) return;
    const t=this.inputEl.value.trim(); if(!t) return;
    IR.net.send({t:'chat', code:this.code, from:IR.net.me.name, text:t.slice(0,300)});
    this.inputEl.value=''; },   // власне повідомлення прилетить через realtime
  onMsg(m){ if(!m||m.code!==this.code) return;
    const mine=IR.net.me&&m.from===IR.net.me.name;
    this.msgs.push(m); if(!this.open && !mine) this.unread++; this.render(); },
  render(){ if(!this.code){ this.stop(); return; }
    const me=IR.net.me?IR.net.me.name:null;
    if(this.toggleEl){ this.toggleEl.innerHTML='💬'+(this.unread?'<span class="chatBadge">'+this.unread+'</span>':''); }
    if(this.boxEl) this.boxEl.style.display=this.open?'flex':'none';
    if(this.inputEl) this.inputEl.placeholder=IR.t('chatPlaceholder');
    if(this.logEl){
      this.logEl.innerHTML=this.msgs.map(m=>{ const mine=m.from===me;
        return '<div class="cm'+(mine?' me':'')+'"><span class="cf">'+this.esc(m.from)+'</span>'+this.esc(m.text)+'</div>'; }).join('');
      this.logEl.scrollTop=this.logEl.scrollHeight; }
  }
};
