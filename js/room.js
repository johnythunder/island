/* room.js — екран кімнати: код, посилання, склад, блокування за місткістю, старт (господар). */
IR.room = {
  code:null,
  init(){
    document.getElementById('copyLinkBtn').onclick=()=>this.copy();
    document.getElementById('startGameBtn').onclick=()=>this.start();
    document.getElementById('leaveRoomBtn').onclick=()=>this.leave();
    if(IR.net){ IR.net.on('room', c=>{ if(c===this.code) this.render(); }); }
  },
  create(cap, mode){ const r=IR.net.createRoom(cap, mode);
    if(r.err){ IR.lobby.show(); const m=document.getElementById('homeMsg'); if(m) m.textContent=IR.t(r.err); return; }
    this.open(r.code); },
  async tryJoin(code){ const r=await IR.net.joinRoom(code);
    if(r.err){ IR.lobby.show(); const m=document.getElementById('homeMsg'); if(m) m.textContent=IR.t(r.err); return; }
    const rm=IR.net.getRoom(r.code);
    if(rm && rm.started){ IR.online.enter(r.code); } else { this.open(r.code); } },
  open(code){ this.code=code; this.render(); IR.menu.go('scrRoom'); },
  render(){ const rm=IR.net.getRoom(this.code); if(!rm){ IR.lobby.show(); return; }
    const me=IR.net.me?IR.net.me.name:'', mine=me.toLowerCase();
    document.getElementById('roomCodeT').textContent=rm.code;
    document.getElementById('roomLink').value=IR.net.roomLink(rm.code);
    document.getElementById('roomCount').textContent=rm.members.length+' / '+rm.cap;
    let html='';
    rm.members.forEach(m=>{ const you=m.name.toLowerCase()===mine, host=m.name===rm.host;
      html+='<div class="peer"><span class="dot"></span>'+m.name+(host?' <i>★</i>':'')+(you?' <i>'+IR.t('youSuffix')+'</i>':'')+'</div>'; });
    for(let i=rm.members.length;i<rm.cap;i++) html+='<div class="peer slot"><span class="dot off"></span><i>'+IR.t('emptySlot')+'</i></div>';
    document.getElementById('roomRoster').innerHTML=html;
    // --- вибір колоди ---
    const taken={}; rm.members.forEach(m=>{ if(m.deckIndex!=null) taken[m.deckIndex]=m.name; });
    let dh='';
    IR.DECKS.forEach((dk,di)=>{ const by=taken[di], mineDeck=(by&&by.toLowerCase()===mine);
      const cls='deckPick'+(by?(mineDeck?' mine':' taken'):'');
      dh+='<button class="'+cls+'" data-di="'+di+'"'+((by&&!mineDeck)?' disabled':'')+'>'+
        '<img src="assets/cards/covers/'+dk.file+'" alt=""/>'+
        '<span>'+IR.dname(di)+(by?'<i>'+by+'</i>':'')+'</span></button>'; });
    const dbox=document.getElementById('roomDecks'); dbox.innerHTML=dh;
    dbox.querySelectorAll('.deckPick:not([disabled])').forEach(b=>b.onclick=()=>IR.net.pickDeck(this.code, +b.dataset.di));
    const isHost=(rm.host===me), full=rm.members.length>=rm.cap, allPicked=rm.members.every(m=>m.deckIndex!=null);
    const sb=document.getElementById('startGameBtn'); sb.style.display=isHost?'inline-block':'none'; sb.disabled=!(full&&allPicked);
    const st=document.getElementById('roomStatus');
    st.textContent = rm.started ? IR.t('syncedNext')
      : !full ? IR.t('waitingPlayers')
      : !allPicked ? IR.t('waitDecks')
      : (isHost?'':IR.t('waitHostStart'));
  },
  copy(){ const v=IR.net.roomLink(this.code);
    const done=()=>{ const b=document.getElementById('copyLinkBtn'); const o=b.textContent; b.textContent=IR.t('linkCopied'); setTimeout(()=>b.textContent=IR.t('copyLink'),1500); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(v).then(done).catch(()=>{ this._fallback(v); done(); }); }
    else { this._fallback(v); done(); } },
  _fallback(v){ const i=document.getElementById('roomLink'); i.focus(); i.select(); try{document.execCommand('copy');}catch(e){} },
  start(){ IR.online.hostStart(this.code); },
  leave(){ IR.net.leaveRoom(this.code); this.code=null; IR.lobby.show(); }
};