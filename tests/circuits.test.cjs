// node --test tests/circuits.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={location:{search:''},URLSearchParams};
vm.createContext(sandbox);
for(const name of ['exercises','circuit','training-circuit']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'),sandbox);
}

// 根据原图分段录入的接线样本。相邻端点顺次跨接，与程序的校验表独立。
function sample(id){
  const wires=[];
  function line(s){
    const p=s.split(' ');
    for(let i=1;i<p.length;i++)wires.push({a:p[i-1],b:p[i]});
  }
  if(id===1){
    ['电源.L QF1.1','电源.N QF1.3','QF1.2 SPD.L QF2.L QF3.L QF4.L QF5.L',
      'QF1.4 零排.N1','零排.N2 SPD.N','零排.N3 QF2.N','零排.N4 QF3.N',
      '电源.PE 地排.PE1','地排.PE2 箱体.PE','地排.PE3 SPD.PE'].forEach(line);
    return wires;
  }
  const km=id===5?'KM1':'KM';
  for(let i=1;i<=3;i++){
    line('电源.L'+i+' QF.L'+i);line('QF.T'+i+' FU1.L'+i);
    if(i<3)line('FU1.L'+i+' FU2.L'+i);
    line('FU1.T'+i+' '+km+'.L'+i);
    if(id===5){line(km+'.L'+i+' KM2.L'+i);line('KM2.T'+(4-i)+' FR.L'+i);}
    if(id===4){
      line(km+'.T'+i+' TA'+i+'.P1');line('TA'+i+'.P2 FR.L'+i);
      line('TA'+i+'.S1 PA'+i+'.1');line('PA'+i+'.2 TA'+i+'.S2 地排.PE2');
    }else line(km+'.T'+i+' FR.L'+i);
    line('FR.T'+i+' XT.'+['U','V','W'][i-1]);
  }
  line('电源.PE 地排.PE1');line('地排.PE2 XT.PE');line('FU2.T1 FR.95');
  if(id===3){
    ['FR.96 SB3.11','SB3.12 SB2.13 SB1.13 SB1.21','SB1.22 KM.13',
      'SB2.14 SB1.14 KM.14 KM.A1','KM.A2 接头.2','接头.1 FU2.T2'].forEach(line);
  }else if(id===4){
    ['FR.96 SB2.11','SB2.12 接头.1','接头.2 SB1.13','接头.3 KM.13',
      'SB1.14 KM.14 KM.A1','KM.A2 FU2.T2'].forEach(line);
  }else{
    ['FR.96 SB3.11','SB3.12 KM1.13 SB1.13 SB2.13 KM2.13',
      'SB1.14 KM1.14 KM2.21','KM2.22 KM1.A1','SB2.14 KM2.14 KM1.21',
      'KM1.22 KM2.A1','FU2.T2 KM1.A2 KM2.A2'].forEach(line);
  }
  return wires;
}
function operate(id,wires=sample(id)){
  const state={qf:true,power:true,coils:0,overload:false,pressed:new Set()};
  return (buttons=[],changes={})=>{
    Object.assign(state,changes,{pressed:new Set(buttons)});
    const r=sandbox.motorResponse(id,wires,state);state.coils=r.coils||0;state.jogWasDown=r.jogWasDown;return r;
  };
}
for(const id of [1,3,4,5])test('第 '+id+' 题图纸接线与逐根漏线',()=>{
  const wires=sample(id);
  assert.equal(sandbox.inspectTraining(id,wires),'');
  for(const wire of wires)assert.ok(sandbox.inspectTraining(id,wires.filter(w=>w!==wire)),JSON.stringify(wire));
});
test('第 3 题点动、连续、自锁、停止、失电及热保护',()=>{
  const step=operate(3);
  for(const [buttons,want] of [[[],0],[['SB1'],1],[[],0],[['SB2'],1],[[],1],[['SB3'],0],[[],0]]){
    assert.equal(step(buttons).coils,want);
  }
  step(['SB2']);assert.equal(step([],{overload:true}).coils,0);
  assert.equal(step([],{overload:false}).coils,0);
  assert.equal(step(['SB2']).direction,'正转');assert.equal(step([],{power:false}).direction,'停止');
  assert.equal(step([],{power:true}).direction,'停止');
  const bad=operate(3,sample(3).filter(w=>w.b!=='KM.13'));
  assert.equal(bad(['SB2']).coils,1);assert.equal(bad().coils,0);
});
test('第 4 题各相仪表和互感器二次回路',()=>{
  const step=operate(4);assert.deepEqual([...step().gauges],Array(3).fill('无电流'));
  assert.equal(step(['SB1']).coils,1);assert.deepEqual([...step().gauges],Array(3).fill('有电流'));
  assert.equal(step(['SB2']).direction,'停止');
  const open=operate(4,sample(4).filter(w=>w.b!=='PA2.1'));
  assert.match(open(['SB1']).fault,/TA2 二次/);
});
test('第 5 题两个方向、自锁、互锁及停止后再换向',()=>{
  const step=operate(5);
  assert.equal(step(['SB1']).direction,'正转');assert.equal(step().coils,1);
  assert.equal(step(['SB2']).coils,1);assert.equal(step(['SB3']).coils,0);
  assert.equal(step(['SB2']).direction,'反转');assert.equal(step().coils,2);
  assert.equal(step(['SB1']).coils,2);assert.equal(step(['SB3']).direction,'停止');
  const same=sample(5).map(w=>w.a==='KM2.T1'?{...w,a:'KM2.T3'}:w.a==='KM2.T3'?{...w,a:'KM2.T1'}:w);
  assert.equal(operate(5,same)(['SB2']).direction,'正转');
});
test('交流表端子对调仍能通过核对并响应',()=>{
  const flip=p=>p==='PA1.1'?'PA1.2':p==='PA1.2'?'PA1.1':p;
  const wires=sample(4).map(({a,b})=>({a:flip(a),b:flip(b)}));
  assert.equal(sandbox.inspectTraining(4,wires),'');
  assert.equal(operate(4,wires)(['SB1']).gauges[0],'有电流');
});
test('缺相、碰地、相间短路及总开关隔离',()=>{
  const missing=operate(3,sample(3).filter(w=>w.b!=='XT.W'));
  assert.match(missing(['SB2']).direction,/缺相/);
  for(const terminal of ['XT.PE','QF.T2']){
    const step=operate(3,[...sample(3),{a:'QF.T1',b:terminal}]);
    assert.equal(step([],{qf:false}).coils,0);assert.match(step([],{qf:true}).fault,/跳闸/);
  }
});
module.exports={sample};
