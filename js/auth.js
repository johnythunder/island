/* auth.js — екран входу; після входу — у лобі або одразу в кімнату (якщо прийшов за посиланням). */
IR.auth = {
  PEND:'island_pendingRoom',
  init(){
    const attempt=isReg=>this.attempt(isReg);
    document.getElementById('btnSignIn').onclick=()=>attempt(false);
    document.getElementById('btnRegister').onclick=()=>attempt(true);
    const pass=document.getElementById('authPass');
    if(pass) pass.addEventListener('keydown',e=>{ if(e.key==='Enter') attempt(false); });
    ['authName','authPass'].forEach(id=>{ const el=document.getElementById(id);
      if(el) el.addEventListener('input',()=>{ document.getElementById('authErr').textContent=''; }); });
  },
  err(key){ document.getElementById('authErr').textContent=IR.t(key); },
  attempt(isReg){
    const n=document.getElementById('authName').value, p=document.getElementById('authPass').value;
    const r = isReg ? IR.net.register(n,p) : IR.net.login(n,p);
    if(r.err){ this.err(r.err); return; }
    if(r.acc){ if(r.acc.lang) IR.setLang(r.acc.lang); document.body.classList.toggle('night', !!r.acc.night); }
    IR.net.startPresence();
    document.getElementById('authPass').value='';
    let pend=null; try{ pend=sessionStorage.getItem(this.PEND); }catch(e){}
    if(pend){ try{ sessionStorage.removeItem(this.PEND); }catch(e){} IR.room.tryJoin(pend); }
    else IR.lobby.show();
  },
  logout(){ IR.net.logout(); IR.menu.go('scrAuth'); },
  boot(){
    let rc = new URLSearchParams(location.search).get('room');
    if(!rc){ try{ rc=sessionStorage.getItem('island_curRoom'); }catch(e){} }
    if(IR.net.me){ if(rc) IR.room.tryJoin(rc); else IR.lobby.show(); }
    else { if(rc){ try{ sessionStorage.setItem(this.PEND, rc); }catch(e){} } IR.menu.go('scrAuth'); }
  }
};