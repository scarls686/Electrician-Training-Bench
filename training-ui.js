const motor={qf:false,overload:false,coils:0,pressed:new Set()};
let checkMessage='';
function updateTraining(){
  if(taskId===1){
    $('feed').textContent=wires.length+' 根导线已接入。';
  }else{
    const solve=()=>motorResponse(taskId,wires,{...motor,power:powered});
    let status=solve();
    if(status.fault){
      say(status.fault);powered=false;motor.coils=0;status=solve();
    }
    motor.coils=status.coils;motor.jogWasDown=status.jogWasDown;
    $('motorFan').classList.toggle('turning',status.direction==='正转'||status.direction==='反转');
    $('motorFan').style.animationDirection=status.direction==='反转'?'reverse':'normal';
    $('power').textContent=powered?'断开台面电源':'接通台面电源';
    $('powerState').textContent=powered?'台面有电':'台面断电';
    $('lampState').textContent='电动机'+status.direction;
    const entries=[['QF',motor.qf?'合闸':'分闸'],['热继电器',motor.overload?'动作':'复位'],
      ['电动机',status.direction],['机壳 PE',status.grounded?'已接地':'未接地']];
    (taskId===5?['KM1','KM2']:['KM']).forEach((k,i)=>entries.push([k,motor.coils&(1<<i)?'吸合':'释放']));
    status.gauges.forEach((value,i)=>{
      entries.push(['PA'+(i+1),value]);$('needlePA'+(i+1)).setAttribute('transform',value==='有电流'?'rotate(64 '+(491+93*i)+' 90)':'');
    });
    $('feed').innerHTML=entries.map(([k,v])=>`<div class="feed-stage"><span>${k}</span><strong>${v}</strong></div>`).join('');
    board.querySelector('[data-main-qf]').setAttribute('aria-pressed',String(motor.qf));
    board.querySelector('[data-main-qf] text').textContent=motor.qf?'合闸':'分闸';
    $('overload').textContent=motor.overload?'复位热继电器':'模拟热继电器动作';
    board.querySelectorAll('[data-press]').forEach(el=>{
      const pressed=motor.pressed.has(el.dataset.press);
      el.setAttribute('aria-pressed',String(pressed));
      el.style.filter=pressed?'brightness(.65)':'';
    });
  }
  $('result').textContent=checkMessage;
  colors.disabled=size.disabled=powered;renderWires();
}
function installTraining(){
  document.querySelector('aside section small+h2').textContent=taskId===1?'配电箱断电接线检查':'接线与试车';
  document.querySelector('aside section p').textContent=exercise.task;
  document.querySelector('#feed+small').textContent=taskId===1?'分路出线端按原图留空；箱体和电涌保护器接入地排。':
    'XT 外侧已接电机，SB 接线孔对应按钮端子排。FU2 按演示图从 QF 出线的两相取电。'+(taskId===4?'P1、P2 表示穿心方向，仪表指针只表示有无电流。':'');
  const verify=$('matrix').closest('section');
  verify.replaceChildren();
  const title=document.createElement('h2');title.textContent='题图核对';verify.append(title);
  const note=document.createElement('p');note.textContent='断电自检按本板标注的端号比对原理图。相同电位的端子可用不同顺序连接。';verify.append(note);
  const result=document.createElement('p');result.id='result';verify.append(result);
  if(taskId===1){
    $('power').hidden=true;$('powerState').textContent='断电检查';$('lampState').hidden=true;
    document.querySelector('#feed').previousElementSibling.textContent='配电箱';
  }else{
    const btn=document.createElement('button');btn.id='overload';verify.append(btn);
    btn.onclick=()=>{motor.overload=!motor.overload;updateTraining();};
  }
  $('inspect').onclick=()=>{
    const issue=inspectTraining(taskId,wires);
    checkMessage=issue||'已按本板端号接通题图中的所有支路。';say(checkMessage);updateTraining();
  };
  $('hint').onclick=()=>{
    $('hintText').hidden=false;
    $('hintText').textContent=taskId===1?'沿总开关出线检查各分路，并分别追踪零排和地排。':
      taskId===3?'按住点动时，SB1 的常闭触点切断自锁支路。松手后检查 KM 是否释放。':
      taskId===4?'依次检查每相穿过的互感器、对应电流表和二次接地点。':
      '先正转，再按反转。核对另一接触器的常闭辅助触点是否能阻止同时吸合。';
  };
  if(taskId===1)return;
  const pointers=new Map();
  function press(name){if(!pending){motor.pressed.add(name);updateTraining();}}
  function release(name){if(motor.pressed.delete(name))updateTraining();}
  board.addEventListener('pointerdown',e=>{
    const el=e.target.closest('[data-press]');
    if(!el || e.button!==0)return;
    e.stopImmediatePropagation();pointers.set(e.pointerId,el.dataset.press);
    board.setPointerCapture(e.pointerId);press(el.dataset.press);
  },true);
  function end(e){
    const name=pointers.get(e.pointerId);
    if(name){pointers.delete(e.pointerId);release(name);}
  }
  board.addEventListener('pointerup',end,true);board.addEventListener('lostpointercapture',end);
  board.addEventListener('keydown',e=>{
    const el=e.target.closest('[data-press]');
    if(el && [' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)press(el.dataset.press);}
  });
  board.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key))release(e.target.closest('[data-press]')?.dataset.press);});
  board.addEventListener('focusout',e=>release(e.target.closest('[data-press]')?.dataset.press));
  window.addEventListener('blur',()=>{motor.pressed.clear();updateTraining();});
}
