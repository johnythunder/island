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

  idolSVG(color,n){ return '<svg viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">'+
      '<ellipse cx="20" cy="50" rx="11" ry="2.6" fill="rgba(0,0,0,.35)"/>'+
      '<path class="idolBody" d="M20 2c-7 0-11 5-11 12 0 4 2 6.5 2 10.5 0 5-3 7-3 12 0 6 5 11 12 11s12-5 12-11c0-5-3-7-3-12 0-4 2-6.5 2-10.5C31 7 27 2 20 2z" fill="'+color+'" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>'+
      '<path d="M11 15h18" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>'+
      '<circle cx="15" cy="20" r="2.4" fill="#fff"/><circle cx="25" cy="20" r="2.4" fill="#fff"/>'+
      '<circle cx="15" cy="20" r="1" fill="#1a1a1a"/><circle cx="25" cy="20" r="1" fill="#1a1a1a"/>'+
      '<path d="M14 29q6 5 12 0" stroke="rgba(0,0,0,.45)" stroke-width="1.6" fill="none"/>'+
      '<text x="20" y="46" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">'+n+'</text></svg>'; },

  renderPawns(s){ const ov=IR.board.overlay; if(!ov||!IR.cells) return; ov.innerHTML='';
    const byCell={}; s.pawns.forEach((pw,idx)=>{(byCell[pw.pos]=byCell[pw.pos]||[]).push(idx);});
    s.pawns.forEach((pw,idx)=>{const c=IR.cells[pw.pos]; if(!c)return;
      const grp=byCell[pw.pos],k=grp.indexOf(idx),cnt=grp.length,ang=(k/Math.max(cnt,1))*Math.PI*2,off=cnt>1?11:0;
      const el=document.createElement('div'); el.className='pawn idol'+(idx===s.turn&&!s.finished?' active':'');
      el.style.left=(c.x*100)+'%'; el.style.top=(c.y*100)+'%';
      el.style.marginLeft=(-17+Math.cos(ang)*off)+'px'; el.style.marginTop=(-42+Math.sin(ang)*off)+'px';
      el.innerHTML=this.idolSVG(pw.color, idx+1); ov.appendChild(el);}); },

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
