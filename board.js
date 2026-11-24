// 台板坐标与端子位置共用同一坐标系。非本关器件只绘制外观。
const board = document.querySelector('#board');
const ports = new Map();
const rect = (x,y,w,h,fill,r=2,stroke='#777f80') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const label = (x,y,value,size=10,color='#303838',anchor='middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-weight="600">${value}</text>`;
const screw = (x,y,r=3) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#metal)" stroke="#5c605d"/><path d="M${x-r*.6} ${y+r*.6}l${r*1.2} -${r*1.2}" stroke="#555954"/>`;
const lead = (points,color) => `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round"/>`;
function port(id,x,y,name,exit=[0,-1]) {
  ports.set(id,{x,y,name,exit});
  return `<g class="port" data-port="${id}" tabindex="0" role="button" aria-label="${name}"><title>${name}</title>
  <circle cx="${x}" cy="${y}" r="5.8" fill="#d0b783" stroke="#373a36"/><circle cx="${x}" cy="${y}" r="3.4" fill="#282c2b"/>
  <circle class="halo" cx="${x}" cy="${y}" r="9.2"/></g>`;
}
function terminalBlock(x,y,n) {
  let art=rect(x-9,y-9,n*22,28,'url(#black)',3);
  for(let i=0;i<n;i++) art+=screw(x+i*22+2,y+8,4);
  return art;
}
function breaker(x,id,active=false) {
  const y=52;
  let art=rect(x,y,47,78,'url(#plastic)',3)+rect(x+3,y+3,41,8,'#b2bcb9',1)
    +label(x+23,y+24,id,10)+rect(x+4,y+30,39,17,'#334956',2)
    +(active?`<g class="toggle" data-breaker="${id}" tabindex="0" role="button" aria-label="操作 ${id}"><rect x="${x+3}" y="${y+27}" width="41" height="24" fill="transparent"/>${rect(x+5,y+36,37,11,'#447bad',2)}<text id="lever${id}" x="${x+23}" y="${y+45}" text-anchor="middle" fill="white" font-size="9">分</text></g>`:rect(x+5,y+33,37,8,'#447bad',2));
  for(const [i,t] of ['L','N'].entries()){
    const px=x+12+i*23;
    art+=label(px,y+59,t,8);
    art+=active?port(id+'in'+t,px,y+5,id+' 进线 '+t):screw(px,y+7);
    art+=active?port(id==='QF3'?t:id+'out'+t,px,y+69,id+' 出线 '+t,[0,1]):screw(px,y+69);
  }
  return art;
}
function wallSwitch(x,id,active) {
  const y=424, bx=x+16, by=y-46;
  let art=terminalBlock(bx,by,3);
  ['L1','L','L2'].forEach((t,i)=>{
    const px=bx+2+i*22;
    art+=lead(`${px},${by+17} ${px},${y+4}`,['#686e70','#af4a46','#af4a46'][i]);
    art+=active?port(id+t,px,by-1,id+' '+t):screw(px,by);
    art+=label(px,by+32,t,8);
  });
  art+=rect(x,y,80,67,'url(#plastic)',5);
  return art+`<g ${active?`class="toggle" data-switch="${id}" role="button" tabindex="0" aria-label="拨动 ${id}"`:''}>
  <rect class="face" x="${x+5}" y="${y+4}" width="70" height="56" rx="3" fill="url(#rocker)" stroke="#979f9e"/>
  ${label(x+40,y+25,id,12)}<text id="pos${id}" x="${x+40}" y="${y+44}" font-size="10" fill="#505757" text-anchor="middle">${active?'Ⅰ':''}</text></g>`;
}
function boardArt() {
  let art=rect(42,21,716,511,'#171b1c',12)+rect(37,15,718,509,'url(#plate)',11)
    +rect(50,27,692,484,'url(#vents)',7,'none');
  for(const x of [49,742]) for(const y of [26,511]) art+=screw(x,y,4);
  art+=rect(96,38,111,118,'url(#plastic)',6)+rect(102,44,99,77,'#b9c0ba',3)
    +rect(112,55,80,20,'#49534d',2)+'<text id="meterLCD" x="152" y="69" text-anchor="middle" fill="#f1eadd" font-size="11"></text>'
    +label(151,94,'单相电能表',12)+label(151,110,'kW·h',9)+rect(105,130,93,19,'url(#black)',2)
    ;
  for(let i=0;i<4;i++){
    const x=119+i*21;
    art+=label(x,126,String(i+1),9)+port('M'+(i+1),x,143,'电能表 '+(i+1)+' 号端',[0,1]);
  }
  art+=rect(-80,120,94,128,'#394347',7,'#718082')+label(-33,141,'操作台电源',12,'#fff')
    +`<g class="toggle" data-supply="main" tabindex="0" role="button" aria-label="操作台电源开关">
    ${rect(-68,152,54,22,'#21292b',3)}<text id="supplyState" x="-41" y="167" fill="#d6dedc" font-size="11" text-anchor="middle">断开</text></g>`
    +label(-57,194,'L',10,'#f5beab')+port('srcL',1,190,'板外进线 L',[1,0])
    +label(-57,215,'N',10,'#abd4ff')+port('srcN',1,211,'板外进线 N',[1,0])+label(-57,237,'PE',10,'#c8dd79')+port('srcPE',1,233,'板外进线 PE',[1,0]);
  art+=rect(510,96,73,33,'#474c4a',4)+label(546,107,'锡焊连接点',9,'white')
    +port('J1',523,120,'锡焊点 一端',[0,1])+port('J2',568,120,'锡焊点 另一端',[0,1]);
  art+=rect(273,86,216,16,'url(#metal)')+breaker(294,'QF1',true)+breaker(343,'QF2',true)
    +rect(390,52,24,78,'url(#plastic)')+rect(395,75,14,8,'#d3b35a')+breaker(417,'QF3',true);
  art+=rect(645,168,30,173,'url(#plastic)',2)
    +`<g transform="translate(662 254) rotate(90)">${label(0,0,'电子镇流器',11)}</g>`
    +rect(685,107,40,260,'url(#metal)',4)
    +'<rect id="tube" x="691" y="126" width="27" height="221" rx="9" fill="url(#plastic)" stroke="#929797"/>';
  for(const [i,t] of ['L','N'].entries()){
    const x=620+22*i;
    art+=lead(`${x},96 ${x},152 ${651+i*15},152 ${651+i*15},168`,i?'#526c94':'#965550');
  }
  art+=terminalBlock(620,84,2)+label(632,65,'镇流器输入',10);
  for(const [i,t] of ['L','N'].entries())art+=port('Bin'+t,622+i*22,84,'镇流器输入 '+t)+label(622+i*22,115,t,9);
  for(let i=0;i<4;i++){
    const x=618+i*22,from=648+i*7;
    art+=lead(`${from},341 ${from},${345+i*5} ${x},${345+i*5} ${x},378`,i<2?'#b4524c':'#5877a2');
  }
  art+=terminalBlock(616,380,4);
  for(let i=0;i<4;i++){
    const name=['A1','A2','B1','B2'][i],x=618+i*22,top=i<2;
    art+=port('out'+i,x,390,'镇流器输出 '+name,[0,1])+label(x,375,name,8,'white');
    const tx=694+22*(i%2),ty=top?115:357;
    art+=port('pin'+i,tx,ty,'灯管 '+(top?'上端':'下端')+'针脚 '+(1+i%2),top?[0,-1]:(i===2?[-1,0]:[1,0]));
  }
  art+=label(649,420,'镇流器输出',10);
  art+=rect(400,216,76,67,'url(#plastic)',5)
    +`<g class="toggle" data-switch="S3" tabindex="0" role="button" aria-label="拨动 S3"><rect class="face" x="405" y="220" width="66" height="54" rx="3" fill="url(#rocker)" stroke="#979f9e"/>${label(438,243,'S3',12)}<text id="posS3" x="438" y="263" text-anchor="middle" font-size="10">断开</text></g>`;
  art+=lead('476,238 517,238','#ac564d')+lead('476,256 537,256 537,238','#ac564d')+terminalBlock(515,239,2);
  for(const [i,t] of ['L','L1'].entries())art+=port('S3'+t,517+i*22,238,'S3 '+t)+label(517+i*22,272,t,9);
  art+=rect(220,232,92,77,'url(#plastic)',5)+`<ellipse cx="266" cy="276" rx="25" ry="15" fill="#b5b9b0" stroke="#7b817c"/>`
    +rect(254,263,24,17,'url(#metal)',5)
    +`<path id="bulb" d="M255 266 C255 254 246 250 246 237 C246 210 286 210 286 237 C286 250 277 254 277 266Z" fill="url(#glass)" stroke="#81887e" stroke-width="2"/>
    <path d="M260 266l2-23 4 6 4-6 2 23" fill="none" stroke="#90876a" stroke-width="1.5"/><path d="M251 236q0-9 8-12" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>`;
  art+=rect(158,248,43,52,'url(#black)',3);
  ['N','L'].forEach((t,i)=>{
    const y=262+22*i;
    art+=lead(`193,${y} 219,${y}`,i?'#a8473e':'#3e6192')+screw(191,y)+port('lamp'+t,170,y,'灯座 '+t,[-1,0])+label(183,y+3,t,8,'white');
  });
  art+=rect(72,382,20,83,'#b3a564',3);
  for(let i=0;i<5;i++)art+=screw(82,392+i*15,5);
  art+=port('PE1',82,392,'地排 接线端一',[-1,0])+port('PE2',82,452,'地排 接线端二',[1,0])+label(82,483,'地排',10);
  for(let i=0;i<3;i++)art+=lead(`${166+i*22},395 ${166+i*22},426`,['#537da5','#7b963d','#ad5951'][i]);
  art+=terminalBlock(164,378,3)+rect(140,424,83,68,'url(#plastic)',5);
  art+=`<path d="M167 442v8m23-8v8m-11 8v7m-13 3l4 7m19-7l-4 7" stroke="#434844" stroke-width="3"/>`;
  for(const [i,t] of ['N','PE','L'].entries())art+=port('sock'+t,166+i*22,377,'插座 '+t)+label(166+i*22,409,t,9);
  return art+wallSwitch(348,'S2',true)+wallSwitch(508,'S1',true);
}
board.innerHTML=`<defs>
<linearGradient id="plate" x2=".3" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#f2f1e9"/><stop offset="1" stop-color="#c7cbc3"/></linearGradient>
<linearGradient id="plastic" x2=".3" y2="1"><stop stop-color="#fffff6"/><stop offset=".7" stop-color="#e2e4dd"/><stop offset="1" stop-color="#acb3ad"/></linearGradient>
<linearGradient id="rocker" x2="0" y2="1"><stop stop-color="#fafbf3"/><stop offset=".8" stop-color="#e2e5dd"/><stop offset="1" stop-color="#b9beb8"/></linearGradient>
<linearGradient id="metal"><stop stop-color="#77817e"/><stop offset=".4" stop-color="#e1e3d9"/><stop offset="1" stop-color="#8d9691"/></linearGradient>
<linearGradient id="black" x2=".2" y2="1"><stop stop-color="#565c5b"/><stop offset=".6" stop-color="#292e2d"/><stop offset="1" stop-color="#414647"/></linearGradient>
<radialGradient id="glass"><stop stop-color="#e7e6d1"/><stop offset=".7" stop-color="#d0d4c6"/><stop offset="1" stop-color="#b4b9ac"/></radialGradient>
<radialGradient id="lit"><stop stop-color="#fff"/><stop offset=".65" stop-color="#ffeb95"/><stop offset="1" stop-color="#ffb741"/></radialGradient>
<pattern id="vents" width="31" height="21" patternUnits="userSpaceOnUse"><rect x="3" y="3" width="16" height="4" rx="2" fill="#858b82"/><rect x="3" y="4" width="16" height="2.5" rx="1.2" fill="#676d64"/><rect x="23" y="9" width="4" height="10" rx="2" fill="#838980"/></pattern>
</defs><g id="art">${taskId===2?boardArt():drawTrainingBoard(taskId)}</g><g id="wires"></g><polyline id="preview" fill="none" stroke-width="3" stroke-dasharray="5 4" pointer-events="none"/><g id="ports"></g>`;
// 插孔位于导线上方，已占用的孔仍能继续接线。
document.querySelectorAll('.port').forEach(p=>document.querySelector('#ports').append(p));
