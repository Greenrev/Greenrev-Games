/* GreenRev ROADTRIP: genuine WebGL 3D world engine.
   Procedural mesh geometry, perspective projection, depth testing, lights,
   texture-mapped destination signs, 3D vehicles/people/buildings.
   No packages, CDN, network, or external art assets required. */
(function(){'use strict';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const M={
 identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])},
 mul(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o},
 pos(x,y,z){let o=M.identity();o[12]=x;o[13]=y;o[14]=z;return o},
 scale(x,y,z){let o=M.identity();o[0]=x;o[5]=y;o[10]=z;return o},
 ry(r){const c=Math.cos(r),s=Math.sin(r);let o=M.identity();o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o},
 rx(r){const c=Math.cos(r),s=Math.sin(r);let o=M.identity();o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o},
 rz(r){const c=Math.cos(r),s=Math.sin(r);let o=M.identity();o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o},
 perspective(fov,ratio,near,far){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/ratio;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o},
 lookAt(e,t,up=[0,1,0]){const norm=a=>{let n=Math.hypot(...a)||1;return a.map(q=>q/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let z=norm(e.map((v,i)=>v-t[i])),x=norm(cross(up,z)),y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*e[i],0),-y.reduce((s,v,i)=>s+v*e[i],0),-z.reduce((s,v,i)=>s+v*e[i],0),1])
 }
};
function color(hex){hex=hex.replace('#','');if(hex.length===8)hex=hex.slice(0,6);if(hex.length===3)hex=hex.split('').map(q=>q+q).join('');const x=parseInt(hex,16);return [((x>>16)&255)/255,((x>>8)&255)/255,(x&255)/255]}
function hash(n){let x=Math.sin(n*138.723+78.13)*54321.793;return x-Math.floor(x)}
function center(s){return Math.sin(s/122)*10+Math.sin(s/56)*3.8+Math.sin(s/250)*5}
function slope(s){return (center(s+1)-center(s-1))/2}
function elevation(s){const bumps=[{p:940,r:90,h:4},{p:2320,r:72,h:3.5}];let v=0;for(const b of bumps){const d=(s-b.p)/b.r;if(Math.abs(d)<1)v+=b.h*(.5+.5*Math.cos(Math.PI*d))}return v}
function meshBox(){let v=[],n=[];const faces=[[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],[[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],[[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]],[[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],[[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]]];
 for(const [nn,pts] of faces){for(const i of [0,1,2,0,2,3]){v.push(...pts[i].map(q=>q*.5));n.push(...nn)}}return {v,n}}
function meshCylinder(steps=24){let v=[],n=[];for(let i=0;i<steps;i++){let a=i*TAU/steps,b=(i+1)*TAU/steps,x=Math.cos(a),z=Math.sin(a),X=Math.cos(b),Z=Math.sin(b);for(let item of [[x,-.5,z,x,0,z],[X,-.5,Z,X,0,Z],[X,.5,Z,X,0,Z],[x,-.5,z,x,0,z],[X,.5,Z,X,0,Z],[x,.5,z,x,0,z]]){v.push(...item.slice(0,3));n.push(...item.slice(3))}for(let y of [-.5,.5]){for(const [xx,zz] of [[0,0],[x,z],[X,Z]]){v.push(xx,y,zz);n.push(0,y<0?-1:1,0)}}}return {v,n}}
function meshSphere(steps=12,rings=8){let v=[],n=[];for(let y=0;y<rings;y++)for(let x=0;x<steps;x++){for(const [u,w] of [[x/steps,y/rings],[(x+1)/steps,y/rings],[(x+1)/steps,(y+1)/rings],[x/steps,y/rings],[(x+1)/steps,(y+1)/rings],[x/steps,(y+1)/rings]]){let a=u*TAU,ang=w*Math.PI,p=[Math.sin(ang)*Math.cos(a),Math.cos(ang),Math.sin(ang)*Math.sin(a)];v.push(...p.map(q=>q*.5));n.push(...p)}}return {v,n}}
function meshSedan(){
 // Aerodynamic sedan shoulder and rounded boot/bonnet taper.
 const rings=[[-2.28,.78,.65],[-2.02,.93,.82],[-1.40,1.02,.91],[-.8,1.03,.95],[.85,1.03,.95],[1.72,1.0,.86],[2.15,.88,.74],[2.29,.75,.63]];
 const v=[],n=[];
 const tri=(p,q,r)=>{const u=q.map((a,i)=>a-p[i]),w=r.map((a,i)=>a-p[i]);let N=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...N)||1;v.push(...p,...q,...r);for(let i=0;i<3;i++)n.push(...N.map(a=>a/len))};
 const face=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d)};
 for(let j=0;j<rings.length-1;j++){
  const [z0,w0,h0]=rings[j],[z1,w1,h1]=rings[j+1],bot=.31;
  face([-w0,h0,z0],[w0,h0,z0],[w1,h1,z1],[-w1,h1,z1]);
  face([-w0,bot,z0],[-w1,bot,z1],[-w1,h1,z1],[-w0,h0,z0]);
  face([w0,bot,z0],[w0,h0,z0],[w1,h1,z1],[w1,bot,z1]);
  face([-w0,bot,z0],[w0,bot,z0],[w1,bot,z1],[-w1,bot,z1]);
 }
 let a=rings[0],b=rings[rings.length-1];face([-a[1],.31,a[0]],[-a[1],a[2],a[0]],[a[1],a[2],a[0]],[a[1],.31,a[0]]);face([-b[1],.31,b[0]],[b[1],.31,b[0]],[b[1],b[2],b[0]],[-b[1],b[2],b[0]]);
 return{v,n}
}
function meshCarCabin(){// Sloped front/rear glass and narrowing roof, truly volumetric.
 const low=[[-.89,0,-1.37],[.89,0,-1.37],[.89,0,1.3],[-.89,0,1.3]],top=[[-.68,.75,-.63],[.68,.75,-.63],[.68,.75,.72],[-.68,.75,.72]];
 let v=[],n=[];function tri(a,b,c){v.push(...a,...b,...c);let u=b.map((p,i)=>p-a[i]),w=c.map((p,i)=>p-a[i]);let no=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(...no)||1;for(let i=0;i<3;i++)n.push(...no.map(q=>q/l))}for(let i=0;i<4;i++){let j=(i+1)%4;tri(low[i],low[j],top[j]);tri(low[i],top[j],top[i])}tri(top[0],top[1],top[2]);tri(top[0],top[2],top[3]);return{v,n}}
