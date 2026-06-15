/* cards.js — колоди на піску (SEATS), картка події зліва, рендер реакцій. */
IR.cards = {
  decksEl:null, eventEl:null,
  SEATS:[[27,57,0],[34,46,0],[56,49,0],[61,69,0],[50,84,0],[19,68,0],[66,57,0]],
  ORDER:[4,0,2,1,3,5,6],
  init(){ this.decksEl=document.getElementById('sandDecks'); this.eventEl=document.getElementById('eventCard'); },
  cover(deckIndex){ return 'assets/cards/covers/'+IR.DECKS[deckIndex].file; },

  addDeck(p,x,y,rot,seat,pi){
    const el=document.createElement('div'); el.className='sandDeck'; el.dataset.seat=seat; if(pi!=null) el.dataset.pi=pi;
    el.style.left=x+'%'; el.style.top=y+'%';
    el.style.transform='translate(-50%,-50%) rotate('+rot+'deg)';
    el.style.backgroundImage='url('+this.cover(p.deckIndex)+')';
    el.innerHTML='<span class="dlab" style="background:'+p.color+'">'+(p.isWidmo?'👻 '+p.short:p.short)+'</span>';
    this.decksEl.appendChild(el);
  },
  placeDecks(participants){
    if(!this.decksEl) return; this.decksEl.innerHTML='';
    participants.forEach((p,i)=>{ const si=this.ORDER[i%this.ORDER.length], s=this.SEATS[si];
      this.addDeck(p, s[0], s[1], (s[2]||0), si, i); });
  },

  showEvent(num){ if(!this.eventEl) return;
    this.eventEl.innerHTML='<div class="evNum">'+IR.util.pad(num)+'</div><div class="evPl">'+IR.sit(num)+'</div>';
    this.eventEl.classList.add('show'); },
  clearEvent(){ if(this.eventEl) this.eventEl.classList.remove('show'); },

  reactionFace(r){ const col=IR.RGROUP[r.g];
    return '<div class="rcard"><div class="rc-name">'+IR.rname(r)+'</div><div class="rc-dot" style="background:'+col+'"></div></div>'; }
};