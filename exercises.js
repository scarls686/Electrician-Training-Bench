// 图号按 Word 中各题的图片关系取得，原理图与接线演示分开显示。
const exercises={
  1:{title:'低压配电箱安装接线',figure:1,demo:'1914317',task:'完成箱体接地、零地排及各分路接线后，进行断电自检。'},
  2:{title:'单相电能表带照明设备接线',figure:2,layout:3,demo:'1921029'},
  3:{title:'单向连续运转与点动控制',figure:4,layout:5,demo:'1916664',task:'分别验证 SB1 点动、SB2 连续启动和 SB3 停止，观察松开按钮后的状态。'},
  4:{title:'带仪表和电流互感器的电动机接线',figure:6,layout:7,demo:'1918845',task:'验证 SB1 启动、自锁、SB2 停止，并检查三相电流表的响应。'},
  5:{title:'三相异步电动机正反转',figure:8,layout:9,demo:'1923094',task:'验证 SB1 正转、SB2 反转、SB3 停止，以及两只接触器之间的电气互锁。'}
};
const queryTask=Number(new URLSearchParams(location.search).get('task'));
const taskId=Object.hasOwn(exercises,queryTask)?queryTask:2;
const exercise=exercises[taskId];
const equipmentBounds=[];

// 每组表示题图上同电位的一组端子，允许星形、串接等电气等效的布线。
function referenceGroups(id){
  const nets=[];
  const net=(section,...pins)=>nets.push({section,pins});
  const main=(...pins)=>net('主回路',...pins);
  const ctl=(...pins)=>net('控制回路',...pins);
  if(id===1){
    net('总开关','电源.L','QF1.1');net('总开关','电源.N','QF1.3');
    net('相线分配','QF1.2','SPD.L','QF2.L','QF3.L','QF4.L','QF5.L');
    net('零线排','QF1.4','零排.N1','SPD.N','QF2.N','QF3.N');
    net('保护接地','电源.PE','地排.PE1','SPD.PE','箱体.PE');
    return nets;
  }
  const dual=id===5,k=dual?'KM1':'KM';
  for(const [i,t] of ['U','V','W'].entries()){
    const n=i+1;
    main('电源.L'+n,'QF.L'+n);
    main('QF.T'+n,'FU1.L'+n,...(n<=2?['FU2.L'+n]:[]));
    main('FU1.T'+n,k+'.L'+n,...(dual?['KM2.L'+n]:[]));
    if(id===4){
      main(k+'.T'+n,'TA'+n+'.P1');main('TA'+n+'.P2','FR.L'+n);
      net('仪表回路','TA'+n+'.S1','PA'+n+'.1');
    }else main(k+'.T'+n,'FR.L'+n,...(dual?['KM2.T'+(4-n)]:[]));
    main('FR.T'+n,'XT.'+t);
  }
  net('保护接地','电源.PE','地排.PE1','XT.PE',...(id===4?
    [1,2,3].flatMap(n=>['TA'+n+'.S2','PA'+n+'.2']):[]));
  ctl('FU2.T1','FR.95');ctl('FR.96',id===4?'SB2.11':'SB3.11');
  if(id===3){
    ctl('SB3.12','SB1.13','SB1.21','SB2.13');ctl('SB1.22','KM.13');
    ctl('SB1.14','SB2.14','KM.14','KM.A1');ctl('KM.A2','接头.2');ctl('接头.1','FU2.T2');
  }else if(id===4){
    ctl('SB2.12','接头.1');ctl('接头.2','SB1.13');ctl('接头.3','KM.13');
    ctl('SB1.14','KM.14','KM.A1');ctl('KM.A2','FU2.T2');
  }else{
    ctl('SB3.12','SB1.13','KM1.13','SB2.13','KM2.13');
    ctl('SB1.14','KM1.14','KM2.21');ctl('KM2.22','KM1.A1');
    ctl('SB2.14','KM2.14','KM1.21');ctl('KM1.22','KM2.A1');
    ctl('KM1.A2','KM2.A2','FU2.T2');
  }
  return nets;
}
function motorParts(id){
  const parts=[],dual=id===5;
  function part(name,kind,x,y,width,top,bottom,caption=''){
    parts.push({name,kind,x,y,width,top,bottom,caption});
  }
  const three=['L1','L2','L3'],out=['T1','T2','T3'];
  part('QF','breaker',140,52,88,three,out);
  part('FU1','fuse',243,52,84,three,out);
  part('FU2','fuse',342,52,62,three.slice(0,2),out.slice(0,2));
  function km(name,x){part(name,'contactor',x,183,dual?168:158,
    [...three,'13',...(dual?['21']:[]),'A1'],[...out,'14',...(dual?['22']:[]),'A2']);}
  km(dual?'KM1':'KM',160);if(dual)km('KM2',356);
  part('FR','relay',160,310,137,[...three,'95'],[...out,'96']);
  part('XT','terminal',159,430,148,['U','V','W','PE'],[],'电动机端子排');
  part('地排','earth',65,353,64,['PE1','PE2'],[]);
  if(id===3 || id===4)part('接头','joint',id===4?370:420,id===4?320:76,87,[],id===4?['1','2','3']:['1','2'],id===4?'T 字接头':'一字接头');
  if(id===4){
    for(let n=1;n<=3;n++){
      const x=452+(n-1)*93;
      part('PA'+n,'meter',x,50,78,[],['1','2']);
      part('TA'+n,'ct',x,180,78,['P1','S1'],['P2','S2']);
    }
  }
  const buttons=id===4?[['启动','13','14'],['停止','11','12']]:
    id===5?[['正转','13','14'],['反转','13','14'],['停止','11','12']]:
    [['点动','13','14','21','22'],['连续','13','14'],['停止','11','12']];
  buttons.forEach(([caption,...pins],i)=>part('SB'+(i+1),'button',440+i*96,415,86,pins,[],caption));
  return parts;
}
function panelParts(){
  return [
    ['QF1','breaker',68,137,83,['1','3'],['2','4'],'总开关'],
    ['SPD','spd',166,137,77,['L','N'],['PE'],'电涌保护'],
    ['QF2','breaker',258,137,100,['L','N'],['L出','N出'],'厨卫插座'],
    ['QF3','breaker',373,137,100,['L','N'],['L出','N出'],'房间插座'],
    ['QF4','breaker',490,137,85,['L'],['L出'],'照明一'],
    ['QF5','breaker',590,137,85,['L'],['L出'],'照明二'],
    ['地排','earth',105,337,139,['PE1','PE2','PE3','PE4'],[],'地线排'],
    ['箱体','earth',289,337,72,['PE'],[],'接地螺柱'],
    ['零排','neutral',487,337,145,['N1','N2','N3','N4'],[],'零线排']
  ].map(([name,kind,x,y,width,top,bottom,caption])=>({name,kind,x,y,width,top,bottom,caption}));
}
