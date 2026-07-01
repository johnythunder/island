/* online.js — синхронна партія. Господар = джерело істини.
   Фази ходу: 'move' (активний кидає → рух + подія) → 'opp' (активний кидає → лосування опонента)
              → 'pick' (активний, потім опонент ТАЄМНО обирають; відьмо — авто) → наступний хід.
   Кожен гравець-людина завжди бачить СВОЮ колоду (перегляд); коли його черга — вона стає вибором. */
IR.online = {
  code:null, isHost:false, state:null, _shownSeq:0, _decksFor:null, _busy:false,

  init(){
    if(!IR.net) return;
    IR.net.on('roomStart', code=>{                      // переходимо в гру ЛИШЕ якщо ми член цієї кімнати
      const rm=IR.net.getRoom(code); if(!rm||!IR.net.me) return;
      const mine=IR.net.me.name.toLowerCase();
      if(!rm.members.some(m=>m.name.toLowerCase()===mine)) return;
      if(this.code!==code) this.enter(code); });
    IR.net.on('gs', m=>{ if(m && m.code===this.code){ this.state=m.state; this.render(); } });
    IR.net.on('gi', m=>{ if(!this.isHost || !m || m.code!==this.code || !this.state) return;
      if(m.act==='roll') this.tryRoll(m.by); else if(m.act==='pick') this.tryPick(m.by, m.r); });
  },

  pname(p){ return p.isWidmo ? IR.t('widmoWord')+' '+p.num : p.name; },
  pidName(pi){ const p=this.state.participants[pi]; return p.isWidmo?null:p.name; },

  hostStart(code){ this.code=code; this.isHost=true;
    const rm=IR.net.getRoom(code); if(!rm) return;
    this.state=this.buildState(rm); IR.net.startRoom(code);
    this.enterBoard(); this.broadcast(); this.render(); },
  enter(code){ this.code=code; const rm=IR.net.getRoom(code);
    this.isHost = !!(rm && IR.net.me && rm.host===IR.net.me.name);
    this.enterBoard(); if(rm && rm.state){ this.state=rm.state; this.render(); } },

  buildState(rm){
    const P=[];
    rm.members.forEach((m,i)=>{ const di=(m.deckIndex!=null)?m.deckIndex:i;
      P.push({name:m.name, color:IR.DECKS[di].c, deckIndex:di, isWidmo:false, used:[]}); });
    const H=rm.members.length, wid = H===1?2 : H===2?1 : 0;
    const taken=new Set(P.map(p=>p.deckIndex)); const rem=[]; for(let k=0;k<IR.DECKS.length;k++) if(!taken.has(k)) rem.push(k);
    for(let w=0;w<wid;w++){ const di=rem[w%Math.max(rem.length,1)];
      P.push({name:'', num:w+1, color:IR.DECKS[di].c, deckIndex:di, isWidmo:true, used:[]}); }
    const pawns=[]; P.forEach((p,idx)=>{ if(!p.isWidmo) pawns.push({pi:idx, pos:0, color:p.color}); });
    return {code:rm.code, host:rm.host, participants:P, pawns, turn:0, played:[], stack:[],
            phase:'move', pending:null, finished:false, events:[], rollSeq:0, lastSum:0, lastEvent:0, lastDice:[1,1]};
  },

  enterBoard(){ this._decksFor=null; this._shownSeq=0;
    try{ sessionStorage.setItem('island_curRoom', this.code); }catch(e){}
    ['scoreBox','revealBox'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
    IR.cards.clearEvent(); IR.interaction.reset(); IR.interaction.close();
    const rb=document.getElementById('rollBtn'); if(rb){ rb.onclick=()=>this.rollClick(); rb.style.display='none'; }
    IR.dice.tableMount(); IR.dice.tableShow(true); IR.dice.setLive(false); this._oppDoneSeq=0; this._oppAnim=false;
    const tm=document.getElementById('toMenu'); if(tm) tm.onclick=()=>this.leave();
    const sb=document.getElementById('scoreBtn'); if(sb) sb.style.display='none';
    const lg=document.getElementById('log'); if(lg) lg.innerHTML='';
    if(IR.chat) IR.chat.start(this.code);
    IR.menu.go(null);
  },
  leave(){ try{ sessionStorage.removeItem('island_curRoom'); }catch(e){}
    this.code=null; this.state=null; this.isHost=false; this._decksFor=null;
    IR.interaction.close(); if(IR.chat) IR.chat.stop(); if(IR.dice) IR.dice.tableShow(false); IR.lobby.show(); },

  d(){ return 1+Math.floor(Math.random()*6); },
  rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; },
  availOf(p){ const u=p.used||[]; const a=[]; for(let i=0;i<IR.REACTIONS.length;i++) if(u.indexOf(i)<0) a.push(i);
    return a.length?a:IR.REACTIONS.map((_,i)=>i); },

  // ---- дії гравця ----
  rollClick(){ const s=this.state; if(!s||s.finished||(s.phase!=='move'&&s.phase!=='opp')) return;
    const pw=s.pawns[s.turn]; if(!pw) return; const me=IR.net.me?IR.net.me.name:null;
    if(this.pidName(pw.pi)!==me) return;
    const rb=document.getElementById('rollBtn'); if(rb) rb.disabled=true;
    if(this.isHost) this.tryRoll(me); else IR.net.send({t:'gi', code:this.code, act:'roll', by:me}); },
  sendPick(ri){ const me=IR.net.me?IR.net.me.name:null; if(me==null) return;
    if(this.isHost) this.tryPick(me, ri); else IR.net.send({t:'gi', code:this.code, act:'pick', by:me, r:ri}); },

  // ---- логіка господаря ----
  tryRoll(by){ const s=this.state; if(s.finished) return;
    const pw=s.pawns[s.turn]; if(!pw||this.pidName(pw.pi)!==by) return;
    if(s.phase==='move') this.applyMove(); else if(s.phase==='opp') this.applyOpp(); },

  applyMove(){ const s=this.state; if(this._busy) return; this._busy=true;
    const pw=s.pawns[s.turn], d1=this.d(), d2=this.d(), sum=d1+d2;
    let pos=pw.pos; for(let i=0;i<sum;i++) pos=(pos+1)%25;
    const played=new Set(s.played); const open=c=>c>=1&&c<=24&&!played.has(c);
    let g=0; while(!open(pos)&&g<26){ pos=(pos+1)%25; g++; }
    pw.pos=pos; const num=pos; played.add(num); s.played=Array.from(played);
    s.rollSeq++; s.lastSum=sum; s.lastEvent=num; s.lastDice=[d1,d2];
    s.events.unshift({k:'move', a:pw.pi, sum, cell:num, n:s.played.length});
    s.phase='opp'; this._busy=false; this.broadcast(); this.render(); },

  applyOpp(){ const s=this.state; if(this._busy) return; this._busy=true;
    const pw=s.pawns[s.turn], aPi=pw.pi, P=s.participants, d1=this.d(), d2=this.d(), r2=d1+d2;
    const others=[]; for(let k=1;k<P.length;k++) others.push((aPi+k)%P.length);   // за годинниковою від лівого (5.2)
    const bPi=others[(r2-1)%others.length];
    s.rollSeq++; s.lastSum=r2; s.lastDice=[d1,d2];
    s.events.unshift({k:'opp', r2, b:bPi});
    s.pending={sit:s.lastEvent, aPi, bPi, need:'a', aR:null}; s.phase='pick';
    this._busy=false; this.broadcast(); this.render(); },

  tryPick(by, ri){ const s=this.state; if(!s||s.phase!=='pick'||!s.pending) return;
    const pd=s.pending, pi=pd.need==='a'?pd.aPi:pd.bPi, p=s.participants[pi];
    if(p.isWidmo || p.name!==by) return;
    ri=+ri; if(!(ri>=0&&ri<IR.REACTIONS.length)) return;
    if((p.used||[]).indexOf(ri)>=0) return;
    this.applyPick(pi, ri); },

  applyPick(pi, ri){ const s=this.state, pd=s.pending; if(!pd) return;
    const p=s.participants[pi]; p.used=p.used||[]; p.used.push(ri);
    s.events.unshift({k:'pick', p:pi});
    if(pd.need==='a'){ pd.aR=ri; const b=s.participants[pd.bPi];
      if(b.isWidmo){ const ib=this.rand(this.availOf(b)); b.used.push(ib);
        s.events.unshift({k:'pick', p:pd.bPi}); this.completePair(ib); return; }
      pd.need='b'; this.broadcast(); this.render(); return; }
    this.completePair(ri); },

  completePair(bR){ const s=this.state, pd=s.pending;
    s.stack.push({sit:pd.sit, a:{pi:pd.aPi, r:pd.aR}, b:{pi:pd.bPi, r:bR}});
    s.events.unshift({k:'pair', a:pd.aPi, b:pd.bPi, n:s.stack.length});
    s.pending=null;
    if(s.played.length>=24){
      s.phase='reveal'; s.revealIdx=0;
      s.revealOrder=s.stack.map((e,i)=>i);  // у порядку розіграшу: перша зіграна — перша
      s.scores=s.participants.map(()=>0);
    } else { s.phase='move'; s.turn=(s.turn+1)%s.pawns.length; }
    this.broadcast(); this.render(); },

  // ---- розбір (модерує господар) ----
  scorePair(pair){ const ra=pair.a.r, rb=pair.b.r;
    if(ra===rb) return 3;                                   // однакова реакція
    if(IR.REACTIONS[ra].g===IR.REACTIONS[rb].g) return 1;   // та сама група (колір)
    return 0; },
  revealClick(){ if(this.isHost) this.revealNext(); },
  revealNext(){ const s=this.state; if(s.phase!=='reveal') return;
    if(s.revealIdx>=s.revealOrder.length){ s.phase='done'; s.finished=true; this.broadcast(); this.render(); return; }
    const pair=s.stack[s.revealOrder[s.revealIdx]], pts=this.scorePair(pair);
    s.scores[pair.a.pi]+=pts; s.scores[pair.b.pi]+=pts; s.revealIdx++;
    this.broadcast(); this.render(); },

  broadcast(){ IR.net.send({t:'gs', code:this.code, state:this.state}); },

  // ---- рендер ----
  render(){ const s=this.state; if(!s) return;
    const dk=s.code+':'+s.participants.length;
    if(this._decksFor!==dk){ IR.cards.placeDecks(s.participants.map(p=>Object.assign({},p,{short:this.pname(p)}))); this._decksFor=dk; }
    this.renderPawns(s);
    if(s.rollSeq && s.rollSeq!==this._shownSeq){ this._shownSeq=s.rollSeq; if(IR.dice.tableRoll) IR.dice.tableRoll(s.lastDice[0], s.lastDice[1]); if(IR.dice.flash) IR.dice.flash(s.lastSum); }
    if(s.lastEvent) IR.cards.showEvent(s.lastEvent);
    IR.interaction.pile=(s.stack||[]).slice(); IR.interaction.renderPile();
    const lg=document.getElementById('log'); if(lg) lg.innerHTML=(s.events||[]).map(e=>'<div class="l">'+this.fmt(e)+'</div>').join('');
    if(s.phase==='reveal'||s.phase==='done'){
      IR.dice.setLive(false); IR.dice.tableShow(false);
      IR.interaction.close();
      const tn=document.getElementById('turnName'); if(tn) tn.innerHTML='<b class="done">'+(s.phase==='done'?IR.t('gameOver'):IR.t('revealProgress',{i:s.revealIdx}))+'</b>';
      this.renderReveal(s);
    } else {
      const sb=document.getElementById('scoreBox'), rv=document.getElementById('revealBox');
      if(sb) sb.style.display='none'; if(rv) rv.style.display='none';
      IR.dice.tableShow(true);
      // підсвічування опонента по черзі — один раз на кидок опонента
      if(s.phase==='pick' && s.pending && s.rollSeq!==this._oppDoneSeq){
        this._oppDoneSeq=s.rollSeq; this._oppAnim=true;
        this.highlightOpp(s, ()=>{ this._oppAnim=false; this.render(); });
      }
      this.renderTurn(s); this.renderMyDeck(s);
    }
    this.applyPairHighlight(s);
  },

  applyPairHighlight(s){
    const clear=()=>document.querySelectorAll('#sandDecks .seatPair').forEach(e=>e.classList.remove('seatPair'));
    if(s.phase==='pick' && s.pending && !this._oppAnim){
      clear();
      [s.pending.aPi, s.pending.bPi].forEach(pi=>{ const el=document.querySelector('#sandDecks [data-pi="'+pi+'"]'); if(el) el.classList.add('seatPair'); });
    } else if(s.phase!=='pick'){ clear(); }
  },

  renderReveal(s){ const isHost=this.isHost, P=s.participants;
    const sb=document.getElementById('scoreBox'), rv=document.getElementById('revealBox'); if(!sb||!rv) return;
    sb.style.display='block'; rv.style.display='block';
    const maxsc=Math.max.apply(null, s.scores.concat([0]));
    sb.innerHTML='<div class="rvTitle">'+IR.t('scoreTitle')+'</div><table class="scoreTbl">'+
      P.map((p,i)=>{ const lead=(s.phase==='done'&&s.scores[i]===maxsc&&maxsc>0);
        return '<tr'+(lead?' class="lead"':'')+'><td><span class="pill" style="background:'+p.color+'"></span>'+this.pname(p)+'</td><td class="sc">'+s.scores[i]+'</td></tr>'; }).join('')+'</table>';
    const hostBtn=lbl=>isHost?'<button class="mbtn" id="revealNextBtn">'+lbl+'</button>':'<div class="rvWait">'+IR.t('revealWait')+'</div>';
    if(s.phase==='done'){
      rv.innerHTML='<div class="rvTitle">'+IR.t('gameOver')+'</div>'+
        (maxsc>0?'<div class="rvHint">'+IR.t('topResonance')+': <b>'+P.filter((p,i)=>s.scores[i]===maxsc).map(p=>this.pname(p)).join(', ')+'</b></div>':'')+
        '<button class="mbtn" id="revealDoneBtn">'+IR.t('toLobby')+'</button>';
      const b=document.getElementById('revealDoneBtn'); if(b) b.onclick=()=>this.leave(); return;
    }
    if(s.revealIdx===0){
      rv.innerHTML='<div class="rvTitle">'+IR.t('revealTitle')+'</div><div class="rvHint">'+IR.t('revealHint0')+'</div>'+hostBtn(IR.t('revealNext'));
    } else {
      const pair=s.stack[s.revealOrder[s.revealIdx-1]], A=P[pair.a.pi], B=P[pair.b.pi];
      const ra=IR.REACTIONS[pair.a.r], rb=IR.REACTIONS[pair.b.r], pts=this.scorePair(pair);
      const lbl=pts===3?IR.t('lblIdentical'):pts===1?IR.t('lblGroup'):IR.t('lblDiff');
      const side=(p,rc)=>'<div class="rvSide"><div class="rvName"><span class="pill" style="background:'+p.color+'"></span>'+this.pname(p)+'</div>'+IR.cards.reactionFace(rc)+'</div>';
      rv.innerHTML='<div class="rvTitle">'+IR.t('revealProgress',{i:s.revealIdx})+'</div>'+
        '<div class="rvEvent"><b>'+pair.sit+'</b> '+IR.sit(pair.sit)+'</div>'+
        '<div class="rvPair">'+side(A,ra)+'<div class="rvPts p'+pts+'">+'+pts+'<span>'+lbl+'</span></div>'+side(B,rb)+'</div>'+
        hostBtn(s.revealIdx>=s.revealOrder.length?IR.t('revealFinish'):IR.t('revealNext'));
    }
    const nb=document.getElementById('revealNextBtn'); if(nb) nb.onclick=()=>this.revealClick();
  },

  renderTurn(s){ const me=IR.net.me?IR.net.me.name:null;
    const tn=document.getElementById('turnName');
    let label='', rollOn=false;
    if(s.finished){ label='<b class="done">'+IR.t('allPlayed')+'</b>'; }
    else { const pw=s.pawns[s.turn], aP=s.participants[pw.pi], meActive=(aP.name===me);
      const pill='<span class="pill" style="background:'+aP.color+'"></span>';
      if(s.phase==='move'){ rollOn=meActive; label=pill+(meActive?IR.t('yourTurn'):IR.t('turnOf',{name:this.pname(aP)})); }
      else if(s.phase==='opp'){ rollOn=meActive; label=pill+(meActive?IR.t('rollOpponent'):IR.t('turnOf',{name:this.pname(aP)})); }
      else { const pd=s.pending, pkr=s.participants[pd.need==='a'?pd.aPi:pd.bPi];
        label='<span class="pill" style="background:'+pkr.color+'"></span>'+IR.t('waitingPick',{name:this.pname(pkr)}); } }
    IR.dice.setLive(rollOn && !this._oppAnim); if(tn) tn.innerHTML=label;
  },

  renderMyDeck(s){ const me=IR.net.me?IR.net.me.name:null;
    if(s.finished || !me){ IR.interaction.close(); return; }
    const myP=s.participants.find(p=>!p.isWidmo && p.name===me);
    if(!myP){ IR.interaction.close(); return; }                  // глядач без колоди
    let mode='view', onPick=null;
    if(s.phase==='pick' && s.pending && !this._oppAnim){ const pkrPi=s.pending.need==='a'?s.pending.aPi:s.pending.bPi;
      if(s.participants[pkrPi].name===me){ mode='pick'; onPick=ri=>this.sendPick(ri); } }
    IR.interaction.showDeck(myP, mode, this.availOf(myP), onPick);
  },

  fmt(e){ const P=this.state.participants, nm=pi=>'<b>'+this.pname(P[pi])+'</b>';
    switch(e.k){
      case 'move': return nm(e.a)+' 🎲'+e.sum+' → '+IR.t('cellAbbr')+e.cell+': <b>'+IR.sit(e.cell)+'</b> <i>('+e.n+'/24)</i>';
      case 'opp':  return '🎲'+e.r2+' → '+IR.t('opponentIs')+' '+nm(e.b);
      case 'pick': return nm(e.p)+' '+IR.t('pickedReaction');
      case 'pair': return IR.t('pairPlayed')+' '+nm(e.a)+' ↔ '+nm(e.b)+' · '+IR.t('reactionsClosed')+' · '+IR.t('pileWord')+' '+e.n+'/24';
      default: return ''; } },

  coverFor(color){ const d=IR.DECKS.find(d=>d.c===color)||IR.DECKS[0]; return 'assets/cards/covers/'+d.file; },
  idolSVG(color,n){ const g='cc'+n+Math.random().toString(36).slice(2,6); const cover=this.coverFor(color);
    return '<svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'+
      '<defs>'+
        '<clipPath id="'+g+'c"><circle cx="30" cy="26" r="19"/></clipPath>'+
        '<radialGradient id="'+g+'l" cx="34%" cy="26%" r="80%">'+
          '<stop offset="0%" stop-color="#fff" stop-opacity=".5"/>'+
          '<stop offset="46%" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
        '<radialGradient id="'+g+'d" cx="50%" cy="50%" r="62%">'+
          '<stop offset="48%" stop-color="#000" stop-opacity="0"/>'+
          '<stop offset="100%" stop-color="#000" stop-opacity=".6"/></radialGradient>'+
      '</defs>'+
      '<ellipse cx="30" cy="65" rx="15" ry="3.2" fill="rgba(0,0,0,.28)"/>'+
      '<g class="legs" stroke="#2a1c10" stroke-width="3.2" fill="none" stroke-linecap="round">'+
        '<path class="legL" d="M25 43 Q23 53 24 59"/><path class="legR" d="M35 43 Q37 53 36 59"/></g>'+
      '<ellipse class="shoeL" cx="21.5" cy="60" rx="5" ry="2.9" fill="#17100a"/>'+
      '<ellipse class="shoeR" cx="38.5" cy="60" rx="5" ry="2.9" fill="#17100a"/>'+
      '<g class="arms" stroke="#2a1c10" stroke-width="3" fill="none" stroke-linecap="round">'+
        '<path d="M14 30 Q6 35 8 42"/><path d="M46 30 Q54 35 52 42"/></g>'+
      '<circle cx="8" cy="43" r="3.4" fill="#fff" stroke="#2a1c10" stroke-width="1"/>'+
      '<circle cx="52" cy="43" r="3.4" fill="#fff" stroke="#2a1c10" stroke-width="1"/>'+
      '<g clip-path="url(#'+g+'c)">'+
        '<image href="'+cover+'" xlink:href="'+cover+'" x="11" y="7" width="38" height="38" preserveAspectRatio="xMidYMid slice"/>'+
        '<rect x="11" y="7" width="38" height="38" fill="url(#'+g+'d)"/>'+
        '<rect x="11" y="7" width="38" height="38" fill="url(#'+g+'l)"/>'+
      '</g>'+
      '<circle class="idolBody" cx="30" cy="26" r="19" fill="none" stroke="rgba(0,0,0,.42)" stroke-width="1.5"/>'+
      '<ellipse cx="24" cy="24" rx="4" ry="4.8" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>'+
      '<ellipse cx="36" cy="24" rx="4" ry="4.8" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>'+
      '<circle cx="25" cy="25" r="2" fill="#241a12"/><circle cx="35" cy="25" r="2" fill="#241a12"/>'+
      '<circle cx="25.7" cy="24.2" r=".6" fill="#fff"/><circle cx="35.7" cy="24.2" r=".6" fill="#fff"/>'+
      '<path d="M25 33 Q30 37 35 33" stroke="rgba(0,0,0,.6)" stroke-width="1.7" fill="none" stroke-linecap="round"/>'+
      '</svg>'; },

  posAt(el,pos,ang,off){ const c=IR.cells[pos]; if(!c) return;
    el.style.left=(c.x*100)+'%'; el.style.top=(c.y*100)+'%';
    el.style.marginLeft=(-20+Math.cos(ang)*off)+'px'; el.style.marginTop=(-48+Math.sin(ang)*off)+'px'; },
  placePawn(el,pos,idx){ const s=this.state; const at=[];
    s.pawns.forEach((p,i)=>{ if(p.pos===pos && !(this._els&&this._els[i]&&this._els[i]._walking&&i!==idx)) at.push(i); });
    const k=at.indexOf(idx),cnt=at.length,many=cnt>1,ang=many?(k/cnt)*Math.PI*2:0,off=many?12:0;
    this.posAt(el,pos,ang,off); },
  walkPawn(idx,target){ const el=this._els[idx]; if(!el) return; el._walking=true;
    const step=()=>{
      if(this._disp[idx]===target){ el._walking=false; el.classList.remove('walking');
        this.placePawn(el,target,idx);
        const s=this.state; s.pawns.forEach((p,i)=>{ if(i!==idx&&p.pos===target&&this._els[i]&&!this._els[i]._walking) this.placePawn(this._els[i],target,i); });
        return; }
      this._disp[idx]=(this._disp[idx]+1)%25;
      this.posAt(el,this._disp[idx],0,0);
      el.classList.remove('walking'); void el.offsetWidth; el.classList.add('walking');
      setTimeout(step,270);
    };
    setTimeout(step,90); },
  renderPawns(s){ const ov=IR.board.overlay; if(!ov||!IR.cells) return;
    this._els=this._els||{}; this._disp=this._disp||{};
    s.pawns.forEach((pw,idx)=>{
      let el=this._els[idx];
      if(!el || el.parentNode!==ov){
        el=document.createElement('div'); el.className='pawn idol'; el._walking=false;
        el.innerHTML=this.idolSVG(pw.color, idx+1); ov.appendChild(el);
        this._els[idx]=el; this._disp[idx]=pw.pos; this.placePawn(el,pw.pos,idx); }
      el.classList.toggle('active', idx===s.turn && !s.finished);
      if(el._walking) return;
      if(this._disp[idx]!==pw.pos) this.walkPawn(idx,pw.pos);
      else this.placePawn(el,pw.pos,idx);
    });
    Object.keys(this._els).forEach(k=>{ if(+k>=s.pawns.length){ if(this._els[k].parentNode) this._els[k].remove(); delete this._els[k]; delete this._disp[k]; } }); },

  highlightOpp(s, done){
    const aPi=s.pawns[s.turn].pi, P=s.participants, bPi=s.pending.bPi;
    const others=[]; for(let k=1;k<P.length;k++) others.push((aPi+k)%P.length);
    const seq=[], loops=2; for(let r=0;r<loops;r++) others.forEach(pi=>seq.push(pi));
    const endAt=others.indexOf(bPi); for(let i=0;i<=endAt;i++) seq.push(others[i]);
    if(!seq.length) seq.push(bPi);
    const clear=()=>document.querySelectorAll('#sandDecks .seatHi').forEach(e=>e.classList.remove('seatHi'));
    const hl=pi=>{ const el=document.querySelector('#sandDecks [data-pi="'+pi+'"]'); if(el) el.classList.add('seatHi'); };
    let i=0; const step=()=>{ clear(); hl(seq[i]); i++;
      if(i<seq.length) setTimeout(step,130);
      else setTimeout(()=>{ clear(); hl(bPi); setTimeout(()=>{ clear(); if(done) done(); },650); },130); };
    clear(); step(); },
};
