// 线路连通性与器件动作分开。灯和镇流器是负载，不将其电源端短接。
function network(edges){
  const links=new Map(), cache=new Map();
  for(const [a,b] of edges){
    if(!links.has(a))links.set(a,[]);
    if(!links.has(b))links.set(b,[]);
    links.get(a).push(b);links.get(b).push(a);
  }
  return function nodes(id){
    if(cache.has(id))return cache.get(id);
    const group=new Set([id]);
    for(const item of group)for(const next of links.get(item)||[])group.add(next);
    for(const item of group)cache.set(item,group);
    return group;
  };
}
function measureCircuit(wires,s1,s2,breakers,s3=0){
  const leads=wires.map(w=>[w.a,w.b]);
  const raw=network(leads);
  const fixed=[['PE1','PE2'],['J1','J2']];
  const branch=network([...leads,...fixed]);
  const controls=[['S1L',s1?'S1L2':'S1L1'],['S2L',s2?'S2L2':'S2L1']];
  if(s3)controls.push(['S3L','S3L1']);
  for(const [id,on] of Object.entries(breakers)){
    if(on)for(const t of ['L','N'])controls.push([id+'in'+t,id==='QF3'?t:id+'out'+t]);
  }
  const edges=[...leads,...fixed,...controls,['M3','M4']];
  const nodes=network([...edges,['M1','M2']]);
  const live=nodes('srcL'),neutral=nodes('srcN'),earth=nodes('srcPE');
  const short=live.has('srcN') || live.has('srcPE');
  const fed=(l,n)=>!short && live.has(l) && neutral.has(n);
  const lit=fed('lampL','lampN') || fed('lampN','lampL');
  const group=(a,b)=>raw(a).has(b);
  const feedPairs=[['srcL','M1'],['srcN','M3'],['M2','QF1inL'],['M4','QF1inN'],
    ['QF1outL','QF3inL'],['QF1outN','QF3inN']];
  const feedGroups=feedPairs.map(([a])=>raw(a));
  const upstreamMatches=feedPairs.every(([a,b])=>group(a,b)) &&
    new Set(feedGroups).size===feedGroups.length &&
    ['L','N','QF2outL','QF2outN'].every(t=>!feedGroups.includes(raw(t)));
  const bulbReturn=branch('N').has('lampN');
  const fromLampBranch=network([...leads,...fixed,...controls.filter(([a])=>a.startsWith('S'))])('L');
  const properFeed=upstreamMatches && bulbReturn && (!lit || fromLampBranch.has('lampL'));
  // 同一灯丝的两针、整组灯丝两端均可互换；每一根输出须独立到一针。
  const pinMap=[0,1,2,3].map(i=>{
    const matches=[0,1,2,3].filter(j=>group('out'+i,'pin'+j));
    return matches.length===1 && raw('out'+i).size===2?matches[0]:-1;
  });
  const tubePins=pinMap.every(n=>n>=0) && new Set(pinMap).size===4 &&
    Math.floor(pinMap[0]/2)===Math.floor(pinMap[1]/2);
  const tubeLit=fed('BinL','BinN') && tubePins;
  const jointInPath=['J1','J2'].some((id,i)=>group('N',id) && group(i?'J1':'J2','BinN') && !group('N','BinN'));
  const tubeWired=tubePins && jointInPath && group('L','S3L') && group('S3L1','BinL') &&
    !group('S3L','S3L1') && !group('QF2outL','BinL');
  const peViaBar=['PE1','PE2'].some((id,i)=>group('srcPE',id) && group(i?'PE1':'PE2','sockPE'));
  const socketWired=['L','N'].every(t=>group('QF1out'+t,'QF2in'+t) && group('QF2out'+t,'sock'+t) &&
    !group('QF2out'+t,t) && !group('QF2in'+t,'QF2out'+t)) && peViaBar && !earth.has('srcN');
  const socketFed=fed('sockL','sockN');
  const meterFed=fed('M1','M3');
  const bypass=network(edges)('srcL');
  const watts=meterFed?((lit && !bypass.has('lampL') && !bypass.has('lampN')?40:0)+
    (tubeLit && !bypass.has('BinL')?36:0)):0;
  function supplyState(l,n){
    if(fed(l,n))return '供电正常';
    if(live.has(n))return '极性异常';
    if(live.has(l))return '缺零线';
    if(neutral.has(n))return '仅零线接通';
    return '未接通';
  }
  return {short,lit,properFeed,upstreamMatches,meterFed,watts,tubeLit,tubeWired,socketWired,
    socketState:live.has('sockPE')?'PE 异常带电':socketFed?(earth.has('sockPE')?'供电正常':'缺保护地线'):supplyState('sockL','sockN'),
    stages:[supplyState('M1','M3'),supplyState('QF1outL','QF1outN'),supplyState('QF2outL','QF2outN'),supplyState('L','N')],
    branchFed:fed('L','N'),switchedLive:!short && neutral.has('lampN') && !live.has('lampN')};
}