function meshQuad(){return{v:[-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,-.5,0,.5,.5,0,-.5,.5,0],n:Array(6).fill([0,0,1]).flat(),uv:[0,1,1,1,1,0,0,1,1,0,0,0]}}
class World3D{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'high-performance'})||canvas.getContext('webgl',{alpha:false,antialias:true,depth:true});if(!this.gl)throw Error('WebGL is unavailable: enable hardware acceleration in your browser.');
 const gl=this.gl;this.program=this.makeProgram();gl.useProgram(this.program);this.aPosition=gl.getAttribLocation(this.program,'aPos');this.aNormal=gl.getAttribLocation(this.program,'aNorm');this.aUV=gl.getAttribLocation(this.program,'aUV');this.uModel=gl.getUniformLocation(this.program,'uModel');this.uVP=gl.getUniformLocation(this.program,'uVP');this.uColor=gl.getUniformLocation(this.program,'uColor');this.uTexture=gl.getUniformLocation(this.program,'uTexture');this.uHasTexture=gl.getUniformLocation(this.program,'uHasTexture');this.uFog=gl.getUniformLocation(this.program,'uFog');this.uCam=gl.getUniformLocation(this.program,'uCam');gl.uniform1i(this.uTexture,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.meshes={box:this.upload(meshBox()),cylinder:this.upload(meshCylinder()),sphere:this.upload(meshSphere()),sedan:this.upload(meshSedan()),cabin:this.upload(meshCarCabin()),quad:this.upload(meshQuad())};this.roadMesh=this.createDynamic();this.textures=new Map();this.frameNo=0;this.steerVisual=0;this.camPos=[0,5,10];this.onScreen=[];gl.clearColor(.52,.75,.86,1);
 }
 makeProgram(){const gl=this.gl,vs=`attribute vec3 aPos;attribute vec3 aNorm;attribute vec2 aUV;uniform mat4 uModel,uVP;varying vec3 vN;varying vec3 vWorld;varying vec2 vUV;void main(){vec4 w=uModel*vec4(aPos,1.);gl_Position=uVP*w;vN=mat3(uModel)*aNorm;vWorld=w.xyz;vUV=aUV;}`,fs=`precision mediump float;uniform vec3 uColor;uniform bool uHasTexture;uniform sampler2D uTexture;uniform vec3 uFog,uCam;varying vec3 vN;varying vec3 vWorld;varying vec2 vUV;void main(){vec3 normal=normalize(vN);float lit=.68+.32*max(0.,dot(normal,normalize(vec3(-.38,.95,.58))));vec3 base=uHasTexture?texture2D(uTexture,vUV).rgb:uColor;vec3 c=base*(.90+.10*lit);c*=lit;float dist=length(vWorld-uCam);float fog=clamp((dist-65.)/260.,0.,.83);gl_FragColor=vec4(mix(c,uFog,fog),1.);}`;
 const compile=(type,src)=>{let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};let p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
 upload(m){let gl=this.gl;const inter=[];for(let i=0;i<m.v.length/3;i++){inter.push(...m.v.slice(i*3,i*3+3),...m.n.slice(i*3,i*3+3),...(m.uv?m.uv.slice(i*2,i*2+2):[0,0]))}const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inter),gl.STATIC_DRAW);return {buffer,count:m.v.length/3}}
 createDynamic(){const gl=this.gl;return{buffer:gl.createBuffer(),count:0}}
 bind(mesh){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.enableVertexAttribArray(this.aPosition);gl.vertexAttribPointer(this.aPosition,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(this.aNormal);gl.vertexAttribPointer(this.aNormal,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(this.aUV);gl.vertexAttribPointer(this.aUV,2,gl.FLOAT,false,32,24)}
 drawMesh(name,pos,size,hex,angle=0,rx=0,rz=0,texture=null){const gl=this.gl,mesh=this.meshes[name];let mod=M.mul(M.mul(M.mul(M.mul(M.pos(...pos),M.ry(angle)),M.rx(rx)),M.rz(rz)),M.scale(...size));gl.uniformMatrix4fv(this.uModel,false,mod);gl.uniform3fv(this.uColor,color(hex));gl.uniform1i(this.uHasTexture,texture?1:0);if(texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture)}this.bind(mesh);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 box(x,y,z,w,h,d,hex,yaw=0){this.drawMesh('box',[x,y,z],[w,h,d],hex,yaw)}
 cyl(x,y,z,w,h,d,hex,yaw=0,rx=0,rz=0){this.drawMesh('cylinder',[x,y,z],[w,h,d],hex,yaw,rx,rz)}
 sphere(x,y,z,w,h,d,hex){this.drawMesh('sphere',[x,y,z],[w,h,d],hex)}
 ribbon(samples,lOff,rOff,yOff,hex){const gl=this.gl,V=[];for(let i=0;i<samples.length-1;i++){let a=samples[i],b=samples[i+1];const verts=[[a,lOff],[b,rOff],[b,lOff],[a,lOff],[a,rOff],[b,rOff]];for(const [p,off] of verts){V.push(p.x+off,p.h+yOff,-p.s,0,1,0,0,0)}}gl.bindBuffer(gl.ARRAY_BUFFER,this.roadMesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(V),gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(this.uModel,false,M.identity());gl.uniform3fv(this.uColor,color(hex));gl.uniform1i(this.uHasTexture,0);this.bind(this.roadMesh);gl.drawArrays(gl.TRIANGLES,0,V.length/8)}
 labelTexture(lines,bg='#0b683d'){const key=lines.join('|')+bg;if(this.textures.has(key))return this.textures.get(key);const can=document.createElement('canvas');can.width=512;can.height=256;const c=can.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,512,256);c.strokeStyle='#e9f5e9';c.lineWidth=14;c.strokeRect(15,15,482,226);c.textAlign='center';c.fillStyle='#fff';for(let i=0;i<lines.length;i++){c.font=(i===0?'bold 62px':'bold 37px')+' Arial';c.fillText(lines[i],256,100+i*70,470)}const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,can);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textures.set(key,t);return t}
 sign(x,z,lines,side=1){this.cyl(x-2,2.2,z,.1,4.4,.1,'#aebdb2');this.cyl(x+2,2.2,z,.1,4.4,.1,'#aebdb2');this.drawMesh('quad',[x,3.9,z],[5,2.4,1],'#ffffff',0,0,0,this.labelTexture(lines))}
 car(x,y,z,hex,yaw=0,player=false,wheelSpin=0){const gl=this.gl;// local model transform via nested coordinate transform
 const angle=yaw,cc=Math.cos(angle),ss=Math.sin(angle);const P=(dx,dy,dz)=>[x+cc*dx+ss*dz,y+dy,z-ss*dx+cc*dz];const B=(dx,dy,dz,w,h,d,c)=>{let q=P(dx,dy,dz);this.box(...q,w,h,d,c,angle)};const C=(dx,dy,dz,w,h,d,c,rx=0,rz=0)=>this.drawMesh('cylinder',P(dx,dy,dz),[w,h,d],c,angle,rx,rz);
 this.drawMesh('box',P(0,.12,0),[2.35,.04,5.1],'#18322a',angle);
 this.drawMesh('sedan',P(0,0,0),[1,1,1],hex,angle);B(0,.40,-2.07,1.96,.27,.44,hex);B(0,.40,2.14,1.96,.27,.35,hex);
 B(0,.85,-1.49,1.95,.25,1.3,hex);B(0,.86,1.47,1.96,.22,.96,hex);
 const cabin=this.meshes.cabin;this.drawMesh('cabin',P(0,1.02,.20),[1,1,1],'#224c57',angle);B(0,1.79,.21,1.46,.10,1.52,hex);
 // windshields, front and rear (sloped blue glass planes)
 this.drawMesh('quad',P(0,1.43,-.81),[1.42,.85,1],'#a6c9d1',angle,-.70,0);
 this.drawMesh('quad',P(0,1.42,1.19),[1.45,.75,1],'#6ea8b8',angle,.70,0);
 B(-.90,1.39,.22,.09,.62,1.51,hex);B(.90,1.39,.22,.09,.62,1.51,hex);
 B(-.68,1.36,.26,.10,.065,1.32,'#b4cbd0');B(.68,1.36,.26,.10,.065,1.32,'#b4cbd0');
 // mirrors, grille, lamp clusters, bumpers, license plate
 B(-1.13,1.05,-.95,.28,.12,.34,'#172a30');B(1.13,1.05,-.95,.28,.12,.34,'#172a30');
 B(0,.65,-2.31,1.15,.21,.05,'#132b2d');for(let i=-3;i<=3;i++)B(i*.14,.66,-2.35,.08,.1,.04,'#829ea0');
 B(-.73,.70,-2.29,.38,.19,.09,'#f7f1c6');B(.73,.70,-2.29,.38,.19,.09,'#f7f1c6');
 B(-.78,.73,2.30,.38,.22,.09,'#fd554c');B(.78,.73,2.30,.38,.22,.09,'#fd554c');
 B(0,.43,-2.36,.68,.19,.05,'#f1e6c9');B(0,.43,2.36,.68,.19,.05,'#f1e6c9');
 for(let sign of [-1,1])for(const zz of [-1.37,1.44]){
  C(sign*1.05,.46,zz,.58,.27,.58,'#192027',0,Math.PI/2);C(sign*1.225,.46,zz,.29,.28,.29,'#88979c',0,Math.PI/2);C(sign*1.245,.46,zz,.16,.29,.16,'#394e55',0,Math.PI/2)
 }
 // realistic side silhouettes: door seams, wheel arches, handles and silver trim
 for(const side of [-1,1]){
   B(side*.982,.92,.13,.045,.08,3.00,'#243840');
   B(side*1.025,.96,-.55,.065,.08,.40,'#d5d7cc');
   B(side*1.025,.96,.83,.065,.08,.40,'#d5d7cc');
   B(side*1.016,.69,-1.2,.052,.055,.75,'#e0e0c9');
   B(side*1.020,.69,1.42,.052,.055,.62,'#e0e0c9');
   B(side*1.01,1.61,.2,.06,.07,1.1,'#c6d0cb');
 }
 B(0,.48,-2.38,1.58,.14,.05,'#87979a');B(0,.48,2.4,1.48,.14,.05,'#8eaaaa');
 B(-.70,.73,-2.38,.20,.12,.03,'#ffffff');B(.70,.73,-2.38,.20,.12,.03,'#ffffff');
 // Luxury trim details: sunroof, black roof rails and rear diffuser
 if(player){B(0,1.852,.17,.73,.035,1.00,'#182a30');B(-.66,1.84,.20,.08,.08,1.49,'#ced9cc');B(.66,1.84,.20,.08,.08,1.49,'#ced9cc');B(0,.48,2.42,1.25,.10,.06,'#30343a');}
 // seated avatar glimpsed behind the windscreen
 if(player){this.sphere(...P(-.32,1.31,.13),.35,.34,.35,'#a76d47');this.sphere(...P(-.32,1.52,.10),.36,.24,.36,'#1e2428');}
 }
 danfo(x,y,z,yaw=0,damaged=false){
  // Distinctive Lagos yellow minibuses, sliding door, windscreen, 4 windows, tyres,
  // Lagos-style white stripe and fictional greenroute board. True 3D box geometry.
  const cc=Math.cos(yaw),ss=Math.sin(yaw),P=(dx,dy,dz)=>[x+cc*dx+ss*dz,y+dy,z-ss*dx+cc*dz];
  const B=(dx,dy,dz,w,h,d,c)=>this.box(...P(dx,dy,dz),w,h,d,c,yaw);
  const C=(dx,dy,dz,w,h,d,c,rx=0)=>this.drawMesh('cylinder',P(dx,dy,dz),[w,h,d],c,yaw,rx);
  B(0,.77,.05,2.5,1.10,5.7,'#e9ad21');B(0,1.95,.2,2.4,1.30,4.90,'#f5bf23');
  B(0,2.62,.1,2.6,.15,5.5,'#f2d44c');B(0,2.61,-1.9,2.35,.10,.9,'#e1e6c4');
  B(0,1.55,-2.65,2.1,1.1,.08,'#84aab4');B(0,1.5,2.72,1.7,1.0,.07,'#5b8b92');
  for(let side of [-1,1]){
   for(let i=0;i<4;i++)B(side*1.245,1.93,-1.55+i*1.05,.058,.78,.75,'#456c70');
   B(side*1.265,1.17,.15,.065,.30,4.7,'#f6eee3');
   B(side*1.31,1.54,1.2,.085,.84,1.33,'#d6a026');
   B(side*1.32,1.42,1.15,.03,.08,.6,'#253d42');
   for(let z0 of [-1.95,1.78]){
    C(side*1.22,.52,z0,.85,.32,.85,'#161d25',Math.PI/2);
    C(side*1.43,.52,z0,.39,.34,.39,'#c4c4b6',Math.PI/2);
   }
  }
  B(0,.64,-2.90,1.7,.28,.08,'#cbd1c9');B(0,.62,2.91,1.5,.20,.08,'#d8d8c6');
  for(let x0 of [-.93,.93]){
   B(x0,.92,-2.88,.38,.29,.11,damaged?'#ff7730':'#faf0ce');
   B(x0,.98,2.90,.38,.30,.11,'#e64635');
  }
  B(0,2.49,-2.57,1.65,.30,.13,'#174f38');
  B(-.93,2.77,.15,.16,.19,4.2,'#777a69');B(.93,2.77,.15,.16,.19,4.2,'#777a69');
  if(damaged){for(let k=0;k<3;k++)this.sphere(...P(-1.3+k*.4,2.7,-.7-k*.3),.42,.33,.35,'#ad8876')}
 }
 hiace(x,y,z,yaw=0,damaged=false){
  // Northern Nigerian intercity minibus: high roof, front grille, large windows,
  // luggage compartment and an optional route sign. Distinct from Lagos danfo.
  const cc=Math.cos(yaw),ss=Math.sin(yaw),P=(dx,dy,dz)=>[x+cc*dx+ss*dz,y+dy,z-ss*dx+cc*dz];
  const B=(dx,dy,dz,w,h,d,c)=>this.box(...P(dx,dy,dz),w,h,d,c,yaw);
  const C=(dx,dy,dz,w,h,d,c,rx=0)=>this.drawMesh('cylinder',P(dx,dy,dz),[w,h,d],c,yaw,rx);
  B(0,.68,.15,2.25,1.12,5.75,'#ecf0e9');B(0,1.79,.25,2.21,1.37,5.10,'#e7eae4');
  B(0,2.52,.23,2.30,.15,5.40,'#ecf0ec');
  B(0,1.53,-2.68,1.82,1.13,.11,'#567e8b');B(0,1.52,2.78,1.84,.99,.10,'#517780');
  B(0,.62,-2.91,2.12,.38,.2,'#2c3337');B(0,.68,2.94,2.05,.34,.2,'#303b42');
  B(0,.87,-2.99,1.25,.40,.08,'#263f44');
  for(const side of [-1,1]){
   for(let i=0;i<4;i++)B(side*1.15,1.86,-1.60+i*1.08,.08,.72,.79,'#608790');
   B(side*1.16,.92,.02,.08,.21,5,'#1b855d');
   B(side*1.18,.65,.02,.09,.13,4.6,'#257e61');
   B(side*1.18,1.28,1.08,.08,.12,1.25,'#6c8290');
   B(side*1.21,1.31,1.17,.10,.08,.37,'#b9bbb6');
   for(const zz of [-1.8,1.84]){C(side*1.13,.49,zz,.86,.33,.86,'#181e21',Math.PI/2);C(side*1.34,.49,zz,.37,.35,.37,'#cbd0d0',Math.PI/2)}
  }
  for(const side of [-.80,.80]){
   B(side,.92,-2.95,.38,.25,.09,damaged?'#ff7a4a':'#fff6de');
   B(side,.95,2.96,.36,.24,.09,'#d84433');
  }
  B(0,2.35,-2.74,1.48,.25,.12,'#1b7d55');
  B(0,2.66,.24,1.32,.10,3.20,'#b4c3bd');
  if(damaged){this.sphere(...P(.94,2.65,-1.3),.37,.37,.37,'#a66b56')}
 }
 suv(x,y,z,hex='#ccd9c2',yaw=0,player=false){
  // Taller body with curved sedan foundation, proper roof, door pillars and spare tyre.
  this.car(x,y,z,hex,yaw,player);const c=Math.cos(yaw),q=Math.sin(yaw),P=(dx,dy,dz)=>[x+c*dx+q*dz,y+dy,z-q*dx+c*dz];
  this.box(...P(0,1.79,.48),1.95,.20,2.5,hex,yaw);
  for(const side of [-1,1]){this.box(...P(side*.95,1.53,.35),.11,.72,2.24,hex,yaw);this.box(...P(side*1.00,1.55,-.18),.06,.45,.8,'#547887',yaw)}
  this.drawMesh('cylinder',P(0,1.12,2.49),[.8,.21,.8],'#1e2830',yaw,Math.PI/2);
 }
 building(x,z,w,d,h,variant=0){const c=['#d6b080','#edcda0','#c7a98b','#c4baa6','#caa382'][((variant%5)+5)%5];this.box(x,h/2,z,w,h,d,c);this.box(x,h+.12,z,w+.35,.24,d+.4,variant%2?'#8f5641':'#ad6f4d');this.box(x,h*.56,z+d/2+.04,w*.27,h*.27,.1,'#32534e');this.box(x,h*.56,z-d/2-.04,w*.27,h*.27,.1,'#315b63');this.box(x-w*.23,.13,z+d/2+.05,w*.18,.22,.12,'#987047');if(h>4){this.box(x,h*.62,z+d/2+.1,w*.16,.52,.1,'#506f72')};}
 tree(x,z,size=1,savanna=false){this.cyl(x,.85*size,z,.24*size,1.7*size,.24*size,'#856649');this.sphere(x,2*size,z,(savanna?2.4:1.8)*size,(savanna?.68:1.55)*size,(savanna?1.9:1.8)*size,savanna?'#739947':'#397b49');this.sphere(x+.43*size,2.2*size,z-.28*size,.9*size,.65*size,.9*size,'#62a558')}
 cone(x,z){this.cyl(x,.40,z,1.1,.8,1.1,'#eb792b');this.box(x,.30,z,1.2,.1,1.2,'#fff2df');}
 person(x,z,type=0){let skin=type===1?'#a96a41':'#76452e',shirt=['#234a40','#efede0','#8d7458','#4fa17b'][type%4];this.cyl(x,.55,z,.33,1.1,.33,'#272c36');this.box(x,1.45,z,.65,.9,.36,shirt);this.sphere(x,2.05,z,.52,.52,.52,skin);this.sphere(x,2.32,z,.5,.23,.5,'#262425');}
 fuelStation(x,z){this.box(x,3.5,z,13,.6,7,'#16794f');for(let dx of [-5.3,5.3])for(let zz of [-2,2])this.cyl(x+dx,1.75,z+zz,.25,3.5,.25,'#e8e5d7');for(let dx of [-2.3,2.3]){this.box(x+dx,.98,z,1.25,1.96,1.1,'#eaf0dd');this.box(x+dx,1.27,z-.57,.9,.6,.07,'#28463d');this.box(x+dx,.50,z-.62,.8,.20,.1,'#35a366')}}
 checkpoint(x,z,vio=false){const roadX=x;this.sign(roadX+11,z-23,[vio?'VIO INSPECTION':'FRSC STOP','SLOW DOWN']);this.box(roadX, .22,z,11,.28,.48,'#faf3dd');for(let dx=-5;dx<=5;dx+=1){this.box(roadX+dx,.39,z-.1,.48,.4,.2,dx%2?'#e74635':'#fff')};for(let dx of [-6.3,6.3])this.cone(roadX+dx,z-2);this.person(roadX+5.6,z-3,vio?2:1);this.box(roadX+7.3,1.3,z+8,4,2.6,3,'#e2d6be');this.box(roadX+7.3,2.8,z+8,4.4,.25,3.4,'#186948')}
 restStop(x,z){this.box(x,1.8,z,12,3.6,8,'#d6b180');this.box(x,3.9,z,13,.6,9,'#aa6544');this.sign(x,z-4.1,['MAMA TITI','FOOD + TOILET']);this.box(x-3,.98,z-4.12,1.5,2.0,.12,'#295a4b');this.box(x+3,1.1,z-4.12,1.7,2.2,.12,'#254a51');this.person(x-7,z+2,3);this.box(x+9,1.65,z,4,3.3,5,'#eadcc3');this.sign(x+9,z-2.6,['RESTROOM','WC']);this.fuelStation(x+21,z+6)}
 gate(x,z,city='KANO'){this.box(x-10,6,z,4,12,7,'#b68855');this.box(x+10,6,z,4,12,7,'#b68855');this.box(x,11,z,20,2,7,'#b68855');for(let v of [-10,0,10])this.cyl(x+v,13.2,z,3,3,3,'#bb9167');this.box(x,9,z-3.8,14,.9,.35,'#165d45');this.sign(x,z-3.95,['WELCOME TO',city==='KANO'?'KANO STATE':'ABUJA FCT'])}
 roundabout(x,z,to='KANO'){ // road junction as 3D circular raised island plus directional branch
 this.cyl(x, .15,z,11,.30,11,'#dcbd7c');this.cyl(x,.4,z,8,.45,8,'#277849');this.tree(x,z,2.0,true);for(let a=0;a<TAU;a+=.7)this.cone(x+7*Math.sin(a),z+7*Math.cos(a));this.sign(x+15,z-18,['ROUNDABOUT','FOLLOW '+to])}
 environment(state,s){const south=state.story==='lagos_abuja';const savanna=!south&&state.km>200,city=state.km<23||state.km>(south?490:377)||Math.abs(state.km-(south?230:170))<17||Math.abs(state.km-(south?400:290))<17;
 // Terrain, distant woodland and savanna flatland.
 const land=[];for(let ds=-55;ds<=270;ds+=25){const q=s+ds;land.push({x:center(q),s:q,h:0})}this.ribbon(land,-520,520,-.12,savanna?'#879b66':'#5a8e68');
 // Road ribbon curves in 3D and follows mild raised bridges.
 const samples=[];for(let ds=-46;ds<=230;ds+=3){let p=s+ds;samples.push({x:center(p),s:p,h:elevation(p)})}
 this.ribbon(samples,-7.4,7.4,.012,'#c7b589');this.ribbon(samples,-6.45,6.45,.045,'#50565c');
 this.ribbon(samples,-6.47,-6.34,.070,'#e7d99b');this.ribbon(samples,6.34,6.47,.070,'#e7d99b');
 this.ribbon(samples,-.075,.075,.080,'#f0eee1'); // centre separation painted solid
 // intermittent white lane separators
 for(let offs of [-3.2,3.2])for(let ds=-43;ds<210;ds+=12){let seg=[];for(let dd=ds;dd<ds+6;dd+=3){const p=s+dd;seg.push({x:center(p),s:p,h:elevation(p)})}if(seg.length===2)this.ribbon(seg,offs-.055,offs+.055,.08,'#fff9e4')}
 // Road furniture spaced in deterministic units, no randomness per frame
 for(let k=Math.floor((s-35)/15);k<=Math.floor((s+180)/15);k++){let q=k*15,x=center(q),t=hash(k+9),side=k%2?-1:1;
  if(Math.abs(q-s)>215)continue;
  if(k%2===0){const roadSide=x+side*8.0;this.cyl(roadSide,.65+elevation(q),-q,.14,1.3,.14,'#c1c2a9');this.box(roadSide,.85+elevation(q),-q,.2,.18,.3,'#d6e2cb')}
  const xx=x+side*(city?21:13)+side*t*14;
  if(city&&k%3===0){this.building(xx,-q,5+hash(k+3)*4,5,2.7+hash(k+4)*7,k%5)}else if(k%2===0){this.tree(xx,-q,.8+hash(k+1)*1.4,savanna)}
  if(city&&k%8===0){this.box(xx+5,1.1,-q,3.5,2.2,2.4,k%2?'#b58758':'#8a6b4d');this.box(xx+5,2.35,-q,4.2,.35,2.8,k%2?'#25865d':'#d28c4a')}
 }
 // Focal highway scenes keyed to game positions
 const missionKm=state.story==='lagos_abuja'?[85,170,235,320,390,470,550]:[70,125,190,245,310,375,430];const features=['police','breakdown','rest','parts','vio','dealer','arrival'].map((kind,i)=>({km:missionKm[i],kind}));
 const incidents=state.story==='lagos_abuja'?[['tyre',45],['dashboard',221],['weather',336],['battery',420],['brakes',449]]:[['tyre',36],['dashboard',174],['weather',261],['battery',331],['brakes',356]];
 features.push(...incidents.map(([kind,km])=>({kind,km})));
 const services=state.story==='lagos_abuja'?[['service',61],['danfo',296],['charging',526]]:[['service',52],['danfo',143],['charging',414]];
 features.push(...services.map(([kind,km])=>({kind,km}))); 
 for(const feature of features){const at=feature.km*8;if(at<s-40||at>s+190)continue;const x=center(at),z=-at;
  if(feature.kind==='police'||feature.kind==='vio')this.checkpoint(x,z,feature.kind==='vio');
  if(feature.kind==='rest')this.restStop(x+26,z);
  if(feature.kind==='service'||feature.kind==='charging'){this.fuelStation(x+24,z);this.sign(x+22,z-11,[feature.kind==='charging'?'EV CHARGING':'GREENREV STOP','FOOD + FUEL'])}
  if(feature.kind==='danfo'){if(south){this.danfo(x+13,elevation(at),z,1.52,false);this.sign(x+18,z-13,['LAGOS DANFO','GIVE WAY'])}else{this.hiace(x+13,elevation(at),z,1.52,false);this.sign(x+18,z-13,['INTERCITY BUS','KADUNA - KANO'])}this.person(x+16,z-3,1)}
  if(feature.kind==='breakdown'){this.car(x+11,elevation(at),z,'#e9d19a',1.48,false);this.person(x+15,z,0);this.sign(x+10,z-19,['MECHANIC','GREENREV APP'])}
  if(feature.kind==='parts')this.sign(x+12,z-12,['AUTO PARTS','NEXT EXIT']);
  if(feature.kind==='tyre'){this.sign(x+12,z-8,['TYRE SERVICE','GREENREV']);this.car(x+17,elevation(at),z+12,'#c9d9f0',1.57)}
  if(feature.kind==='dashboard')this.sign(x+12,z-8,['VEHICLE CHECK','NEXT SERVICE']);
  if(feature.kind==='weather')this.sign(x+12,z-8,['RAIN WARNING','SLOW DOWN']);
  if(feature.kind==='battery')this.sign(x+12,z-8,['AUTO ELECTRICS','DIAGNOSTICS']);
  if(feature.kind==='brakes')this.sign(x+12,z-8,['BRAKE SERVICE','NEXT EXIT']);
  if(feature.kind==='dealer'){this.building(x+22,z,13,10,7,3);this.sign(x+22,z-7,['GREENREV','CAR DEALERS']);for(let n=0;n<3;n++)this.car(x+15+n*4,elevation(at),z+n*3,['#abbcd3','#e9c6a2','#e0e2e5'][n],1.57)}
  if(feature.kind==='arrival')this.gate(x,z,state.story==='lagos_abuja'?'ABUJA':'KANO');
 }
 for(let m of (state.story==='lagos_abuja'?[{at:135,wrong:'OYO',right:'AKURE'},{at:420,wrong:'OKENE',right:'ABUJA'}]:[{at:95,wrong:'MINNA',right:'KADUNA'},{at:280,wrong:'JOS',right:'KANO'}])){let at=m.at*8;if(at<s-50||at>s+190)continue;this.roundabout(center(at),-at,m.right)}
 const bridges=[{km:146,name:'RIVER CROSSING'},{km:290,name:'ZARIA FLYOVER'}];for(const b of bridges){let at=b.km*8;if(Math.abs(at-s)>150)continue;const x=center(at),z=-at;for(let k=-48;k<48;k+=12){let q=at+k;let xx=center(q);for(let side of [-1,1]){this.box(xx+side*7.35,elevation(q)+.8,-q,.3,1.2,10,'#d8d5bc');this.cyl(xx+side*7.35,elevation(q)+.45,-q,.2,.9,.2,'#b7bcb4')}}this.sign(x+11,z-24,[b.name,'SLOW DOWN'])}
 let place=state.story==='lagos_abuja'?(state.km<90?'IBADAN':state.km<250?'AKURE':state.km<430?'LOKOJA':'ABUJA'):(state.km<39?'SULEJA':state.km<115?'KADUNA':state.km<240?'ZARIA':'KANO');
 for(let k=Math.floor((s-30)/150);k<=Math.floor((s+220)/150);k++){let at=k*150;if(Math.abs(at-s)>240)continue;this.sign(center(at)+13,-at,[place+' AHEAD',state.story==='lagos_abuja'?'LAGOS TO ABUJA':'KANO QUEST'])}
 if(state.currentEvent==='rest'){const x=center(s),z=-s-23;this.restStop(x+20,z);this.sign(x-17,z-6,['BREAK TIME','FOOD + WC'])}
 }
 drawTraffic(state,s,traffic){
 for(let i=0;i<traffic.length;i++){
  const t=traffic[i],dz=t.distance,worldS=s+dz;if(dz< -36||dz>185)continue;
  const lane=(t.lane-1)*4.1,x=center(worldS)+lane,y=elevation(worldS),z=-worldS,yaw=Math.atan(slope(worldS));
  const c=t.color||['#efc245','#e9e9e0','#b1c9df','#db796b','#87ab9d'][i%5];
  if(t.kind==='danfo')this.danfo(x,y,z,yaw,t.incidentTimer>0);
  else if(t.kind==='hiace')this.hiace(x,y,z,yaw,t.incidentTimer>0);
  else if(t.kind==='suv')this.suv(x,y,z,c,yaw);
  else this.car(x,y,z,c,yaw);
  if(t.incidentTimer>0&&Math.floor(this.frameNo/14)%2===0){
   this.sphere(x-1.17,y+1.30,z+1,.32,.32,.32,'#ff754d');this.sphere(x+1.17,y+1.30,z+1,.32,.32,.32,'#ff754d');
   this.box(x,y+.15,z+5.2,.20,.28,6,'#e5ca65');
  }
 }
 }

 camera(state,s,dt){const carx=center(s)+state.steerPos*4.1,roadYaw=Math.atan(slope(s));this.steerVisual+=(state.steerPos-this.steerVisual)*clamp(dt*5,0,1);const mode=state.camera||'chase';let eye,target,fov;
 if(mode==='driver'){eye=[carx,2.10+elevation(s),-s-.2];target=[center(s+70)+state.steerPos*3.2,2.6+elevation(s+70),-s-85];fov=1.12}
 else if(mode==='map'){eye=[center(s)+state.steerPos*.85,44+elevation(s),-s+19];target=[center(s+24),0,-s-47];fov=.95}
 else if(mode==='far'){eye=[carx+29,37+elevation(s),-s+39];target=[center(s+26),0,-s-43];fov=.91}
 else {eye=[center(s)+state.steerPos*.85,4.75+elevation(s),-s+11.4];target=[center(s+24),1.2+elevation(s+24),-s-34];fov=.94}
 this.gl.uniform3fv(this.uCam,new Float32Array(eye));const vw=M.lookAt(eye,target),p=M.perspective(fov,this.canvas.width/this.canvas.height,.15,400);this.gl.uniformMatrix4fv(this.uVP,false,M.mul(p,vw));return {carx,roadYaw,mode}
 }
 render(state,dt,traffic){const gl=this.gl;let cw=this.canvas.clientWidth||960,ch=this.canvas.clientHeight||560,dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(cw*dpr),h=Math.round(ch*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}gl.viewport(0,0,w,h);const phase=(((state.tripElapsedMs||0)/1000+(state.sceneTimeOffset||0))%360)/360;const dusk=phase>.55&&phase<.81;const night=phase>=.81||phase<.10;
 const sky=night?[.080,.125,.22]:dusk?[.74,.47,.38]:[.53,.75,.83];
 gl.clearColor(...sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
 gl.uniform3fv(this.uFog,night?new Float32Array([.16,.24,.30]):dusk?new Float32Array([.78,.55,.42]):color('#88bbc8'));const s=(state.km||0)*8;const camera=this.camera(state,s,dt);
 this.environment(state,s);this.drawTraffic(state,s,traffic);
 if(state.currentEvent==='weather'||(state.km>(state.story==='kano'?253:329)&&state.km<(state.story==='kano'?270:349))){
  for(let n=0;n<24;n++){const q=s+20+(n*17+this.frameNo*.72)%115,side=(hash(n+89)-.5)*16;
   this.box(center(q)+side,3+hash(n*17)*4,-q,.04,.90,.04,'#b5d6e4');}
 }
 if(camera.mode!=='driver'){const yaw=Math.atan(slope(s))+this.steerVisual*.13;(state.carBought&&['prado','lexus','gle','electric'].includes(state.carBought)?
 this.suv(camera.carx,elevation(s),-s,({prado:'#aabdaf',lexus:'#d6bd99',gle:'#bac4d3',electric:'#a7ead8'}[state.carBought]),yaw,true):
 this.car(camera.carx,elevation(s),-s,state.carBought?'#a8d5ee':'#34d7a0',yaw,true,state.speed*dt))}
 else{const x=camera.carx,y=elevation(s),z=-s;this.box(x,1.06+y,z-1.70,2.05,.16,1.8,'#24c98c');this.box(x,1.09+y,z-.82,2.35,.25,.42,'#233b3b');this.cyl(x-.39,1.06+y,z-.91,.75,.07,.75,'#1c292c',0,Math.PI/2);this.box(x-.4,1.0+y,z-.96,.25,.2,.35,'#bfd5bf')}
 this.frameNo++;
 }
}
window.GreenRev3D={create(canvas){return new World3D(canvas)}};
})();
