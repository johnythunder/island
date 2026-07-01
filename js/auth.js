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
  async attempt(isReg){
    const n=document.getElementById('authName').value, p=document.getElementById('authPass').value;
    const codeEl=document.getElementById('authCode'); const code=codeEl?codeEl.value:'';
    const bS=document.getElementById('btnSignIn'), bR=document.getElementById('btnRegister');
    if(bS)bS.disabled=true; if(bR)bR.disabled=true;
    let r; try{ r = isReg ? await IR.net.register(n,p,code) : await IR.net.login(n,p); }
    catch(e){ r={err:'noNet'}; }
    finally{ if(bS)bS.disabled=false; if(bR)bR.disabled=false; }
    if(!r || r.err){ this.err(r?r.err:'noNet'); return; }
    IR.net.startPresence();
    document.getElementById('authPass').value=''; if(codeEl) codeEl.value='';
    if(isReg){ this.showCredsPrompt(n,p); return; }
    this.afterAuth();
  },
  afterAuth(){
    let pend=null; try{ pend=sessionStorage.getItem(this.PEND); }catch(e){}
    if(pend){ try{ sessionStorage.removeItem(this.PEND); }catch(e){} IR.room.tryJoin(pend); }
    else IR.lobby.show();
  },
  showCredsPrompt(name,pass){
    const ov=document.createElement('div'); ov.className='credsOverlay';
    ov.innerHTML='<div class="credsCard"><h3>'+IR.t('credsTitle')+'</h3>'+
      '<div class="credsRow"><span>'+IR.t('nameLabel')+'</span><b>'+name+'</b></div>'+
      '<div class="credsRow"><span>'+IR.t('passLabel')+'</span><b>'+pass+'</b></div>'+
      '<div class="credsWarn">'+IR.t('credsHint')+'</div>'+
      '<div class="credsBtns"><button class="mbtn sec" id="credsPdfBtn">'+IR.t('credsSave')+'</button>'+
      '<button class="mbtn" id="credsGoBtn">'+IR.t('credsEnter')+'</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#credsPdfBtn').onclick=()=>this.saveCredsPDF(name,pass);
    ov.querySelector('#credsGoBtn').onclick=()=>{ ov.remove(); this.afterAuth(); };
  },
  saveCredsPDF(name,pass){
    let sheet=document.getElementById('printSheet'); if(sheet) sheet.remove();
    sheet=document.createElement('div'); sheet.id='printSheet';
    sheet.innerHTML='<h1>'+IR.t('credsTitle')+'</h1><div class="pdate">'+new Date().toLocaleString()+'</div>'+
      '<table class="ptbl"><tbody>'+
      '<tr><td>'+IR.t('nameLabel')+'</td><td><b>'+name+'</b></td></tr>'+
      '<tr><td>'+IR.t('passLabel')+'</td><td><b>'+pass+'</b></td></tr>'+
      '</tbody></table><div class="pdate">'+IR.t('credsHint')+'</div>';
    document.body.appendChild(sheet); document.body.classList.add('printing');
    const done=()=>{ document.body.classList.remove('printing'); window.removeEventListener('afterprint',done); };
    window.addEventListener('afterprint',done); setTimeout(()=>{ try{window.print();}catch(e){} setTimeout(done,3000); },60);
  },
  logout(){ IR.net.logout(); IR.menu.go('scrAuth'); },
  boot(){
    let rc = new URLSearchParams(location.search).get('room');
    if(!rc){ try{ rc=sessionStorage.getItem('island_curRoom'); }catch(e){} }
    if(IR.net.me){ if(rc) IR.room.tryJoin(rc); else IR.lobby.show(); }
    else { if(rc){ try{ sessionStorage.setItem(this.PEND, rc); }catch(e){} } IR.menu.go('scrAuth'); }
  }
};
