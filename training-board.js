function drawTrainingBoard(id){
  let art=rect(37,15,718,509,'url(#plate)',10)+rect(50,27,692,484,'url(#vents)',7,'none');
  for(const x of [49,742])for(const y of [26,511])art+=screw(x,y,4);
  const supply=id===1?['L','N','PE']:['L1','L2','L3','PE'];
  art+=rect(-80,117,94,37+supply.length*24,'#394347',6)+label(-34,137,'板外进线',12,'white');
  supply.forEach((t,i)=>{
    const y=159+24*i;
    art+=label(-52,y+3,t,11,'white')+port('电源.'+t,1,y,'板外进线 '+t,[1,0]);
  });
  const parts=id===1?panelParts():motorParts(id);
  for(const {name,kind,x,y,width,top,bottom,caption} of parts){
    const h=76,c=x+width/2,cy=y+h/2;
    equipmentBounds.push([x,y,x+width,y+h]);
    const tone={earth:'#bfb477',neutral:'#9dafbc',terminal:'url(#black)',contactor:'#5c6264',joint:'#d4c7a6'}[kind]||'url(#plastic)';
    const ink=['contactor','terminal'].includes(kind)?'#fff':'#273032';
    art+=rect(x,y,width,h,tone,4)+label(c,y-6,name+(caption?' · '+caption:''),10);
    if(kind==='button'){
      art+=`<g data-press="${name}" class="toggle" role="button" tabindex="0" aria-label="按住 ${name} ${caption}"><circle cx="${c}" cy="${cy+9}" r="19" fill="url(#metal)" stroke="#576060"/><circle id="face${name}" cx="${c}" cy="${cy+9}" r="14" fill="${caption==='停止'?'#b34a43':'#447b61'}"/>${label(c,cy+12,caption,9,'white')}</g>`;
    }else if(kind==='breaker'){
      const lever=rect(x+9,cy-8,width-18,16,'#3d76a5',2)+label(c,cy+4,id===1?name:'分 / 合',9,'white');
      art+=id===1?lever:`<g class="toggle" data-main-qf="1" role="button" tabindex="0" aria-label="操作 QF">${lever}</g>`;
    }else if(kind==='meter'){
      art+=rect(x+6,y+5,width-12,42,'#f5f3e9')+`<path d="M${x+13} ${y+30} q22 -28 47 -3" stroke="#707675" fill="none"/><line id="needle${name}" x1="${c}" y1="${y+40}" x2="${x+16}" y2="${y+28}" stroke="#b04338" stroke-width="2"/>`+label(c,y+29,'A',9);
    }else if(kind==='contactor'){
      art+=rect(c-27,cy-9,54,18,'#252c2d')+rect(c-20,cy-6,40,12,'#426e99')+label(c,cy+3,name,9,'white');
    }else if(kind==='ct'){
      art+=rect(c-24,cy-9,48,18,'#628982',5)+rect(c-11,cy-5,22,10,'#394742',4);
    }else if(kind==='fuse'){
      for(let i=0;i<top.length;i++)art+=rect(x+5+i*width/top.length,cy-10,width/top.length-10,20,'#cbc9b6')+screw(x+(i+.5)*width/top.length,cy,3);
    }else art+=label(c,cy+4,caption||name,10,ink);
    for(const [row,bottomRow] of [[top,false],[bottom,true]]){
      row.forEach((pin,i)=>{
        const px=x+width*(i+.5)/row.length,py=bottomRow?y+h-7:y+7;
        art+=port(name+'.'+pin,px,py,name+' '+pin,[0,bottomRow?1:-1])+label(px,py+(bottomRow?-9:15),pin,8,ink);
      });
    }
  }
  if(id!==1){
    // 操作台的 XT 外侧为已连接电机的线束，不占用考生接线孔。
    art+=lead('306,466 327,466','#464e4c')+rect(324,442,75,44,'#647e81',9)
      +rect(332,436,29,11,'url(#metal)',3)+rect(393,455,13,15,'url(#metal)',2);
    for(let x=334;x<392;x+=7)art+=rect(x,448,3,31,'#859c9d',1,'#5a7072');
    art+=`<circle cx="401" cy="464" r="13" fill="#3e5557" stroke="#b7c1ba"/><g id="motorFan"><path d="M401 453l3 8-3 3-4-3z M411 468l-9 2-1-6 5-2z M394 472l-1-8 8 0-1 5z" fill="#d3b467"/></g>`
      +label(367,502,'三相电动机',10);
    equipmentBounds.push([305,436,415,490]);
  }
  return art;
}
