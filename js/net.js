/* net.js — ТРАНСПОРТ на Supabase (Stage A).
   Акаунти лишаються локальними (localStorage). Кімнати — таблиця rooms; стан гри — rooms.state (+ F5);
   ходи (gi) — broadcast-канал кімнати; чат — таблиця messages; presence — Realtime presence.
   Внутрішній API (on/emit, події room/roomStart/gs/gi/chat/peers) збережено — решта гри не змінюється. */
IR.net = {
  ACC:'island_accounts', SES:'island_session',
  sb:null, me:null, cache:{}, listeners:{},
  ch:null, roomSub:null, msgSub:null, presenceCh:null, _subCode:null,

  init(){
    try{ this.sb = (window.supabase && IR.NETCFG) ? window.supabase.createClient(IR.NETCFG.url, IR.NETCFG.anon) : null; }
    catch(e){ this.sb=null; }
    if(!this.sb) console.error('Supabase client not available (CDN/NETCFG?)');
    this.me = this.session();
    try{ if(JSON.parse(localStorage.getItem('island_night')||'false')) document.body.classList.add('night'); }catch(e){}
    if(this.me) this.startPresence();
  },

  // ---------- accounts (Supabase users table + bcrypt RPCs; NO email) ----------
  session(){ try{ return JSON.parse(sessionStorage.getItem(this.SES)||'null'); }catch(e){ return null; } },
  setSession(u){ this.me=u; try{ sessionStorage.setItem(this.SES, JSON.stringify(u)); }catch(e){} },
  async register(name, pass, code){ name=(name||'').trim();
    if(!name||!pass) return {err:'authErrEmpty'};
    if(!this.sb) return {err:'noNet'};
    try{ const {data,error}=await this.sb.rpc('register_user',{p_name:name,p_pass:pass,p_code:(code||'').trim()});
      if(error||!data) return {err:'noNet'}; if(!data.ok) return {err:data.err||'noNet'};
      this.setSession({name:data.name||name}); return {ok:true, acc:{name:data.name||name}}; }
    catch(e){ return {err:'noNet'}; } },
  async createInvite(name, pass){ if(!this.sb) return {err:'noNet'};
    try{ const {data,error}=await this.sb.rpc('create_invite',{p_name:name,p_pass:pass});
      if(error||!data) return {err:'noNet'}; if(!data.ok) return {err:data.err||'noNet'};
      return {ok:true, code:data.code, expires:data.expires_at}; }
    catch(e){ return {err:'noNet'}; } },
  async login(name, pass){ name=(name||'').trim();
    if(!name||!pass) return {err:'authErrEmpty'};
    if(!this.sb) return {err:'noNet'};
    try{ const {data,error}=await this.sb.rpc('login_user',{p_name:name,p_pass:pass});
      if(error||!data) return {err:'noNet'}; if(!data.ok) return {err:data.err||'noNet'};
      this.setSession({name:data.name||name}); return {ok:true, acc:{name:data.name||name}}; }
    catch(e){ return {err:'noNet'}; } },
  logout(){ this.stopPresence(); this._unsubscribeRoom(); this.me=null; try{ sessionStorage.removeItem(this.SES); }catch(e){} },
  savePrefs(patch){ try{ Object.keys(patch||{}).forEach(k=>localStorage.setItem('island_'+k, JSON.stringify(patch[k]))); }catch(e){} },

  // ---------- rooms (Supabase) ----------
  newCode(){ return Math.random().toString(36).slice(2,7).toUpperCase(); },
  roomLink(code){ return location.origin+location.pathname+'?room='+code; },
  getRoom(code){ return this.cache[(code||'').toUpperCase()] || null; },           // синхронно з кешу
  _norm(row){ return {code:row.code, host:row.host, cap:row.cap, mode:row.mode,
    members:row.members||[], started:!!row.started, state:row.state||null}; },
  async _fetchRoom(code){ if(!this.sb) return null;
    const {data}=await this.sb.from('rooms').select('*').eq('code',code).maybeSingle();
    if(data) this.cache[data.code]=this._norm(data); return this.cache[code]||null; },

  createRoom(cap, mode){ if(!this.me) return {err:'needAuth'}; if(!this.sb) return {err:'noNet'};
    const code=this.newCode();
    const room={code, host:this.me.name, cap, mode:mode||'game', members:[{name:this.me.name, deckIndex:null}], started:false, state:null};
    this.cache[code]=room;                  // оптимістично
    this._subscribeRoom(code);
    this.sb.from('rooms').insert({code, host:room.host, cap, mode:room.mode, members:room.members, started:false})
      .then(({error})=>{ if(error) console.warn('createRoom', error.message); });
    return {ok:true, code}; },

  async joinRoom(code){ if(!this.me) return {err:'needAuth'}; if(!this.sb) return {err:'noNet'};
    code=(code||'').toUpperCase();
    const {data,error}=await this.sb.rpc('join_room',{p_code:code, p_name:this.me.name});
    if(error){ console.warn('joinRoom', error.message); return {err:'roomNotFound'}; }
    if(data && data.err) return {err:data.err};
    await this._fetchRoom(code); this._subscribeRoom(code);
    return {ok:true, code}; },

  pickDeck(code, di){ if(!this.me||!this.sb) return;
    this.sb.rpc('pick_deck',{p_code:code, p_name:this.me.name, p_deck:di})
      .then(({error})=>{ if(error) console.warn('pickDeck', error.message); }); },     // realtime оновить склад

  leaveRoom(code){ if(this.sb && this.me) this.sb.rpc('leave_room',{p_code:code, p_name:this.me.name});
    this._unsubscribeRoom(); },

  startRoom(code){ if(this.sb) this.sb.from('rooms').update({started:true, updated_at:new Date().toISOString()}).eq('code',code)
      .then(({error})=>{ if(error) console.warn('startRoom', error.message); }); },

  // ---------- realtime для активної кімнати ----------
  _subscribeRoom(code){ if(this._subCode===code) return; this._unsubscribeRoom(); this._subCode=code; if(!this.sb) return;
    // broadcast-канал кімнати (ходи gi)
    this.ch = this.sb.channel('room:'+code, {config:{broadcast:{self:false}}});
    this.ch.on('broadcast',{event:'gi'}, p=>this.emit('gi', p.payload)).subscribe();
    // зміни рядка кімнати → склад / старт / стан гри
    this.roomSub = this.sb.channel('roomrow:'+code)
      .on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:'code=eq.'+code}, p=>{
        const row=p.new;
        if(!row || !row.code){ delete this.cache[code]; this.emit('room', code); return; }
        const prev=this.cache[code]; this.cache[code]=this._norm(row);
        this.emit('room', code);
        if(row.started && (!prev || !prev.started)) this.emit('roomStart', code);
        if(row.state) this.emit('gs', {code, state:row.state});
      }).subscribe();
    // чат
    this.msgSub = this.sb.channel('msg:'+code)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room=eq.'+code}, p=>{
        const m=p.new; this.emit('chat', {code, from:m.sender, text:m.body, ts:m.ts});
      }).subscribe();
  },
  _unsubscribeRoom(){ [this.ch,this.roomSub,this.msgSub].forEach(c=>{ if(c && this.sb) this.sb.removeChannel(c); });
    this.ch=this.roomSub=this.msgSub=null; this._subCode=null; },

  // ---------- надсилання (online.js / chat.js викликають send) ----------
  send(m){ if(!m||!this.sb) return;
    if(m.t==='chat'){ this.sb.from('messages').insert({room:m.code, sender:m.from, body:m.text})
        .then(({error})=>{ if(error) console.warn('chat', error.message); }); return; }
    if(m.t==='gs'){ this.sb.from('rooms').update({state:m.state, updated_at:new Date().toISOString()}).eq('code',m.code)
        .then(({error})=>{ if(error) console.warn('state', error.message); }); return; }
    if(m.t==='gi'){ if(this.ch && this._subCode===m.code) this.ch.send({type:'broadcast', event:'gi', payload:m}); return; }
  },

  // ---------- presence (лобі) ----------
  startPresence(){ if(!this.sb || this.presenceCh) return;
    const nm=this.me?this.me.name:('?'+Math.random().toString(36).slice(2,6));
    this.presenceCh=this.sb.channel('lobby', {config:{presence:{key:nm}}});
    this.presenceCh.on('presence',{event:'sync'},()=>this.emit('peers', this.online()))
      .subscribe(async s=>{ if(s==='SUBSCRIBED') try{ await this.presenceCh.track({name:nm}); }catch(e){} });
  },
  stopPresence(){ if(this.presenceCh && this.sb) this.sb.removeChannel(this.presenceCh); this.presenceCh=null; this.emit('peers', []); },
  online(){ if(!this.presenceCh) return []; const st=this.presenceCh.presenceState(); const me=this.me?this.me.name:null;
    return Object.keys(st).map(k=>{ const nm=(st[k][0]&&st[k][0].name)||k; return {name:nm, self:nm===me}; }); },

  // ---------- events ----------
  on(ev, fn){ (this.listeners[ev]=this.listeners[ev]||[]).push(fn); },
  emit(ev, payload){ (this.listeners[ev]||[]).forEach(fn=>{ try{ fn(payload); }catch(e){} }); }
};
