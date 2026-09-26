/* v214：正式資料的介面層。付款、退款、儲值、頭像框及手帳沿用原有處理器。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const asset = name => 'lobby-ui/assets/' + name + '.png';
  const text = value => esc(String(value ?? ''));
  const attr = value => text(value).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  const geometry = "<div class=\"geometry\" aria-hidden=\"true\"><svg class=\"signature-geometry\" viewBox=\"0 0 280 200\" aria-hidden=\"true\"><g class=\"signature sig-settings\"><g class=\"frequency-orbit\"><circle cx=\"181\" cy=\"83\" r=\"65\"/><circle cx=\"181\" cy=\"83\" r=\"48\"/><circle cx=\"181\" cy=\"83\" r=\"30\"/></g><g class=\"frequency-bars\"><path d=\"M65 141V128M81 148V107M97 147V118M113 146V95M129 142V111\"/></g></g><g class=\"signature sig-wallet\"><path class=\"hex-fill\" d=\"M195 12 245 41V99L195 128 145 99V41Z\"/><path class=\"hex-outline\" d=\"M195 12 245 41V99L195 128 145 99V41ZM142 89 170 105V137L142 153 114 137V105Z\"/><path class=\"hex-trail\" d=\"M77 173H161L245 89V22\"/><path class=\"hex-glow\" d=\"M77 173H161L245 89V22\"/></g><g class=\"signature sig-orders\"><path class=\"ribbon-fill\" d=\"M111 24H144L36 177H3Z M203 1H216L108 154H95Z M272 34H289L181 187H164Z\"/><g class=\"ribbon-slashes\"><path d=\"M161 104 220 22\"/><path d=\"M177 104 236 22\"/><path d=\"M193 104 252 22\"/><path d=\"M209 104 268 22\"/></g></g><g class=\"signature sig-mail\"><ellipse class=\"letter-orbit\" cx=\"182\" cy=\"88\" rx=\"81\" ry=\"43\" transform=\"rotate(-30 182 88)\"/><ellipse class=\"letter-orbit orbit-two\" cx=\"182\" cy=\"88\" rx=\"61\" ry=\"77\" transform=\"rotate(25 182 88)\"/><g class=\"orbit-dot\"><circle cx=\"182\" cy=\"11\" r=\"4\"/></g><path class=\"orbit-star\" d=\"M229 105Q231 126 252 128Q231 130 229 151Q227 130 206 128Q227 126 229 105Z\"/></g><g class=\"signature sig-menu\"><rect class=\"menu-crystal\" x=\"173\" y=\"38\" width=\"62\" height=\"62\"/><rect class=\"menu-crystal crystal-two\" x=\"138\" y=\"102\" width=\"27\" height=\"27\"/></g></svg><div class=\"facets\" id=\"facets\"></div><div class=\"corner-lines\"><i></i><i></i><i></i></div><div class=\"diamond diamond-a\"></div><div class=\"diamond diamond-b\"></div><div class=\"glint glint-a\"></div><div class=\"glint glint-b\"></div><div class=\"ring ring-a\"></div><div class=\"ring ring-b\"></div><div class=\"dot-field\"></div><div class=\"bottom-cut\"></div><div class=\"light-sweep\"></div></div>\n";
  const definitions = {
    boardM: ['board', '掌櫃布告欄', '酒館的新鮮事，翻開看看。', 'THE TAVERN JOURNAL', 'JOURNAL'],
    achM: ['achievements', '成就收藏冊', '把一起度過的小日子，收藏起來。', 'THE LITTLE COLLECTION', 'COLLECT'],
    topupM: ['wallet', '金幣錢包', '為下一段陪伴，留一點期待。', 'TAVERN WALLET', 'WALLET'],
    setM: ['settings', '酒館調頻', '調成你喜歡的節奏。', 'MAKE YOURSELF AT HOME', 'TUNE IN'],
    mailBoxM: ['mail', '我的信箱', '給你的每一句話，都在這裡。', 'LETTERS TO YOU', 'POST'],
    shopM4: ['orders', '我的訂單', '約好的時間，替你好好記著。', 'TAVERN ORDERS', 'ORDERS'],
    shopM1: ['menu', '想來點什麼？', '找店員一起玩，或看看酒館的會員方案。', 'ORDER MENU', 'ORDER']
  };
  const shells = {};
  function shell(id) {
    const modal = $(id), [view, title, subtitle, eyebrow, outline] = definitions[id];
    const card = modal.firstElementChild;
    const content = document.createElement('div'); content.className = 'panel-content';
    const oldTitle = card.querySelector(':scope > .gtop, :scope > h3'); oldTitle?.remove();
    while (card.firstChild) content.append(card.firstChild);
    modal.classList.add('tt-live-ui'); card.classList.add('panel'); card.dataset.view = view;
    card.removeAttribute('style');
    card.innerHTML = geometry + '<header class="panel-head"><span class="eyebrow">' + eyebrow + '</span>'
      + '<span class="outline-word" aria-hidden="true">' + outline + '</span><div class="heading"><span class="title-chip"><i aria-hidden="true"></i><h1>' + title + '</h1></span></div>'
      + '<p>' + subtitle + '</p><button class="close" type="button" aria-label="關閉視窗">×</button></header>';
    card.append(content);
    card.querySelector('.close').onclick = () => close(id);
    const footer = document.createElement('footer'); footer.className = 'panel-footer';
    footer.innerHTML = '<button type="button" class="back-menu">← 返回大廳</button><span class="footer-mark">TINY TAVERN</span>';
    footer.querySelector('button').onclick = () => close(id); card.append(footer);
    // 複製的裝飾不能產生重複 ID。
    card.querySelectorAll('.geometry [id]').forEach(e => e.removeAttribute('id'));
    const facets = card.querySelector('.facets');
    if (facets) for (let n=0;n<20;n++) { const f=document.createElement('i'); f.style.setProperty('--i',n);f.style.setProperty('--facet',['#d4bd7d','#b3cbd2','#d9c4be'][n%3]);facets.append(f); }
    shells[id] = {modal,card,content};
    return content;
  }
  function close(id) { if ($(id).classList.contains('gwin')) gClose(id); else shopClose(); }
  function open(id, before) {
    window.TinyTavernUI?.close(); shopClose();
    Object.keys(definitions).forEach(key => $(key)?.classList.remove('on'));
    if (before) before();
    if ($(id).classList.contains('gwin')) gOpen(id); else $(id).style.display = 'flex';
  }
  Object.keys(definitions).forEach(shell);
  shells.boardM.content.querySelector('.btns')?.remove();
  const originalFriends=window.frOpen;
  window.frOpen=function(){
    originalFriends();
    if(!shells.frM){
      definitions.frM=['friends','酒館好友','把聊得來的人，留在酒館裡。','OUR LITTLE CIRCLE','TOGETHER'];
      const content=shell('frM');
      const cover=document.createElement('aside');cover.className='friend-cover';
      cover.innerHTML='<span class="issue-label">A PLACE TO BELONG</span><div class="friend-art"><img src="'+asset('chat')+'" alt=""><i></i><b aria-hidden="true">✦</b></div><h2>下次見，<br>也要一起坐。</h2><p>在大廳點開對方的闆卡，<br>就能送出好友邀請。</p><span class="friend-word" aria-hidden="true">HELLO</span>';
      content.classList.add('friends-layout');content.prepend(cover);
    }
  };

  // 大廳的幾何只沿功能區邊緣展開，保持中央場景完整。
  for(const corner of ['top','bottom']){
    const art=document.createElement('div');art.className='lobby-geometry '+corner;art.setAttribute('aria-hidden','true');
    art.innerHTML='<svg viewBox="0 0 350 310"><g class="lobby-lines"><path d="M-50 250 370 -20M-40 300 400 20M65 310 350 110"/><path d="M195 -20V105H305"/></g><g class="lobby-facets"><path d="M250 122 308 220 194 220Z"/><path d="M65 27 103 95 28 95Z"/></g><g class="lobby-diamonds"><path d="m171 42 31 31-31 31-31-31Z"/><path d="m308 102 12 12-12 12-12-12Z"/></g><g class="lobby-stars"><path d="M116 30Q119 45 135 48Q119 51 116 66Q113 51 97 48Q113 45 116 30ZM311 235Q314 248 327 251Q314 254 311 267Q308 254 295 251Q308 248 311 235Z"/></g><path class="lobby-trace" d="M-40 300 400 20"/></svg><span class="lobby-dots"></span>';
    document.body.append(art);
  }
  const chatHeading=document.createElement('div');chatHeading.className='tt-chat-heading';chatHeading.innerHTML='<b>酒館閒聊</b><span>TAVERN CHAT</span>'; $('chatbox').prepend(chatHeading);
  $('chatin').placeholder='說點什麼…';$('chatin').setAttribute('aria-label','大廳聊天訊息');
  $('gearBtn').innerHTML='<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 8h18M5 14h18M5 20h18M10 5v6M19 11v6M12 17v6"/></svg>';
  const cat=document.querySelector('.amCat');
  if(cat){cat.querySelector('canvas')?.remove();cat.querySelector('.amTag')?.remove();cat.style.left='1080px';cat.style.top='218px';cat.style.width='82px';cat.style.height='90px';cat.setAttribute('role','button');cat.tabIndex=0;cat.setAttribute('aria-label','摸摸吧台上的店貓');cat.title='摸摸店貓';cat.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();cat.click();}});}

  // 裝飾只在內容底層；訂單不加裝飾動畫。
  function motion(kind) {
    const shapes = [
      '<g class="frame-prisms"><path d="M90 145 160 50 220 145Z"/><path d="M160 50 220 145 280 70Z"/></g>',
      '<g class="frame-orbits"><circle cx="245" cy="145" r="40"/><circle cx="245" cy="145" r="68"/><circle cx="245" cy="145" r="99"/></g>',
      '<g class="frame-streaks"><path d="M100 150 210 40"/><path d="M132 155 242 45"/><path d="M164 160 274 50"/></g>',
      '<g class="frame-waves"><path d="M-20 124Q75 70 170 112T340 91"/><path d="M-20 137Q75 83 170 125T340 104"/></g>'
    ];
    return '<span class="frame-decoration" aria-hidden="true"><svg viewBox="0 0 300 150" preserveAspectRatio="none">'+shapes[kind%4]+'</svg></span>';
  }

  // 左上沿用原節點：框架重繪、人物畫布及點擊書本的監聽器全部保留。
  document.body.classList.add('tt214');
  const hud=$('hud2'), avatar=$('h2ava');
  avatar.title='開啟我的手帳・頭像框'; avatar.setAttribute('role','button'); avatar.tabIndex=0;
  avatar.setAttribute('aria-label','開啟我的手帳與頭像框');
  avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();avatar.click();}});
  const funds=document.createElement('div');funds.className='tt-funds';
  funds.innerHTML='<span>持有金幣</span><strong><img src="'+asset('coin')+'" alt=""><span id="ttWalletCount"></span></strong>';
  hud.append(funds);
  const balance=$('coinBal'); const syncBalance=()=>{$('ttWalletCount').textContent=balance.textContent;};syncBalance();
  new MutationObserver(syncBalance).observe(balance,{childList:true,subtree:true,characterData:true});
  const bookHint=document.createElement('span');bookHint.className='tt-book-hint';bookHint.textContent='個人手帳 ↗';hud.querySelector('.h2who').append(bookHint);
  const hudAnchor=document.createComment('個人名片原位置');hud.before(hudAnchor);
  function placeHud(){
    const hero=document.querySelector('#mHome .mhHero');
    if(hero&&document.body.classList.contains('mhome-on')&&matchMedia('(max-width:680px)').matches){if(hud.parentElement!==hero)hero.append(hud);}
    else if(hud.previousSibling!==hudAnchor)hudAnchor.after(hud);
  }
  new MutationObserver(placeHud).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',placeHud);placeHud();
  const dock=document.createElement('nav');dock.id='ttMainDock';dock.setAttribute('aria-label','酒館功能');document.body.append(dock);
  function newButton(id,icon,label,click){const b=document.createElement('button');b.type='button';b.id=id;b.innerHTML='<img src="'+asset(icon)+'" alt=""><span>'+label+'</span>';b.onclick=click;return b;}
  const friends=newButton('frBtn','chat','好友',()=>frOpen());
  const mobileFriends=document.createElement('button');mobileFriends.className='mhSub';mobileFriends.textContent='好友';mobileFriends.onclick=()=>frOpen();document.querySelector('.mhSubRow')?.prepend(mobileFriends);
  const mobileBag=$('mhWard');if(mobileBag){mobileBag.innerHTML='我的背包<small>穿搭・紀念收藏・成就紀錄</small>';}
  friends.insertAdjacentHTML('beforeend','<span id="frDockBadge" class="badge" style="display:none"></span>');dock.append(friends);
  dock.append(newButton('ttAchBtn','star','成就',()=>open('achM',()=>buildAch2())));
  dock.append(newButton('ttWalletBtn','coin','錢包',()=>openTopup()));
  dock.append(newButton('ttMailBtn','mail','信箱',()=>open('mailBoxM',()=>renderMailBox())));
  // 正式站原本就有的時裝間、背包、好友與闆卡功能，不能因試做導覽而消失。
  for(const [id,label] of [['ordBtn','訂單'],['dressBtn','時裝間'],['wardBtn','背包'],['shopBtn','我要點單']]){
    const b=$(id); if(!b)continue;b.classList.add('tt-dock-item');
    const lab=document.createElement('span');lab.className='tt-dock-label';lab.textContent=label;b.append(lab);dock.append(b);
  }
  $('gearBtn').setAttribute('aria-label','設定');
  const gearLabel=document.createElement('span');gearLabel.textContent='設定';$('gearBtn').append(gearLabel);
  const mailBadge=$('mailBadge');$('ttMailBtn').append(mailBadge);

  // 點單選單保留原按鈕與 onclick：新版名簿、會員、限定併桌沿原路由。
  const menu=shells.shopM1.content, buttons=[...menu.querySelectorAll('.planBtn')];
  const grid=document.createElement('div');grid.className='feature-grid';
  const choices=[['PLAY','mug','找陪玩一起玩','特戰英豪、語音陪聊','看名簿'],['MEMBER','coupon','加入會員','月費會員、冠名支持','看方案'],['TABLE','receipt','酒館併桌','多人同桌・一人一席','看場次']];
  buttons.forEach((b,i)=>{const [word,ic,title,sub,cta]=choices[i];b.classList.add('feature-tile','framed-motion');b.innerHTML='<span class="tile-number">0'+(i+1)+'</span><span class="vertical-word" aria-hidden="true">'+word+'</span><img src="'+asset(ic)+'" alt=""><h2>'+title+'</h2><p>'+sub+'</p><span class="tile-cta">'+cta+' →</span>'+motion(i);if(i===2)b.querySelector('p').id='tbMenuSub';grid.append(b);});
  menu.prepend(grid);tbMenuRefresh();const ribbon=document.createElement('div');ribbon.className='menu-ribbon';ribbon.innerHTML='<b>今日菜單</b><span>WHAT WOULD YOU LIKE</span>';menu.prepend(ribbon);
  menu.querySelector(':scope > .btns')?.remove();
  shells.shopM4.content.querySelector(':scope > .btns')?.remove();
  const tabs=$('ordTabA').parentElement;tabs.className='tabs';tabs.removeAttribute('style');

  // 成就使用正式計數與解鎖條件。
  window.buildAch2=function(){
    const states=ACH_DEF.map(a=>{const value=a.k?Math.min(TT_STATS[a.k]||0,a.need):0;return {a,value,done:TT_STATS.u.includes(a.id)||!!(a.k&&value>=a.need)};});
    const total=states.filter(s=>s.done).length;
    const content=shells.achM.content;
    content.innerHTML='<div class="collection-layout"><aside class="collection-cover framed-motion"><span class="issue-label">VOL. 01 / 酒館日常</span><div class="cup-scene" aria-hidden="true"><i class="steam steam-a"></i><i class="steam steam-b"></i><img src="'+asset('mug')+'" alt=""><span class="mini-flower">✿</span></div><h2>每一次來，<br>都有小收穫。</h2><p>一杯飲料、一聲招呼，<br>都是值得收藏的片刻。</p><span class="cover-stamp">'+total+' / '+states.length+'<br><small>已收藏</small></span>'+motion(3)+'</aside><div id="achList" class="ach-grid">'+states.map(({a,value,done},i)=>'<button type="button" class="ach framed-motion '+(!a.k?'locked':'')+'" aria-pressed="false" data-ach="'+attr(a.n)+'"><span class="collect-no">0'+(i+1)+'</span><span class="badge-art"><img src="'+attr(AICON[a.ic])+'" alt=""></span><h2>'+text(a.n)+'</h2><p>'+text(a.d)+'</p><span class="collect-state">'+(done?'收藏完成':a.k?value+' / '+a.need:'敬請期待')+'</span><span class="collection-spine" aria-hidden="true"><span class="spine-seal">'+(done?'✦':'◇')+'</span><span class="spine-word">'+(['COFFEE','CAT','CHAT','VIP'][i]||'COLLECT')+'</span><span class="spine-track"></span><span class="spine-edition">'+(done?'COLLECTED':'VOL. 0'+(i+1))+'</span></span>'+motion(i)+'</button>').join('')+'</div></div>';
    content.querySelectorAll('[data-ach]').forEach(b=>b.onclick=()=>{content.querySelectorAll('[data-ach]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  };

  // 金額、方案與付款按鈕均沿用既有函式提供的真實設定。
  renderTopup=function(){
    const cfg=window.__topupCfg||{},tiers=(cfg.tiers||[]).filter(t=>t&&t.amt>0),bal=Number(window.__wallet)||0;
    $('topupBody').innerHTML='<div class="purse-summary framed-motion"><div class="wallet-balance"><small>目前可用金幣</small><strong>'+bal.toLocaleString()+'<span>金幣</span></strong><p>為下一次相聚，存一點期待。</p></div><div class="coin-scene" aria-hidden="true"><span class="coin-orbit"></span><img src="'+asset('coin')+'" alt=""><i class="coin-spark">✦</i><span class="coin-label">TAVERN COINS</span></div>'+motion(3)+'</div>'
      +(cfg.note?'<p class="body-note">'+text(cfg.note)+'</p>':'')+'<div class="section-caption"><b>補充一點快樂</b><span>TOP UP</span></div><div class="packages">'
      +(tiers.length?tiers.map((t,i)=>'<button type="button" class="package framed-motion" data-tier="'+i+'"><span class="coupon-id">'+String(i+1).padStart(2,'0')+' / 儲值</span><strong>'+Number(t.amt+(t.bonus||0)).toLocaleString()+' <small>金幣</small></strong>'+(t.bonus>0?'<small class="tt-bonus">含贈送 '+text(t.bonus)+' 金幣</small>':'')+'<p>NT$ '+Number(t.amt).toLocaleString()+'</p><span class="coupon-arrow">↗</span>'+motion(i%2)+'</button>').join(''):'<p class="body-note">目前尚未開放儲值，敬請期待。</p>')+'</div>'
      +'<p class="body-note">1 金幣 = 1 元，可用於點單與時裝購買。<br>儲值由掌櫃核對，入帳時會收到通知。</p><div class="text-links"><a class="text-btn" href="https://discord.gg/aK9GFarxm" target="_blank" rel="noopener">找掌櫃幫忙 ↗</a><button type="button" class="text-btn" id="ttWalletTx">查看交易紀錄 →</button></div><div id="walletTxBox"></div>';
    $('topupBody').querySelectorAll('[data-tier]').forEach(b=>b.onclick=()=>pickTier(Number(b.dataset.tier)));
    $('ttWalletTx').onclick=()=>renderWalletTx();
    const collection=document.createElement('button');collection.type='button';collection.className='text-btn';collection.textContent='優惠券與收藏 →';
    collection.onclick=()=>{gClose('topupM');buildBag();gOpen('bagM');};$('topupBody').querySelector('.text-links').append(collection);
  };

  // 搬動原設定控制元件，保留既有監聽器與儲存行為。
  const settings=shells.setM.content.querySelector('.gin');
  const rows=[...settings.querySelectorAll(':scope > .setRow')];const actions=settings.lastElementChild;
  const layout=document.createElement('div');layout.className='tuning-layout';
  const music=document.createElement('section');music.className='music-card framed-motion';
  music.innerHTML='<span class="issue-label">01 / TAVERN RADIO</span><div class="record-player" aria-hidden="true"><div class="record"><span><img src="'+asset('mug')+'" alt=""></span></div><div class="tonearm"></div><div class="equalizer"><i></i><i></i><i></i><i></i></div></div>';
  music.append(rows[0],rows[1]);music.insertAdjacentHTML('beforeend',motion(1));
  const controls=document.createElement('section');controls.className='tuning-controls framed-motion';controls.innerHTML='<div class="section-caption"><b>你的舒適小角落</b><span>02 / PERSONAL</span></div>';
  rows.slice(2).forEach(r=>controls.append(r));controls.insertAdjacentHTML('beforeend',motion(2));layout.append(music,controls);settings.prepend(layout);actions.classList.add('actions');
  rows.forEach(r=>r.classList.add('setting'));rows[4].classList.add('quality-section');
  rows[4].remove();
  for(const [id,label] of [['tglMusic','背景音樂'],['tglSfx','點擊音效'],['tglWander','掛機漫步']]){$(id).setAttribute('aria-label',label);$(id).setAttribute('role','switch');const sync=()=>{$(id).setAttribute('aria-checked',String($(id).classList.contains('on')));if(id==='tglMusic')music.classList.toggle('playing',$(id).classList.contains('on'));};sync();new MutationObserver(sync).observe($(id),{attributes:true,attributeFilter:['class']});}
  $('volSl2').setAttribute('aria-label','音樂音量');

  const originalMail=renderMailBox;
  renderMailBox=function(){
    originalMail();const box=$('mailBody2');
    if(!mailList().length){box.innerHTML='<div class="letter-layout"><div class="mail-illustration" aria-hidden="true"><div class="letter-paper"><span>Dear you,</span><i></i><i></i><b>♡</b></div><div class="envelope"></div><div class="postal-ring">TINY TAVERN<br>WITH LOVE</div></div><div class="mail-message framed-motion"><span class="issue-label">TO / 酒館的你</span><h2>信箱裡，<br>留一點期待。</h2><p>目前沒有新信件。<br>掌櫃的通知和小紙條，<br>都會好好地收在這裡。</p>'+motion(3)+'</div></div><div class="mail-summary">收件匣 <span>0 封未讀信件</span></div>';}
    else box.classList.add('tt-mail-list');
  };

  // 單號只讀取已關聯的後台工單；絕不以日期或流水索引猜測。
  const numberCache=new Map();
  function backendNumber(o){
    if(o.no)return String(o.no);
    if(!o.workOrderId)return null;
    const key=String(o.workOrderId);
    if(!numberCache.has(key)){
      numberCache.set(key,null);
      if(db)db.ref(ROOT+'/orders/'+key+'/no').once('value').then(s=>{numberCache.set(key,s.val()?String(s.val()):null);if($('shopM4').style.display!=='none')renderMyOrders();}).catch(()=>{});
    }
    return numberCache.get(key)||null;
  }
  function identity(no){
    if(!no)return '<div class="ticket-identity"><span class="ticket-id-label">後台單號</span><code>待建立／同步</code></div>';
    let x=0;const bars=[];for(const ch of no)for(let bit=0;bit<4;bit++){const n=ch.charCodeAt(0),w=1+((n>>bit)&1);bars.push('<rect x="'+x+'" width="'+w+'" height="25"/>');x+=w+1+((n>>(bit+2))&1);}
    return '<div class="ticket-identity"><span class="ticket-id-label">後台單號</span><svg class="ticket-barcode" viewBox="0 0 '+x+' 25" preserveAspectRatio="none" aria-hidden="true">'+bars.join('')+'</svg><code>'+text(no)+'</code></div>';
  }
  function orderCard(id,o){
    const done=o.status==='done',cancelled=o.status==='cancelled',issued=!!issueSent()[id];
    const stamp=Number(o.reserveAt||o.createdAt),d=new Date(stamp),valid=Number.isFinite(d.getTime());
    const date=valid?(d.getMonth()+1)+'/'+d.getDate():'—',time=valid?'（'+'日一二三四五六'[d.getDay()]+'）'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'';
    const current=done?2:o.status==='confirmed'?1:0;
    let status=cancelled?'此訂單已取消':done?(o.type==='topup'?'儲值完成・'+Number(o.coinAmount||o.amount||0).toLocaleString()+' 金幣已入帳':o.type==='shop'?'購買完成・已收進背包':o.type==='member'?'會員已開通':'已完成這次陪伴'):o.status==='confirmed'?'訂單已確認':'等待掌櫃確認付款';
    if(!done&&!cancelled&&o.booking&&o.status==='confirmed')status=o.staffDeclined?'陪玩無法接單，掌櫃正在協助退款或改期':o.accepted?'陪陪已確認，準時赴約。':'等待陪陪確認時段';
    if(cancelled&&o.refunded)status+='・'+(Number(o.amount)||0)+' 金幣已退回錢包';
    const steps=cancelled?'':'<div class="steps" aria-label="'+attr(status)+'">'+[current>0?'已付款':'待付款確認',current>0?'已確認':'待確認',done?'已完成':'待完成'].map((lb,i)=>'<span class="'+(done||i<current?'done':i===current?'current':'future')+'">'+(!done&&i===current?'<i aria-hidden="true"></i>':'')+lb+(!done&&i===current?'<small>目前進度</small>':'')+'</span>').join('')+'</div>';
    const controls=[];
    if(!cancelled){if(issued)controls.push('<div class="ticket-help"><span class="help-state"><i aria-hidden="true"></i>掌櫃處理中</span><p>已收到你的問題，請等候回覆。</p></div>');else controls.push('<button class="text-btn order-assist" data-order-action="issue" data-order="'+attr(id)+'">需要協助？聯絡掌櫃 ↗</button>');}
    if(o.cancelPending)controls.push('<p class="tt-order-note">取消處理中，金幣會退回你的錢包。</p>');
    else if(!done&&!cancelled&&canSelfCancel(o))controls.push('<div class="tt-cancel"><span>尚未接單，可取消並退回金幣。</span><button data-order-action="cancel" data-order="'+attr(id)+'">取消並退回金幣</button></div>');
    if(done&&(o.type==='play'||!o.type))controls.push('<button class="text-btn order-reorder" data-order-action="reorder">再點一次 <span aria-hidden="true">↗</span></button>');
    return '<article class="order '+(done?'is-complete':issued?'needs-help':'is-upcoming')+'"><div class="ticket-date"><small>'+(o.reserveAt?'約定日期':'訂單日期')+'</small><b>'+date+'</b><span>'+time+'</span></div><div class="ticket-body"><div class="order-top"><div><h2>'+text(o.planName||'訂單')+'</h2>'+(o.staffName?'<small>與 '+text(o.staffName)+' 一起玩</small>':'')+'</div><strong>NT$ '+Number(o.amount||0).toLocaleString()+'</strong></div><p class="order-status">'+text(status)+'</p>'+(o.couponUsed&&o.couponDisc?'<p class="tt-order-note">已使用優惠券折抵 NT$ '+text(o.couponDisc)+'</p>':'')+(o.declineReason?'<p class="tt-order-note">陪玩無法接單：'+text(o.declineReason)+'</p>':'')+steps+'<div class="ticket-bottom"><div class="tt-order-actions">'+controls.join('')+'</div><div class="ticket-footer">'+identity(backendNumber(o))+'</div></div></div></article>';
  }
  renderMyOrders=function(){
    const ids=myOrderIds(),active=ids.filter(id=>myOrdersCache[id]&&!['done','cancelled'].includes(myOrdersCache[id].status)),history=ids.filter(id=>myOrdersCache[id]&&['done','cancelled'].includes(myOrdersCache[id].status));
    $('ordTabA').textContent='進行中（'+active.length+'）';$('ordTabH').textContent='歷史紀錄（'+history.length+'）';
    $('ordTabA').classList.toggle('active',_ordTab==='active');$('ordTabH').classList.toggle('active',_ordTab==='history');
    $('ordTabA').setAttribute('aria-selected',String(_ordTab==='active'));$('ordTabH').setAttribute('aria-selected',String(_ordTab==='history'));
    const list=(_ordTab==='active'?active:history).slice().reverse(),pages=Math.max(1,Math.ceil(list.length/ORD_PER));_ordPage=Math.max(0,Math.min(_ordPage,pages-1));
    const visible=list.slice(_ordPage*ORD_PER,(_ordPage+1)*ORD_PER);
    $('ordList').innerHTML=visible.length?visible.map(id=>orderCard(id,myOrdersCache[id])).join(''):'<div class="tt-empty"><img src="'+asset('receipt')+'" alt=""><h2>'+(_ordTab==='active'?'目前沒有進行中的訂單':'還沒有歷史訂單')+'</h2><p>點「我要點單」找店員一起玩，或逛逛時裝間。</p><button class="primary" data-order-action="shop">我要點單 →</button></div>';
    if(pages>1)$('ordList').insertAdjacentHTML('beforeend','<div class="ordPg"><button data-page="-1" '+(_ordPage===0?'disabled':'')+'>‹ 上一頁</button><span>'+(_ordPage+1)+' / '+pages+'</span><button data-page="1" '+(_ordPage===pages-1?'disabled':'')+'>下一頁 ›</button></div>');
    $('ordList').querySelectorAll('[data-order-action]').forEach(b=>b.onclick=()=>{const id=b.dataset.order;switch(b.dataset.orderAction){case 'issue':openIssue(id);break;case 'cancel':selfCancel(id);break;case 'reorder':reorderPlay();break;case 'shop':shopOpen(1);break;}});
    $('ordList').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>ordPage(Number(b.dataset.page)));
  };
  // 公開的唯讀呈現介面供隔離測試驗證，無新增寫入端點。
  window.TTLivePresentation={version:219,backendNumber,orderCard,renderMyOrders};
})();
