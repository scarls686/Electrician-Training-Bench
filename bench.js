const $ = id => document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
let wires=[], history=[], pending=null, selected=null, sequence=0;
let powered=false, positions={S1:0,S2:0,S3:0}, readings=new Map(), hintStep=0;
const [x,y,w,h]=board.getAttribute('viewBox').split(' ').map(Number);
const fullView={x,y,w,h};
let view={...fullView}, drag=null, cursor=null;
const colors=$('color'), size=$('size');
const say = text => { $('message').textContent=text; };
const currentKey = () => ''+positions.S1+positions.S2;
const instruction='点击起点接线孔。滚轮缩放，拖动空白处平移。';

const breakers={QF1:false,QF2:false,QF3:false};
let traffic=wireTraffic([]), previewFrame=0;
let energyWh=0, meterWatts=0, meterTime=performance.now();
function updateMeter(){
  const now=performance.now();
  energyWh+=(now-meterTime)*meterWatts/3600000;
  meterTime=now;
  $('meterLCD').textContent=($('meterLCD').dataset.fed==='yes')?(energyWh/1000).toFixed(6):'—';
}
if(taskId===2)setInterval(updateMeter,1000);
function previewWire(){
  previewFrame=0;
  const path=pending && cursor?routeWire(ports.get(pending.from),cursor,pending.bends,traffic):null;
  $('preview').setAttribute('points',path?coordinates(path):'');
}
const coordinates = points => points.map(p=>p.x+','+p.y).join(' ');
function renderWires() {
  $('wires').replaceChildren();
  for (const w of wires) {
    const points=coordinates(w.path);
    const g=document.createElementNS(ns,'g');
    g.setAttribute('class','wire'+(selected===w.id?' selected':''));
    g.dataset.wire=w.id;
    g.setAttribute('tabindex','0'); g.setAttribute('role','button');
    g.setAttribute('aria-label',ports.get(w.a).name+' 到 '+ports.get(w.b).name);
    const width=w.size.startsWith('2.5')?4.8:3.5;
    g.innerHTML=`<polyline class="outline" points="${points}" fill="none" stroke="#282b29" stroke-width="${width+1.4}"/>
      <polyline points="${points}" fill="none" stroke="${w.color}" stroke-width="${width}"/>
      ${w.color==='#659142'?`<polyline points="${points}" fill="none" stroke="#f1da61" stroke-width="${width}" stroke-dasharray="5 6"/>`:''}
      <polyline points="${points}" fill="none" stroke="transparent" stroke-width="11"/>`;
    $('wires').append(g);
  }
  const w=wires.find(item=>item.id===selected);
  for(const p of board.querySelectorAll('.port')){
    p.classList.toggle('marked',[pending?.from,w?.a,w?.b].includes(p.dataset.port));
  }
  $('remove').disabled=powered || !w; $('undo').disabled=powered || !history.length;
  $('cancel').hidden=!pending;
  $('inspect').disabled=powered || !!pending;
  $('preview').setAttribute('stroke',colors.value);
  previewWire();
}
function renderState(){
  if(taskId!==2){updateTraining();return;}
  let reading=measureCircuit(wires,positions.S1,positions.S2,breakers,positions.S3);
  if(powered && reading.short){
    powered=false;readings.clear();
    say('当前开关组合使电源短路，模拟电源已跳闸。请在断电状态检查接线。');
  }
  const testing=powered && reading.branchFed && breakers.QF1 && breakers.QF3;
  if(testing)readings.set(currentKey(),reading);
  $('supplyState').textContent=powered?'已接通':'已断开';
  $('supplyState').setAttribute('fill',powered?'#ffce69':'#d6dedc');
  board.querySelector('[data-supply]').setAttribute('aria-pressed',String(powered));
  $('meterLCD').dataset.fed=powered && reading.meterFed?'yes':'no';
  updateMeter();meterWatts=powered?reading.watts:0;
  const tubeOn=powered && reading.tubeLit;
  $('tube').setAttribute('fill',tubeOn?'#fffee6':'url(#plastic)');
  $('tube').style.filter=tubeOn?'drop-shadow(0 0 8px #ffefa0)':'';
  for(const id of ['QF1','QF2','QF3']){
    $('lever'+id).textContent=breakers[id]?'合':'分';
    board.querySelector('[data-breaker="'+id+'"]').setAttribute('aria-pressed',String(breakers[id]));
  }
  const stages=powered?['已接通',...reading.stages,reading.socketState,tubeOn?'灯亮':'灯灭']:['已断电','已断电','已断电','已断电','已断电','已断电','灯灭'];
  $('feed').innerHTML=['板外进线','电能表','QF1 出线','QF2 出线','QF3 出线','插座','日光灯'].map((name,i)=>
    `<div class="feed-stage"><span>${name}</span><strong>${stages[i]}</strong></div>`).join('');
  const lit=powered && reading.lit;
  $('power').textContent=powered?'断开台面电源':'接通台面电源';
  $('powerState').textContent=powered?'电源已接通':'电源已断';
  $('lampState').textContent=lit?'灯亮':'灯灭';
  $('lampState').classList.toggle('on',lit);
  $('bulb').setAttribute('fill',lit?'url(#lit)':'url(#glass)');
  $('bulb').style.filter=lit?'drop-shadow(0 0 9px #ffce59)':'';
  for(const id of ['S1','S2','S3']){
    const switchFace=board.querySelector('[data-switch="'+id+'"]');
    switchFace.setAttribute('aria-pressed',String(!!positions[id]));
    switchFace.querySelector('.face').setAttribute('transform',positions[id]?'translate(0 2)':'');
    $('pos'+id).textContent=id==='S3'?(positions.S3?'闭合':'断开'):(positions[id]?'Ⅱ':'Ⅰ');
  }
  colors.disabled=size.disabled=powered;
  const keys=['00','01','10','11'];
  $('matrix').innerHTML=keys.map(key=>{
    const r=readings.get(key);
    return `<tr class="${testing && key===currentKey()?'current':''}"><td>${key[0]==='0'?'Ⅰ':'Ⅱ'}</td><td>${key[1]==='0'?'Ⅰ':'Ⅱ'}</td><td class="${r?.lit?'on':''}">${r?(r.lit?'● 灯亮':'○ 灯灭'):'—'}</td></tr>`;
  }).join('');
  $('count').textContent=readings.size+' / 4';
  let result='';
  if(readings.size===4){
    const [a,b,c,d]=keys.map(k=>readings.get(k));
    if(a.lit===d.lit && b.lit===c.lit && a.lit!==b.lit){
      result=keys.every(k=>readings.get(k).switchedLive)?'验证通过，两处均能独立切换灯态。':'双控动作正常。请复查灯座 L、N 和被开关控制的导线。';
    } else result='还有位置组合无法切换灯态。对照记录，找出哪只开关在哪个位置失效。';
  }
  if(result && keys.some(k=>!readings.get(k).properFeed))result='请核对取电与回线是否都经过电能表、QF1 和 QF3。';
  $('result').textContent=result;
  renderWires();
}
function edit(next) {
  checkMessage='';history.push(wires);
  wires=next;traffic=wireTraffic(wires);selected=null;pending=null;readings.clear();renderState();
}
function hitPort(id){
  if(powered){say('请先模拟断电，再调整导线。');return;}
  selected=null;
  if(!pending){
    pending={from:id,bends:[]};cursor=ports.get(id);
    say('起点为 '+ports.get(id).name+'。点击终点，或先点击板面设置拐点。');
  }else if(pending.from===id){pending=null;say(instruction);}
  else if(wires.some(w=>(w.a===id && w.b===pending.from)||(w.b===id && w.a===pending.from))){
    say('这两个端子之间已有导线。请另选终点或取消接线。');
  }else{
    const path=routeWire(ports.get(pending.from),ports.get(id),pending.bends,traffic);
    if(!path){say('当前路径无法通行，请取消后重新布线。');return;}
    edit([...wires,{path,id:++sequence,a:pending.from,b:id,bends:pending.bends,color:colors.value,size:size.value}]);
    say('导线已接好。可继续接线，或点击导线查看两端。');
  }
  renderWires();
}
function activate(target){
  const port=target.closest('[data-port]'), w=target.closest('[data-wire]'), sw=target.closest('[data-switch]');
  const breaker=target.closest('[data-breaker]');
  if(target.closest('[data-main-qf]')){
    if(pending)return true;
    motor.qf=!motor.qf;updateTraining();return true;
  }
  if(target.closest('[data-supply]'))$('power').click();
  else if(breaker){
    if(pending){say('请先完成或取消接线。');return;}
    const id=breaker.dataset.breaker;breakers[id]=!breakers[id];
    say(id+(breakers[id]?' 已合闸。':' 已分闸。'));renderState();
  }else if(port)hitPort(port.dataset.port);
  else if(sw){
    if(pending){say('请先完成或取消当前接线。');return;}
    positions[sw.dataset.switch]^=1;
    say(sw.dataset.switch+' 已拨动。'+(powered?'请查看灯态和供电路径。':'当前处于断电状态。'));
    renderState();
  }else if(w && !pending){
    selected=Number(w.dataset.wire);const item=wires.find(i=>i.id===selected);
    say(ports.get(item.a).name+' ↔ '+ports.get(item.b).name+'　·　'+item.size);
    renderWires();
  }else return false;
  return true;
}
function point(x,y){
  const p=new DOMPoint(x,y).matrixTransform(board.getScreenCTM().inverse());
  return {x:p.x,y:p.y};
}
function setView(){
  board.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
  $('percent').value=Math.round(fullView.w/view.w*100)+'%';
}
function zoom(factor,center){
  const width=Math.max(fullView.w/5,Math.min(fullView.w*1.2,view.w*factor)), scale=width/view.w;
  view={x:center.x+(view.x-center.x)*scale,y:center.y+(view.y-center.y)*scale,w:width,h:view.h*scale};
  setView();
}
const middle=()=>({x:view.x+view.w/2,y:view.y+view.h/2});
board.addEventListener('wheel',e=>{
  e.preventDefault();zoom(e.deltaY<0?.85:1/.85,point(e.clientX,e.clientY));
},{passive:false});
$('plus').onclick=()=>zoom(.8,middle()); $('minus').onclick=()=>zoom(1.25,middle());
$('fit').onclick=()=>{view={...fullView};setView();};
board.addEventListener('pointerdown',e=>{
  if(e.button!==0 || drag)return;
  const p=point(e.clientX,e.clientY);
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,p,target:e.target,moved:false};
  board.setPointerCapture(e.pointerId);
});
board.addEventListener('pointermove',e=>{
  if(drag && drag.id!==e.pointerId)return;
  const p=point(e.clientX,e.clientY);
  if(drag && (drag.moved || Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)){
    drag.moved=true;view.x+=drag.p.x-p.x;view.y+=drag.p.y-p.y;setView();
  }
  if(pending){
    const port=e.target.closest('[data-port]');
    cursor=port?ports.get(port.dataset.port):point(e.clientX,e.clientY);
    if(!previewFrame)previewFrame=requestAnimationFrame(previewWire);
  }
});
board.addEventListener('pointerup',e=>{
  if(!drag || e.pointerId!==drag.id)return;
  const d=drag;drag=null;
  if(d.moved || activate(d.target))return;
  if(pending){const entry=wireEntry(d.p);if(entry){pending.bends.push(entry[0]);cursor=d.p;}else say('请将拐点设在器件之间的空隙中。');}else selected=null;
  renderWires();
});
board.addEventListener('pointercancel',()=>{drag=null;});
board.addEventListener('keydown',e=>{
  if(['Enter',' '].includes(e.key)){e.preventDefault();activate(e.target);}
});
$('cancel').onclick=()=>{pending=null;renderWires();say(instruction);};
document.addEventListener('keydown',e=>{if(e.key==='Escape' && pending)$('cancel').click();});
$('undo').onclick=()=>{if(powered || !history.length)return;checkMessage='';wires=history.pop();traffic=wireTraffic(wires);selected=pending=null;readings.clear();renderState();say('已撤销上一次接线修改。');};
$('remove').onclick=()=>{if(powered || selected===null)return;edit(wires.filter(w=>w.id!==selected));say('导线已拆除。');};
colors.onchange=renderWires;
$('power').onclick=()=>{
  if(pending){say('请先完成或取消当前接线，再模拟送电。');return;}
  powered=!powered;selected=null;
  say(powered?'台面进线已接通。请查看供电状态，并依次操作总闸和各支路手柄。':instruction);
  renderState();
};
const hints=['先分开验证支路。断开 QF2 时观察插座，再合上 QF2、断开 QF3，观察两盏灯。','插座有电时也要核查 PE。检查板外 PE 到地排，再从地排追到插座端子。','检查双控灯时，固定 S1、拨动 S2，再换一个 S1 位置重试。','检查日光灯时，先拨 S3，再顺着镇流器端子排检查输入和四根输出。每组输出对应灯管同一端的两个针脚。'];
$('inspect').onclick=()=>{
  if(pending || powered)return;
  const checks=[0,1].flatMap(c=>[[0,0],[0,1],[1,0],[1,1]].map(([a,b])=>measureCircuit(wires,a,b,{QF1:true,QF2:true,QF3:true},c)));
  if(checks.some(r=>r.short))say('自检发现短路。请排查电源短接及相线碰地。');
  else if(!checks[0].upstreamMatches)say('供电段尚未接通或存在旁路。请从板外进线沿电能表、QF1、QF3 顺线检查。');
  else if(checks.some(r=>!r.properFeed || !r.switchedLive))say('供电段已接通。请检查灯座极性、零线回路和双控支路的取电位置。');
  else if(checks[0].lit===checks[1].lit || checks[0].lit!==checks[3].lit || checks[1].lit!==checks[2].lit)say('双控支路存在异常。请检查两只开关的公共端和联络线。');
  else if(!checks[0].socketWired)say('插座支路异常。请核查 QF2 的进出线、插座极性及经地排接入的 PE 线。');
  else if(checks.some((r,i)=>!r.tubeWired || r.tubeLit!==(i>=4)))say('日光灯支路异常。请核查 S3、锡焊点、镇流器输入及通往灯管两端的四根输出线。');
  else say('整题接线自检通过。可分别验证双控灯、S3 日光灯、插座和电能表。');
};
$('hint').onclick=()=>{$('hintText').hidden=false;$('hintText').textContent=hints[Math.min(hintStep++,hints.length-1)];};
const refItems=[['考试原理图','参考图/figure-'+exercise.figure+'.png']];
if(exercise.layout)refItems.push(['考位布局','参考图/figure-'+exercise.layout+'.png']);
if(taskId===2)refItems.push(['训练台实拍','mmexport1795521946757.jpg']);
refItems.push(['接线演示图','mmexport179552'+exercise.demo+'.jpg']);
function displayReference(i){
  const [name,src]=refItems[i];
  $('refImage').src=src;$('refImage').alt=exercise.title+' · '+name;$('refFull').href=src;
  [...$('refTabs').children].forEach((el,k)=>el.setAttribute('aria-pressed',String(k===i)));
}
refItems.forEach(([name],i)=>{
  const button=document.createElement('button');button.textContent=name;
  button.onclick=()=>displayReference(i);$('refTabs').append(button);
});
$('reference').onclick=()=>{displayReference(0);$('refs').showModal();};
$('close').onclick=()=>$('refs').close();
document.querySelector('h1').textContent=exercise.title;
document.querySelector('.heading small').textContent='低压电工实操　 /　 科目三';
document.title=exercise.title+' · 电工练习台';
for(const [id,item] of Object.entries(exercises)){
  $('taskSelect').add(new Option(id+'　'+item.title,id));
}
$('taskSelect').value=taskId;
const storageKey=id=>'wiring-exercise-v1-'+id;
$('taskSelect').onchange=()=>{
  // 切题保留这一页的接线，重新进入时从断电状态开始。
  try{sessionStorage.setItem(storageKey(taskId),JSON.stringify(wires));}catch{}
  const url=new URL(location.href);url.searchParams.set('task',$('taskSelect').value);location.href=url.href;
};
try{
  const saved=JSON.parse(sessionStorage.getItem(storageKey(taskId))||'[]');
  if(Array.isArray(saved))for(const w of saved){
    if(!ports.has(w.a)||!ports.has(w.b)||!Array.isArray(w.bends))continue;
    const path=routeWire(ports.get(w.a),ports.get(w.b),w.bends,traffic);
    if(path){wires.push({...w,path,id:++sequence});traffic=wireTraffic(wires);}
  }
  sessionStorage.removeItem(storageKey(taskId));
}catch{}
if(taskId!==2)installTraining();
say(instruction);renderState();
