// 器件及其固定引线的外包框。端子沿朝向离开器件，再在可布线区寻路。
const wireObstacles=taskId!==2?equipmentBounds:[
  [96,38,207,156],[273,52,488,130],[510,96,583,129],
  [610,74,680,107],[640,166,678,343],[685,107,725,367],[605,369,700,399],
  [399,215,477,284],[504,228,555,260],[158,246,312,310],[238,213,293,247],
  [72,382,92,465],[140,367,230,492],[348,367,428,492],[508,367,588,492]
];
const pitch=6, cols=116, rows=81;
const gridPoint=i=>({x:52+(i%cols)*pitch,y:27+Math.floor(i/cols)*pitch});
const gridIndex=p=>Math.round((p.y-27)/pitch)*cols+Math.round((p.x-52)/pitch);
const insideGrid=p=>p.x>=52 && p.x<=742 && p.y>=27 && p.y<=507;
const freeCells=Uint8Array.from({length:cols*rows},(_,i)=>{
  const {x,y}=gridPoint(i);
  return !wireObstacles.some(([l,t,r,b])=>x>=l-4 && x<=r+4 && y>=t-4 && y<=b+4);
});
function wireEntry(p){
  // 板外进线水平跨过边框，在板内边沿接入走线网格。
  if(p.exit && p.x<37){
    const entry=gridPoint(gridIndex({x:52,y:p.y}));
    return [p,{x:entry.x,y:p.y},entry];
  }
  if(!p.exit){
    if(!insideGrid(p) || !freeCells[gridIndex(p)])return null;
    return [gridPoint(gridIndex(p))];
  }
  const [dx,dy]=p.exit;
  for(let distance=10;distance<72;distance+=pitch){
    const q={x:p.x+dx*distance,y:p.y+dy*distance};
    if(!insideGrid(q))break;
    const i=gridIndex(q);
    if(freeCells[i]){
      const end=gridPoint(i);
      return [p,dx?{x:end.x,y:p.y}:{x:p.x,y:end.y},end];
    }
  }
  return null;
}
function simplifyPath(points){
  const path=[];
  for(const p of points){
    const prev=path.at(-1), first=path.at(-2);
    if(prev && prev.x===p.x && prev.y===p.y)continue;
    if(first && ((first.x===prev.x && prev.x===p.x)||(first.y===prev.y && prev.y===p.y)))path.pop();
    path.push(p);
  }
  return path;
}
// 同向重叠代价高，单点交叉代价低，使相邻导线有各自的走线位置。
function wireTraffic(wires){
  const busy=new Uint8Array(cols*rows*2);
  for(const {path} of wires){
    for(let j=1;j<path.length;j++){
      const a=path[j-1],b=path[j],axis=a.y===b.y?0:1;
      const length=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
      for(let d=0;d<=length;d+=pitch){
        const p={x:a.x+Math.sign(b.x-a.x)*d,y:a.y+Math.sign(b.y-a.y)*d};
        if(insideGrid(p))busy[2*gridIndex(p)+axis]=1;
      }
    }
  }
  return busy;
}
function gridRoute(from,to,busy){
  const start=gridIndex(from),goal=gridIndex(to),queue=[];
  const costs=new Float64Array(freeCells.length*2).fill(Infinity);
  const parent=new Int32Array(costs.length).fill(-1);
  function push(state,cost){
    const index=state>>1,p=gridPoint(index);
    const priority=cost+(Math.abs(p.x-to.x)+Math.abs(p.y-to.y))/pitch;
    let pos=queue.length;
    while(pos>0){
      const up=(pos-1)>>1;
      if(queue[up].priority<=priority)break;
      queue[pos]=queue[up];pos=up;
    }
    queue[pos]={state,cost,priority};
  }
  function pop(){
    const first=queue[0],last=queue.pop();
    if(queue.length){
      let pos=0;
      while(pos*2+1<queue.length){
        let child=pos*2+1;
        if(child+1<queue.length && queue[child+1].priority<queue[child].priority)child++;
        if(last.priority<=queue[child].priority)break;
        queue[pos]=queue[child];pos=child;
      }
      queue[pos]=last;
    }
    return first;
  }
  for(const axis of [0,1]){costs[2*start+axis]=0;push(2*start+axis,0);}
  while(queue.length){
    const {state,cost}=pop(),i=state>>1;
    if(cost!==costs[state])continue;
    if(i===goal){
      const result=[];
      for(let s=state;s>=0;s=parent[s])result.push(gridPoint(s>>1));
      return result.reverse();
    }
    for(const step of [-1,1,-cols,cols]){
      const j=i+step,axis=Math.abs(step)===1?0:1;
      if(!freeCells[j] || (!axis && Math.floor(j/cols)!==Math.floor(i/cols)))continue;
      const next=j*2+axis;
      const score=cost+1+((state&1)!==axis?5:0)+busy[next]*9+busy[next^1]*2;
      if(score<costs[next]){costs[next]=score;parent[next]=state;push(next,score);}
    }
  }
  return null;
}
function routeWire(a,b,bends,busy){
  const start=wireEntry(a),end=wireEntry(b);
  if(!start || !end)return null;
  let last=start.at(-1);
  const path=[...start];
  for(const next of [...bends,end.at(-1)]){
    const leg=gridRoute(last,next,busy);
    if(!leg)return null;
    path.push(...leg);last=next;
  }
  return simplifyPath([...path,...end.slice().reverse()]);
}
