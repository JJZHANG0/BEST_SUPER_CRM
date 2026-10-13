'use client';
import {useMemo,useState} from 'react';
import {Users} from 'lucide-react';

export type PieSlice={id:string;label:string;sub?:string;value:number};

// Theme-aware palette: first slice is the active theme accent, the rest are
// hue companions blended toward it so every theme stays coherent.
const HUES=['#3f8fe0','#e0679b','#2fae86','#e3a43c','#7a6ae6','#d0644a','#38b5c4','#a3b23a'];
export const sliceColor=(i:number)=>i===0?'var(--nx-accent, #8050db)':`color-mix(in oklab, ${HUES[(i-1)%HUES.length]} 82%, var(--nx-accent, #8050db))`;
const shade=(c:string,p:number)=>`color-mix(in oklab, ${c} ${p}%, #1b1030)`;

const CX=200,CY=150,RX=170,RY=96,DEPTH=34,TAU=Math.PI*2;
const pt=(a:number,dx=0,dy=0):[number,number]=>[CX+dx+RX*Math.cos(a),CY+dy+RY*Math.sin(a)];
const f=(n:number)=>n.toFixed(2);

function topPath(a1:number,a2:number,dx:number,dy:number){
  if(a2-a1>=TAU-1e-6){return `M${f(CX+dx-RX)} ${f(CY+dy)}A${RX} ${RY} 0 1 1 ${f(CX+dx+RX)} ${f(CY+dy)}A${RX} ${RY} 0 1 1 ${f(CX+dx-RX)} ${f(CY+dy)}Z`}
  const [x1,y1]=pt(a1,dx,dy),[x2,y2]=pt(a2,dx,dy);const large=a2-a1>Math.PI?1:0;
  return `M${f(CX+dx)} ${f(CY+dy)}L${f(x1)} ${f(y1)}A${RX} ${RY} 0 ${large} 1 ${f(x2)} ${f(y2)}Z`;
}
// Outer curved wall: only the visible (front, sin>0) portion of [a1,a2].
function wallPaths(a1:number,a2:number,dx:number,dy:number){
  const out:string[]=[];
  for(let k=-1;k<=2;k++){const lo=Math.max(a1,k*TAU),hi=Math.min(a2,k*TAU+Math.PI);if(hi-lo>1e-4){
    const [x1,y1]=pt(lo,dx,dy),[x2,y2]=pt(hi,dx,dy);const large=hi-lo>Math.PI?1:0;
    out.push(`M${f(x1)} ${f(y1)}A${RX} ${RY} 0 ${large} 1 ${f(x2)} ${f(y2)}L${f(x2)} ${f(y2+DEPTH)}A${RX} ${RY} 0 ${large} 0 ${f(x1)} ${f(y1+DEPTH)}Z`)}}
  return out;
}
// Flat radial wall at an edge angle (visible when the slice is lifted / at seams).
const edgePath=(a:number,dx:number,dy:number)=>{const [x,y]=pt(a,dx,dy);return `M${f(CX+dx)} ${f(CY+dy)}L${f(x)} ${f(y)}L${f(x)} ${f(y+DEPTH)}L${f(CX+dx)} ${f(CY+dy+DEPTH)}Z`};

export function StudentPie3D({slices,onPick,total}:{slices:PieSlice[];onPick:(id:string)=>void;total:number}){
  const [hover,setHover]=useState<string|null>(null);
  const geo=useMemo(()=>{const sum=slices.reduce((a,b)=>a+b.value,0)||1;let a=-Math.PI/2;return slices.map((s,i)=>{const span=s.value/sum*TAU;const a1=a,a2=a+span;a=a2;const mid=(a1+a2)/2;return {...s,i,a1,a2,mid,pct:s.value/sum*100,color:sliceColor(i)}})},[slices]);
  // Painter's order: slices whose middle is further back (smaller sin) draw first.
  const order=useMemo(()=>[...geo].sort((p,q)=>(p.id===hover?1:0)-(q.id===hover?1:0)||Math.sin(p.mid)-Math.sin(q.mid)),[geo,hover]);
  const single=geo.length===1;
  if(!geo.length)return <div className="pie3d-empty"><Users size={28}/><p>暂无学生数据</p></div>;
  return <div className="pie3d-wrap">
    <div className="pie3d-stage">
      <svg viewBox="0 0 400 300" className="pie3d" role="img" aria-label={`学生按项目分布，共 ${total} 人`}>
        <defs><radialGradient id="pie3d-gloss" cx="35%" cy="25%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity=".38"/><stop offset=".55" stopColor="#fff" stopOpacity=".05"/><stop offset="1" stopColor="#000" stopOpacity=".08"/></radialGradient>
          <filter id="pie3d-shadow" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="9"/></filter></defs>
        <ellipse cx={CX} cy={CY+DEPTH+14} rx={RX*.92} ry={RY*.55} className="pie3d-floor" filter="url(#pie3d-shadow)"/>
        {order.map(g=>{const on=hover===g.id;const lift=on&&!single?14:0;const dx=Math.cos(g.mid)*lift,dy=Math.sin(g.mid)*lift*.6-(on?6:0);
          const walls=wallPaths(g.a1,g.a2,dx,dy);
          return <g key={g.id} className={'pie3d-slice'+(on?' on':'')+(hover&&!on?' dim':'')} style={{animationDelay:`${g.i*90}ms`}} tabIndex={0} role="button" aria-label={`${g.label}：${g.value} 人，${g.pct.toFixed(1)}%，点击查看学生`}
            onMouseEnter={()=>setHover(g.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(g.id)} onBlur={()=>setHover(null)} onClick={()=>onPick(g.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(g.id)}}}>
            {on&&!single&&<path d={edgePath(g.a1,dx,dy)} fill={shade(g.color,58)}/>}
            {on&&!single&&<path d={edgePath(g.a2,dx,dy)} fill={shade(g.color,62)}/>}
            {walls.map((d,k)=><path key={k} d={d} fill={shade(g.color,72)}/>)}
            <path d={topPath(g.a1,g.a2,dx,dy)} fill={g.color} className="pie3d-top"/>
            <path d={topPath(g.a1,g.a2,dx,dy)} fill="url(#pie3d-gloss)" pointerEvents="none"/>
            {g.pct>=6&&(()=>{const [lx,ly]=[CX+dx+RX*.62*Math.cos(g.mid),CY+dy+RY*.62*Math.sin(g.mid)];return <text x={lx} y={ly} className="pie3d-label" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{single?`${g.label} · 100%`:`${g.pct.toFixed(0)}%`}</text>})()}
          </g>})}
      </svg>
          </div>
    <ul className="pie3d-legend">{geo.map(g=><li key={g.id}><button type="button" className={hover===g.id?'on':''} onMouseEnter={()=>setHover(g.id)} onMouseLeave={()=>setHover(null)} onClick={()=>onPick(g.id)}>
      <i style={{background:g.color}}/><span><strong>{g.label}</strong>{g.sub&&<small>{g.sub}</small>}</span><em>{g.value}<small> 人</small></em><b>{g.pct.toFixed(1)}%</b>
      <span className="pie3d-bar"><span style={{width:`${g.pct}%`,background:g.color}}/></span></button></li>)}</ul>
  </div>;
}
