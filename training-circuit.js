function fixedLinks(id){
  const links=[['地排.PE1','地排.PE2']];
  if(id===1){
    for(let i=2;i<=4;i++)links.push(['零排.N1','零排.N'+i],['地排.PE1','地排.PE'+i]);
  }
  return links;
}
function inspectTraining(id,wires){
  const edges=wires.map(w=>[w.a,w.b]),fixed=fixedLinks(id);
  const actual=network([...edges,...fixed]),groups=referenceGroups(id);
  const expected=network([...fixed,...groups.flatMap(g=>g.pins.slice(1).map(p=>[g.pins[0],p]))]);
  // 普通交流表的两接线柱、交流线圈两端、同一副无源触点两端可互换。
  // 比较各电位组的成员及数量，仍能区分触点旁路、两相短接和悬空。
  const allPins=new Set([...fixed.flat(),...edges.flat(),...groups.flatMap(g=>g.pins)]);
  const interchangeable=pin=>pin
    .replace(/^(PA\d+)\.[12]$/,'$1.表端')
    .replace(/^(KM\d*)\.A[12]$/,'$1.线圈')
    .replace(/^(KM\d*|SB\d+)\.1[34]$/,'$1.常开')
    .replace(/^(KM\d*|SB\d+)\.2[12]$/,'$1.常闭')
    .replace(/^(SB\d+)\.1[12]$/,'$1.停止')
    .replace(/^FR\.9[56]$/,'FR.常闭')
    .replace(/^接头\.[123]$/,'接头.线端');
  function signature(nodes){
    const nets=new Set([...allPins].map(nodes));
    return [...nets].map(group=>[...group].map(interchangeable).sort().join('|')).sort().join(';');
  }
  if(signature(actual)===signature(expected))return '';
  for(const {section,pins} of groups){
    const [p]=pins;
    if([...actual(p)].some(t=>!expected(p).has(t)))return section+'出现跨接，请沿所选导线检查两端。';
    if(pins.some(t=>!actual(p).has(t)))return section+'未按原理图连通，请核对 '+p+' 所在支路。';
  }
  for(const [a,b] of edges)if(!expected(a).has(b))return '存在题图以外的跨接，请核对 '+a+'。';
  return '';
}
function motorResponse(id,wires,state){
  // SB1 两副触点先断后合。松开点动按钮时须先求常开已断、
  // 常闭尚未恢复的中间态，让接触器有机会释放。
  const jogDown=id===3 && state.pressed.has('SB1');
  if(id===3 && jogDown!==Boolean(state.jogWasDown)){
    const gap=settleMotor(id,wires,state,true);
    if(gap.fault)return gap;
    state={...state,coils:gap.coils};
  }
  return {...settleMotor(id,wires,state,false),jogWasDown:jogDown};
}
function settleMotor(id,wires,state,jogGap){
  const leads=wires.map(w=>[w.a,w.b]),phases=['电源.L1','电源.L2','电源.L3'];
  const common=[...leads,...fixedLinks(id)];
  for(let n=1;n<=3;n++){
    if(state.qf)common.push(['QF.L'+n,'QF.T'+n]);
    common.push(['FU1.L'+n,'FU1.T'+n],['FR.L'+n,'FR.T'+n]);
    if(n<=2)common.push(['FU2.L'+n,'FU2.T'+n]);
    if(id===4)common.push(['TA'+n+'.P1','TA'+n+'.P2']);
  }
  if(id===3 || id===4)common.push(['接头.1','接头.2']);
  if(id===4)common.push(['接头.1','接头.3']);
  if(!state.overload)common.push(['FR.95','FR.96']);
  const stop=id===4?'SB2':'SB3';
  if(!state.pressed.has(stop))common.push([stop+'.11',stop+'.12']);
  for(const btn of ['SB1',...(id===4?[]:['SB2'])]){
    if(state.pressed.has(btn) && !(jogGap && btn==='SB1'))common.push([btn+'.13',btn+'.14']);
  }
  if(id===3 && !jogGap && !state.pressed.has('SB1'))common.push(['SB1.21','SB1.22']);
  const names=id===5?['KM1','KM2']:['KM'];
  let coils=state.power?state.coils:0;
  const visited=new Set();
  while(!visited.has(coils)){
    visited.add(coils);
    const contacts=[];
    names.forEach((k,i)=>{
      if(coils&(1<<i)){
        for(let n=1;n<=3;n++)contacts.push([k+'.L'+n,k+'.T'+n]);
        contacts.push([k+'.13',k+'.14']);
      }else if(id===5)contacts.push([k+'.21',k+'.22']);
    });
    const nodes=network([...common,...contacts]);
    const phase=t=>state.power?phases.findIndex(p=>nodes(t).has(p)):-1;
    if(state.power && phases.some((p,i)=>phases.slice(i+1).some(q=>nodes(p).has(q)) || nodes(p).has('电源.PE'))){
      return {fault:'检测到相间短接或碰地，操作台已跳闸。'};
    }
    const next=names.reduce((mask,k,i)=>{
      const a=phase(k+'.A1'),b=phase(k+'.A2');
      return a>=0 && b>=0 && a!==b?mask|(1<<i):mask;
    },0);
    if(coils!==next){coils=next;continue;}
    const seq=['U','V','W'].map(t=>phase('XT.'+t));
    const running=!seq.includes(-1) && new Set(seq).size===3;
    const direction=running?((seq[1]-seq[0]+3)%3===1?'正转':'反转'):(seq.every(n=>n<0)?'停止':'相序或缺相异常');
    const gauges=[];
    if(id===4){
      const sec=network([...leads,...fixedLinks(id)]);
      for(let n=1;n<=3;n++){
        const ta='TA'+n,pa='PA'+n;
        const secondary=['1','2'].some((pin,i)=>sec(ta+'.S1').has(pa+'.'+pin) &&
          sec(ta+'.S2').has(pa+'.'+(i?1:2))) && !sec(ta+'.S1').has(ta+'.S2');
        // 移去该相穿心通路，确认该互感器实际处在电动机供电路径上。
        const without=network([...common.filter(([a,b])=>a!==ta+'.P1' || b!==ta+'.P2'),...contacts]);
        const carries=running && ['U','V','W'].some(t=>!phases.some(p=>without('XT.'+t).has(p)));
        if(carries && !secondary)return {fault:ta+' 二次回路异常，模拟送电已中止。'};
        gauges.push(carries?'有电流':'无电流');
      }
    }
    return {coils,direction,gauges,grounded:nodes('XT.PE').has('电源.PE')};
  }
  return {fault:'接触器状态无法稳定，请检查控制回路和互锁。'};
}
