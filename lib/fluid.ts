import { clampTilt, smoothTilt, tiltForces, stepSlosh, type Slosh, type Tilt } from './tilt';
import { circleBoundary, circleMergeGroups } from './circle-boundary';
import { EMULSION_SOURCES } from './emulsion';

// Damped depth-averaged flow with a moving free surface in a circular bowl.
const SIM_SIZE = 192;
const DYE_SIZE = 512;
const PARTICLE_SIZE = 32;
const OUTER_RADIUS = 0.495;
// Must match the 110% canvas in .fluid-window. The physical wall is at its crop.
const VISIBLE_RADIUS = 0.5 / 1.1;
const MAX_STEP = 1 / 240; // Resolves gravity waves at the 192-cell grid spacing.
const BASE_VISCOSITY = 0.0005;
const SCAN_PASS_DURATION = 2.8 / 1.2;
const SCAN_DURATION = SCAN_PASS_DURATION * 2;
const VERTEX = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  uv=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;
const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 fragColor;
uniform vec2 texel;
uniform float boundaryRadius;
uniform bool hybridBoundary;
uniform bool curvedBoundary;
uniform bool mergedBoundary;
uniform sampler2D mergeGeometry;
uniform sampler2D boundaryGeometry;
uniform vec2 push;
const float R=0.495;
bool inside(vec2 p){return length(p-0.5)<boundaryRadius;}
bool wet(vec2 p){return curvedBoundary?texture(boundaryGeometry,p).z>0.00001:inside(p);}
vec2 wall(vec2 p){vec2 d=p-0.5;return 0.5+d*min(1.0,(boundaryRadius-texel.x)/max(length(d),0.00001));}
vec4 sampleLinear(sampler2D source, vec2 p){
#ifdef DISPLAY_LINEAR
  return texture(source,p);
#else
  vec2 size=vec2(textureSize(source,0));
  vec2 q=p*size-0.5;vec2 i=floor(q);vec2 f=fract(q);
  vec2 a=(i+0.5)/size;vec2 h=1.0/size;
  return mix(mix(texture(source,a),texture(source,a+vec2(h.x,0)),f.x),mix(texture(source,a+vec2(0,h.y)),texture(source,a+h),f.x),f.y);
#endif
}
// Consistent one-sided pressure gradient at a closed wall. A tilted plane
// keeps the same slope there instead of acquiring a half-strength derivative.
float boundaryHeight(sampler2D source,vec2 p){
 if(wet(p))return texture(source,p).x;
 vec2 d=p-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float imageRadius=min(2.0*boundaryRadius-r,boundaryRadius-1.5*texel.x);
 // Normal pressure balances tray acceleration at the actual circular wall.
 return sampleLinear(source,0.5+n*imageRadius).x+(r-imageRadius)*dot(push,n)/1.2;
}
vec2 boundaryVelocity(sampler2D source,vec2 p){
 if(wet(p))return texture(source,p).xy;
 vec2 d=p-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float imageRadius=min(2.0*boundaryRadius-r,boundaryRadius-1.5*texel.x);
 vec2 v=sampleLinear(source,0.5+n*imageRadius).xy;
 // Linear reflection through the true wall: zero normal velocity there,
 // continuous tangential velocity, even when the wall cuts a grid cell.
 return v-n*dot(v,n)*(1.0+(r-boundaryRadius)/(boundaryRadius-imageRadius));
}
float scalarSlope(sampler2D source,vec2 p,vec2 direction){
 vec2 a=p-direction*texel.x,b=p+direction*texel.x;
 if(curvedBoundary)return (boundaryHeight(source,b)-boundaryHeight(source,a))/(2.0*texel.x);
 bool left=inside(a),right=inside(b);
 if(left&&right)return (texture(source,b).x-texture(source,a).x)/(2.0*texel.x);
 if(right)return (texture(source,b).x-texture(source,p).x)/texel.x;
 if(left)return (texture(source,p).x-texture(source,a).x)/texel.x;
 return 0.0;
}
// Rendering only: keep all four interpolation taps inside the circular domain.
// Solver textures outside the bowl are zero and must not create a jagged rim.
vec4 sampleBowl(sampler2D source, vec2 p){
  vec2 size=vec2(textureSize(source,0));
  float inset=1.5/min(size.x,size.y);
  vec2 d=p-0.5;
  return sampleLinear(source,0.5+d*min(1.0,(R-inset)/max(length(d),0.00001)));
}
`;
const PARTICLE_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D particleState;
uniform float viewportSize;
out vec2 uv;
out float grainSeed;
out vec2 grainVelocity;
void main(){
  ivec2 cell=ivec2(gl_VertexID%32,gl_VertexID/32);
  vec4 state=texelFetch(particleState,cell,0);vec2 p=state.xy;
  grainVelocity=state.zw;
  grainSeed=fract(sin(float(gl_VertexID)*127.1+31.7)*43758.5453);
  uv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);
  gl_PointSize=max(3.0,viewportSize*0.026);
}`;
const SOURCES = {
  ...EMULSION_SOURCES,
  particleInit: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
void main(){
 vec2 cell=floor(uv*32.0);float a=hash(cell)*6.2831853;float r=sqrt(hash(cell+17.3))*min(0.465,boundaryRadius-texel.x*2.0);
 fragColor=vec4(vec2(cos(a),sin(a))*r+0.5,0,0);
}`,
  particleStep: `uniform sampler2D particleState;uniform sampler2D velocity;uniform float dt;
void main(){
 vec4 state=texture(particleState,uv);vec2 p=state.xy;
 // Midpoint flow sampling follows translation as well as curved trajectories.
 vec2 midpoint=wall(p+state.zw*dt*0.5);
 vec2 flow=sampleLinear(velocity,midpoint).xy;
 vec2 v=mix(state.zw,flow,1.0-exp(-dt*18.0));
 p+=(state.zw+v)*0.5*dt;
 vec2 d=p-0.5;float r=length(d);
 float contact=hybridBoundary?boundaryRadius-0.0015:0.475;
 if(r>contact){vec2 n=d/max(r,0.00001);p=0.5+n*contact;v-=1.15*n*max(dot(v,n),0.0);}
 fragColor=vec4(p,v);
}`,
  flowDisplay: `in float grainSeed;in vec2 grainVelocity;
void main(){
 float speed=length(grainVelocity);
 if(grainSeed>0.42||speed<0.001)discard;
 vec2 direction=vec2(grainVelocity.x,-grainVelocity.y)/speed;
 vec2 p=gl_PointCoord*2.0-1.0;
 vec2 q=vec2(dot(p,direction),dot(p,vec2(-direction.y,direction.x)));
 float extent=mix(0.18,0.78,smoothstep(0.0,0.045,speed));
 float distance=length(vec2(max(abs(q.x)-extent,0.0),q.y));
 float core=exp(-pow(distance/0.055,2.0));
 float halo=exp(-pow(distance/0.20,2.0));
 float fade=smoothstep(0.001,0.018,speed)*(1.0-smoothstep(0.46,0.48,length(uv-0.5)));
 fragColor=vec4(mix(vec3(0.42,0.78,0.90),vec3(0.91,0.98,1.0),core),fade*(core*0.85+halo*0.25));
}`,
  // Regularize only the height used for second derivatives. The dye and the
  // ordinary surface normals stay sharp; this is not a blur of the bowl image.
  crestHeight: `uniform sampler2D surface;
void main(){
 float height=0.0;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  float wx=x==0?6.0:(abs(x)==1?4.0:1.0);
  float wy=y==0?6.0:(abs(y)==1?4.0:1.0);
  height+=sampleLinear(surface,uv+vec2(float(x),float(y))/192.0).x*wx*wy;
 }
 fragColor=vec4(height/256.0,0,0,1);
}`,
  features: `uniform sampler2D surface;uniform sampler2D velocity;uniform bool flowMode;uniform bool crestMode;
float elevation(vec2 p){return sampleLinear(surface,p).x;}
void main(){
 // Extrapolated heights are useful for normals, but their second derivatives
 // are not real crests. Taper only this highlight where its stencil meets the
 // physical wall; pigment, surface lighting and particle motion stay intact.
 // Preserve the physical highlight width when the mobile grid is coarser.
 vec2 h=vec2(4.0/192.0,0);
 float radius=length(uv-0.5);
 fragColor=vec4(0);
 if(flowMode){
  vec2 dx=texture(velocity,uv+vec2(texel.x,0)).xy-texture(velocity,uv-vec2(texel.x,0)).xy;
  vec2 dy=texture(velocity,uv+vec2(0,texel.y)).xy-texture(velocity,uv-vec2(0,texel.y)).xy;
  float curl=(dx.y-dy.x)/(2.0*texel.x);
  float interior=1.0-smoothstep(R-6.0/192.0,R-4.0/192.0,radius);
  fragColor.ba=vec2(curl,length(texture(velocity,uv).xy))*interior;
 }
 if(!crestMode)return;
 float featureRadius=hybridBoundary&&!curvedBoundary?boundaryRadius:R;
 float interior=1.0-smoothstep(featureRadius-6.0/192.0,featureRadius-4.0/192.0,radius);
 if(interior<=0.0)return;
 float center=elevation(uv);
 // Principal curvatures reject a tilted plane and isolate convex wave ridges.
 float xx=2.0*center-elevation(uv+h)-elevation(uv-h);
 float yy=2.0*center-elevation(uv+h.yx)-elevation(uv-h.yx);
 float xy=(elevation(uv+h+h.yx)-elevation(uv+h-h.yx)-elevation(uv-h+h.yx)+elevation(uv-h-h.yx))*0.25;
 float mean=(xx+yy)*0.5;
 float spread=length(vec2((xx-yy)*0.5,xy));
 float ridge=max(0.0,mean+spread)*smoothstep(-0.00012,0.00002,mean-spread);
 float halo=smoothstep(0.000015,0.00038,ridge)*interior;
 float core=smoothstep(0.00016,0.00085,ridge)*interior;
 fragColor.rg=vec2(halo,core);
}`,
  advect: `uniform sampler2D velocity;
uniform sampler2D source;
uniform float dt;
uniform float decay;
uniform bool isVelocity;
void main(){
 if(!(isVelocity?wet(uv):inside(uv))){fragColor=vec4(0);return;}
 vec2 v=sampleLinear(velocity,uv).xy;
 vec2 midpoint=wall(uv-0.5*dt*v);
 vec2 back=wall(uv-dt*sampleLinear(velocity,midpoint).xy);
 vec4 value=sampleLinear(source,back)*decay;
 if(isVelocity){vec2 n=normalize(uv-0.5+vec2(0.000001));float edge=smoothstep(boundaryRadius-texel.x*(hybridBoundary?0.75:2.5),boundaryRadius,length(uv-0.5));value.xy-=n*dot(value.xy,n)*edge;}
 fragColor=value;
}`,
  momentum: `uniform sampler2D velocity;uniform sampler2D surface;uniform float dt;uniform float viscosity;
float height(vec2 p){return texture(surface,inside(p)?p:uv).x;}
vec2 vel(vec2 p){return curvedBoundary?boundaryVelocity(velocity,p):texture(velocity,inside(p)?p:uv).xy;}
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec2 h=vec2(texel.x,0),v=texture(velocity,uv).xy;
 vec2 slope=hybridBoundary
  ?vec2(scalarSlope(surface,uv,vec2(1,0)),scalarSlope(surface,uv,vec2(0,1)))
  :vec2(height(uv+h)-height(uv-h),height(uv+h.yx)-height(uv-h.yx))/(2.0*texel.x);
 vec2 laplacian=(vel(uv+h)+vel(uv-h)+vel(uv+h.yx)+vel(uv-h.yx)-4.0*v)/(texel.x*texel.x);
 // A spatially uniform tray force competes with the surface's hydrostatic slope.
 v=(v+dt*(push-1.2*slope+viscosity*laplacian))*exp(-1.45*dt);
 v*=min(1.0,0.65/max(length(v),0.00001));
 vec2 d=uv-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 if(!curvedBoundary)v-=n*dot(v,n)*smoothstep(boundaryRadius-texel.x*(hybridBoundary?0.75:1.5),boundaryRadius,r);
 fragColor=vec4(v,0,1);
}`,
  surface: `uniform sampler2D velocity;uniform sampler2D surface;uniform float dt;
float depth(vec2 p){
 float base=0.18-0.055*dot(p-0.5,p-0.5)/(boundaryRadius*boundaryRadius);
 return max(0.03,base+texture(surface,p).x);
}
float flux(vec2 neighbor,vec2 direction){
 if(!wet(neighbor))return 0.0;
 float speed=dot((texture(velocity,uv).xy+texture(velocity,neighbor).xy)*0.5,direction);
 if(hybridBoundary){
  // Couple pressure across each shared face: centered cell gradients alone
  // cannot see an alternating high/low (checkerboard) elevation field.
  float faceSlope=(texture(surface,neighbor).x-texture(surface,uv).x)/texel.x;
  float cellSlope=(scalarSlope(surface,uv,direction)+scalarSlope(surface,neighbor,direction))*0.5;
  speed-=dt*1.2*(faceSlope-cellSlope);
 }
 float aperture=1.0;
 if(curvedBoundary){
  vec2 face=uv+min(direction,vec2(0))*texel.x;
  vec4 geometry=texture(boundaryGeometry,face);
  aperture=abs(direction.x)>0.5?geometry.x:geometry.y;
  // Symmetric flux reduction prevents tiny cut cells imposing a tiny timestep.
  // Both sides use the same factor, preserving total depth exactly.
  if(!mergedBoundary)aperture*=min(1.0,2.0*min(texture(boundaryGeometry,uv).z,texture(boundaryGeometry,neighbor).z));
 }
 return aperture*speed*(speed>0.0?depth(uv):depth(neighbor));
}
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec2 h=vec2(texel.x,0);
 float outflow=flux(uv+h,vec2(1,0))+flux(uv-h,vec2(-1,0))+flux(uv+h.yx,vec2(0,1))+flux(uv-h.yx,vec2(0,-1));
 float volume=curvedBoundary?texture(boundaryGeometry,uv).z:1.0;
 if(!mergedBoundary){
  float elevation=texture(surface,uv).x-dt*outflow/(texel.x*volume);
  fragColor=vec4(clamp(elevation,-0.085,0.085),0,0,1);return;
 }
 float integral=texture(surface,uv).x*volume-dt*outflow/texel.x;
 // Keep integrated height until groups are combined, so tiny cells never
 // amplify or clip the update before their flux cancels with the neighbor.
 fragColor=vec4(integral,0,0,1);
}`,
  mergeSurface: `uniform sampler2D updates;uniform sampler2D surface;
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec4 group=texture(mergeGeometry,uv);
 if(group.y==texture(boundaryGeometry,uv).z){fragColor=vec4(texture(updates,uv).x/group.y,0,0,1);return;}
 float size=float(textureSize(mergeGeometry,0).x);
 vec2 parentCell=vec2(mod(group.x,size),floor(group.x/size));
 vec2 parent=(parentCell+0.5)*texel;
 float integral=texture(updates,parent).x;
 for(int k=0;k<4;k++){
  vec2 offset=k==0?vec2(1,0):k==1?vec2(-1,0):k==2?vec2(0,1):vec2(0,-1);
  vec2 p=parent+offset*texel;
  if(texture(mergeGeometry,p).x==group.x&&wet(p))integral+=texture(updates,p).x;
 }
 vec2 slope=vec2(scalarSlope(surface,parent,vec2(1,0)),scalarSlope(surface,parent,vec2(0,1)));
 float height=integral/group.y+dot(slope,(gl_FragCoord.xy-0.5-parentCell-group.zw)*texel);
 fragColor=vec4(height,0,0,1);
}`,
  // Display-only ghost values. Never used for mass flux or particle motion.
  padding: `uniform sampler2D source;uniform bool extrapolateHeight;uniform bool tangentVelocity;
void main(){
 vec2 d=uv-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float cell=1.0/float(textureSize(source,0).x);
 // Keep the height extrapolation band at its reference physical width on
 // the coarse grid, with at least one cell to protect interpolation taps.
 float inset=extrapolateHeight?max(cell,1.5/192.0):1.5*cell;
 float safeRadius=boundaryRadius-inset;
 if(r<=safeRadius){fragColor=sampleLinear(source,uv);return;}
 vec2 a=0.5+n*safeRadius;
 vec4 value=sampleLinear(source,a);
 if(extrapolateHeight){
  float previous=sampleLinear(source,a-n*cell*2.0).x;
  float slope=clamp((value.x-previous)/(cell*2.0),-0.5,0.5);
  value.x+=slope*(r-safeRadius);
 }
 if(tangentVelocity){value.xy-=n*dot(value.xy,n)*smoothstep(safeRadius,boundaryRadius,r);}
 fragColor=value;
}`,
  reframe: `uniform sampler2D source;uniform float previousRadius;uniform bool isVelocity;uniform bool isDye;
void main(){
 if(!(isDye?inside(uv):wet(uv))){fragColor=vec4(0);return;}
 float inset=1.5/float(textureSize(source,0).x);
 vec2 d=(uv-0.5)*previousRadius/boundaryRadius;
 vec2 p=0.5+d*min(1.0,(previousRadius-inset)/max(length(d),0.00001));
 vec4 value=sampleLinear(source,p);
 if(isVelocity)value.xy*=boundaryRadius/previousRadius;
 fragColor=value;
}`,
  reframeParticles: `uniform sampler2D particleState;uniform float previousRadius;
void main(){
 vec4 state=texture(particleState,uv);
 float ratio=boundaryRadius/previousRadius;
 vec2 d=(state.xy-0.5)*ratio;float r=length(d);
 float contact=hybridBoundary?boundaryRadius-0.0015:0.475;
 fragColor=vec4(0.5+d*min(1.0,contact/max(r,0.00001)),state.zw*ratio);
}`,
  scan: `uniform sampler2D dye;uniform sampler2D surface;uniform float progress;uniform float beamY;uniform float viewportSize;
void main(){
 vec2 d=uv-0.5;float r=length(d);
 if(r>R){fragColor=vec4(0);return;}
 float fade=smoothstep(0.0,0.045,progress)*(1.0-smoothstep(0.94,1.0,progress));
 float elevation=sampleBowl(surface,uv).x;
 float pigment=sampleBowl(dye,uv).r;
 // The red optical sweep bends over the surface instead of sliding over the UI.
 float distance=uv.y-(beamY+d.x*d.x*0.20+elevation*0.20+pigment*0.004);
 float width=max(0.0014,1.1/viewportSize);
 float core=exp(-pow(distance/width,2.0));
 float halo=exp(-pow(distance/0.012,2.0));
 float behind=distance*(1.0-2.0*step(0.5,progress));
 float trail=exp(-max(behind,0.0)/0.048)*smoothstep(-width,width,behind);
 float textureResponse=0.55+0.45*pigment;
 float hatch=0.5+0.5*cos(uv.y*viewportSize*2.094);
 // Brief segmented focus ring, like an optical reader acquiring the bowl.
 float angle=atan(d.y,d.x);
 float segments=smoothstep(0.86,0.94,abs(sin(angle*2.0)));
 float ring=exp(-pow((r-0.435)/max(width*0.7,0.001),2.0))*segments;
 float focus=ring*(1.0-smoothstep(0.06,0.19,progress))*0.30;
 // A faint mesh hugs the laser in both directions and fades immediately away from it.
 vec2 grid=(d*(1.0+0.18*dot(d,d))+vec2(0,elevation*0.12))*24.0;
 vec2 gridDistance=abs(fract(grid-0.5)-0.5)/max(fwidth(grid),vec2(0.0001));
 float lines=1.0-smoothstep(0.45,1.15,min(gridDistance.x,gridDistance.y));
 float nodes=1.0-smoothstep(1.0,1.8,length(gridDistance));
 float nearBeam=1.0-smoothstep(0.006,0.04,abs(distance));
 float mesh=(lines*0.12+nodes*0.07)*nearBeam;
 float alpha=fade*(core*0.94+halo*0.32+trail*textureResponse*hatch*0.13+focus+mesh);
 alpha*=1.0-smoothstep(R-0.007,R,r);
 vec3 laser=mix(vec3(1.0,0.025,0.055),vec3(1.0,0.70,0.64),core*0.72);
 fragColor=vec4(laser,clamp(alpha,0.0,0.96));
}`,
  display: `uniform sampler2D dye;uniform sampler2D surface;uniform sampler2D features;uniform vec2 tilt;
uniform bool crestsEnabled;uniform bool contoursEnabled;uniform bool heightEnabled;uniform bool gridEnabled;uniform bool dotsEnabled;uniform bool flowEnabled;
float phaseAt(vec2 p){return clamp(sampleBowl(dye,p).r,0.0,1.0);}
float isoline(float coordinate){
 float distance=abs(fract(coordinate-0.5)-0.5);
 float width=max(fwidth(coordinate),0.0001);
 return 1.0-smoothstep(width*0.35,width*1.25,distance);
}
void main(){
 vec2 d=uv-0.5;float r=length(d);
 float rimAA=fwidth(r);
 if(r>R+rimAA){fragColor=vec4(vec3(0.065),1);return;}
 float phase=phaseAt(uv);
 float dark=smoothstep(0.18,0.82,phase);
 vec2 h=vec2(1.0/512.0,0);
 vec2 gradient=vec2(phaseAt(uv+h)-phaseAt(uv-h),phaseAt(uv+h.yx)-phaseAt(uv-h.yx))/(2.0*h.x);
 vec2 sh=vec2(texel.x,0);
 vec2 slope=vec2(sampleBowl(surface,uv+sh).x-sampleBowl(surface,uv-sh).x,sampleBowl(surface,uv+sh.yx).x-sampleBowl(surface,uv-sh.yx).x)/(2.0*sh.x);
 float elevation=sampleBowl(surface,uv).x;
 // A small meniscus follows the evolving interface. Broad softbox highlights
 // make both phases wet, without floating sprites, static noise or film masks.
 vec3 normal=normalize(vec3(-slope*1.35-gradient*0.004-d*0.28+tilt*0.06,1.0));
 vec3 col=mix(vec3(0.90),vec3(0.045),dark);
 vec3 light=normalize(vec3(-0.5,0.65,1.1));
 col*=0.76+0.24*max(dot(normal,light),0.0);
 col*=1.0-elevation*0.6;
 vec3 reflection=reflect(vec3(0,0,-1),normal);
 float softbox=exp(-pow((reflection.x+0.21)/0.18,2.0)-pow((reflection.y-0.42)/0.65,6.0));
 float strip=exp(-pow((reflection.x-reflection.y*0.3-0.48)/0.075,2.0)-pow((reflection.y+0.15)/0.7,4.0));
 float spec=pow(max(dot(reflect(-light,normal),vec3(0,0,1)),0.0),44.0);
 col+=vec3(softbox*0.32+strip*0.18+spec*0.20)*mix(0.45,1.0,dark);
 float meniscus=4.0*phase*(1.0-phase);
 float edgeLight=max(dot(normalize(vec3(-gradient*0.004,1)),light),0.0);
 col+=vec3(meniscus*edgeLight*0.055);
 float edge=smoothstep(R-0.045,R,r);col*=1.0-0.30*edge;
 float interior=1.0-smoothstep(R-0.045,R,r);
 // Apply color layers before line work and crest light so every selected
 // effect remains visible, independent of the order of checkbox clicks.
 if(heightEnabled){
  float level=smoothstep(-0.045,0.045,elevation);
  vec3 low=mix(vec3(0.10,0.24,0.39),vec3(0.38,0.69,0.74),smoothstep(0.0,0.5,level));
  vec3 color=mix(low,vec3(1.0,0.84,0.57),smoothstep(0.5,1.0,level));
  float relief=smoothstep(0.001,0.018,abs(elevation));
  col=mix(col,color*(0.65+col*0.45),relief*interior*0.76);
 }
 if(flowEnabled){
  vec2 flow=sampleLinear(features,uv).ba;
  float swirl=smoothstep(0.05,0.9,abs(flow.x))*smoothstep(0.001,0.02,flow.y);
  vec3 color=mix(vec3(0.32,0.72,0.88),vec3(0.91,0.63,0.40),smoothstep(-0.3,0.3,flow.x));
  col=mix(col,color,swirl*0.38);
 }
 if(contoursEnabled){
  float lines=isoline(elevation*160.0);
  float relief=smoothstep(0.004,0.035,length(slope));
  col=mix(col*0.82,vec3(0.76,0.91,0.95),lines*relief*interior*0.78);
 }
 if(gridEnabled){
  vec2 grid=(uv+vec2(0.35,0.75)*elevation)*28.0;
  float lines=max(isoline(grid.x),isoline(grid.y));
  vec2 crest=sampleLinear(features,uv).rg;
  col=mix(col,vec3(0.63,0.81,0.85),lines*interior*(0.20+crest.x*0.55));
  col+=vec3(0.72,0.91,1.0)*lines*crest.y*0.40;
 }
 if(dotsEnabled){
  // A denser, surface-following lattice. Brightness follows the actual wave
  // height and curvature, so light travels with the crests without a timer.
  vec2 grid=(uv+vec2(0.35,0.75)*elevation)*72.0;
  float distance=length(fract(grid)-0.5);
  float aa=max(fwidth(distance),0.0001);
  float dotMask=1.0-smoothstep(0.12-aa*0.5,0.12+aa*0.5,distance);
  vec2 crest=sampleLinear(features,uv).rg;
  float intensity=clamp(0.16+0.48*smoothstep(-0.03,0.03,elevation)+crest.x*0.36+crest.y*0.22,0.0,1.0);
  vec3 dotColor=mix(vec3(0.13,0.19,0.23),vec3(0.91,0.97,1.0),intensity);
  col=mix(col,dotColor,dotMask*interior*0.90);
  float halo=1.0-smoothstep(0.12,0.34,distance);
  col+=vec3(0.60,0.83,1.0)*halo*crest.y*interior*0.12;
 }
 if(crestsEnabled){
  vec2 crest=sampleLinear(features,uv).rg;
  // A soft shoulder and a narrow luminous core preserve the ingredient texture.
  col=mix(col,vec3(0.94,0.97,1.0),crest.x*0.38);
  col+=vec3(0.75,0.88,1.0)*crest.y*0.32;
 }
 col=clamp(col,0.0,1.0);
 float coverage=1.0-smoothstep(R-rimAA,R+rimAA,r);
 fragColor=vec4(mix(vec3(0.065),col,coverage),1);
}`,
};

type Target = { texture: WebGLTexture; buffer: WebGLFramebuffer; size: number };
type Pair = { read: Target; write: Target };
type Program = { value: WebGLProgram; uniforms: Map<string, WebGLUniformLocation>; values: Map<string, number | boolean | number[]> };
type Uniform = number | boolean | number[] | Target;

export type SurfaceEffect = 'crests' | 'contours' | 'height' | 'grid' | 'dots' | 'flow';
export type RimMode = 'under' | 'edge' | 'hybrid' | 'curved';
export const WAVE_STRENGTH = { min: 1, max: 3, default: 1.25, step: 0.05 } as const;
export const WAVE_VISCOSITY = { min: 1, max: 4, default: 1, step: 0.1 } as const;
export type FluidQuality = 'detail' | 'performance';
export type FluidStats = { fps: number; quality: FluidQuality; pixels: number; resolution: number };
export type FluidOptions = { resolution?: 160 | 192 | 256 | 384; boundary?: 'previous' | 'merged'; stepScale?: 0.5 | 1; waves?: 'original' | 'higher'; quality?: FluidQuality; onStats?: (stats: FluidStats) => void; displayFiltering?: 'manual' };

export class FluidBowl {
  private gl: WebGL2RenderingContext;
  private programs = new Map<keyof typeof SOURCES, Program>();
  private targets: Target[] = [];
  private velocity: Pair;
  private dye: Pair;
  private phaseForward: Target;
  private phaseReverse: Target;
  private phaseChemical: Target;
  private phaseReductions: Target[] = [];
  private phaseAnchor: Target;
  private surface: Pair;
  private particles: Pair;
  private features: Target;
  private paddedSurface: Target;
  private paddedDye: Target;
  private paddedVelocity: Target;
  private crestSurface: Target;
  private boundaryGeometry: Target;
  private mergeGeometry: Target;
  private surfaceUpdate: Target;
  private readonly simSize: number;
  private readonly maxStep: number;
  private readonly mergeCells: boolean;
  private readonly quality: FluidQuality;
  private readonly onStats?: (stats: FluidStats) => void;
  private readonly linearSampler: WebGLSampler | null;
  private renderLimit: number;
  private statsStart = 0;
  private statsFrames = 0;
  private slowSamples = 0;
  private waveStrength: number;
  private waveViscosity: number = WAVE_VISCOSITY.default;
  private rimMode: RimMode = 'curved';
  private boundaryRadius = VISIBLE_RADIUS;
  private effects = new Set<SurfaceEffect>();
  private vao: WebGLVertexArrayObject;
  private tilt: Tilt = { x: 0, y: 0 };
  private targetTilt: Tilt = { x: 0, y: 0 };
  private frame = 0;
  private lastTime = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private visible = true;
  private intersectionObserver: IntersectionObserver;
  private slosh: Slosh = { offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
  private scanElapsed = -3;
  private motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private canvas: HTMLCanvasElement, options: FluidOptions = {}) {
    this.quality = options.quality ?? 'detail';
    this.onStats = options.onStats;
    this.renderLimit = this.quality === 'performance' ? 900 : 1300;
    this.simSize = options.resolution ?? (this.quality === 'performance' ? 160 : SIM_SIZE);
    this.mergeCells = options.boundary !== 'previous';
    this.waveStrength = options.waves === 'original' ? WAVE_STRENGTH.min : WAVE_STRENGTH.default;
    // Diffusion scales with dx², gravity waves with dx. Respect both when
    // coarsening the mobile grid instead of simply taking much longer steps.
    const gridScale = SIM_SIZE / this.simSize;
    this.maxStep = MAX_STEP * Math.min(gridScale, gridScale ** 2) * (options.stepScale ?? 1);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Tento prohlížeč nepodporuje potřebnou grafiku.');
    this.gl = gl;
    // Only display passes use hardware filtering. The solver and circular
    // geometry keep their exact nearest/manual sampling and conservation.
    this.linearSampler = options.displayFiltering !== 'manual' && gl.getExtension('OES_texture_float_linear') ? gl.createSampler() : null;
    if (this.linearSampler) {
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Nepodařilo se připravit grafiku.');
    this.vao = vao;
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    try {
      for (const [key, source] of Object.entries(SOURCES)) {
        const header = this.linearSampler && ['display', 'scan', 'crestHeight', 'features'].includes(key)
          ? HEADER.replace('precision highp float;', 'precision highp float;\n#define DISPLAY_LINEAR') : HEADER;
        this.programs.set(key as keyof typeof SOURCES, this.program(header + source, key === 'flowDisplay' ? PARTICLE_VERTEX : VERTEX));
      }
      this.velocity = this.pair(this.simSize);
      this.dye = this.pair(DYE_SIZE, true);
      this.phaseForward = this.target(DYE_SIZE, true);
      this.phaseReverse = this.target(DYE_SIZE, true);
      this.phaseChemical = this.target(DYE_SIZE, true);
      for (let size = DYE_SIZE / 2; size >= 1; size /= 2) this.phaseReductions.push(this.target(size, true));
      this.phaseAnchor = this.target(1, true);
      this.surface = this.pair(this.simSize, true);
      this.particles = this.pair(PARTICLE_SIZE, true);
      this.features = this.target(this.simSize);
      this.paddedSurface = this.target(this.simSize, true);
      this.paddedDye = this.target(DYE_SIZE);
      this.paddedVelocity = this.target(this.simSize);
      this.crestSurface = this.target(this.simSize, true);
      this.boundaryGeometry = this.target(this.simSize, true);
      this.mergeGeometry = this.target(this.simSize, true);
      this.surfaceUpdate = this.target(this.simSize, true);
    } catch (error) {
      for (const program of this.programs.values()) gl.deleteProgram(program.value);
      for (const target of this.targets) { gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.buffer); }
      gl.deleteSampler(this.linearSampler);
      gl.deleteVertexArray(vao);
      throw error;
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.lastTime = 0; }, { rootMargin: '100px' });
    this.intersectionObserver.observe(canvas);
    this.resize(); this.reset();
    this.frame = requestAnimationFrame(this.tick);
  }

  private shader(type: number, source: string) {
    const gl = this.gl, shader = gl.createShader(type);
    if (!shader) throw new Error('Nepodařilo se vytvořit shader.');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const detail = gl.getShaderInfoLog(shader); gl.deleteShader(shader); console.error(detail);
      throw new Error('Grafický program se nepodařilo připravit.');
    }
    return shader;
  }
  private program(source: string, vertexSource: string): Program {
    const gl = this.gl, vertex = this.shader(gl.VERTEX_SHADER, vertexSource);
    let fragment: WebGLShader;
    try { fragment = this.shader(gl.FRAGMENT_SHADER, source); } catch (error) { gl.deleteShader(vertex); throw error; }
    const value = gl.createProgram();
    if (!value) { gl.deleteShader(vertex); gl.deleteShader(fragment); throw new Error('Nepodařilo se vytvořit grafický program.'); }
    gl.attachShader(value, vertex); gl.attachShader(value, fragment); gl.linkProgram(value);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) { const detail = gl.getProgramInfoLog(value); gl.deleteProgram(value); console.error(detail); throw new Error('Grafický program není kompatibilní s tímto zařízením.'); }
    const uniforms = new Map<string, WebGLUniformLocation>();
    const count = gl.getProgramParameter(value, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(value, i)?.name;
      if (name) { const location = gl.getUniformLocation(value, name); if (location !== null) uniforms.set(name, location); }
    }
    return { value, uniforms, values: new Map() };
  }
  private target(size: number, fullPrecision = false): Target {
    const gl = this.gl, texture = gl.createTexture(), buffer = gl.createFramebuffer();
    if (!texture || !buffer) { if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteFramebuffer(buffer); throw new Error('Nedostatek grafické paměti.'); }
    const target = { texture, buffer, size }; this.targets.push(target);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fullPrecision ? gl.RGBA32F : gl.RGBA16F, size, size, 0, gl.RGBA, fullPrecision ? gl.FLOAT : gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Zařízení nepodporuje výpočty proudění.');
    return target;
  }
  private pair(size: number, fullPrecision = false): Pair { return { read: this.target(size, fullPrecision), write: this.target(size, fullPrecision) }; }
  private swap(pair: Pair) { [pair.read, pair.write] = [pair.write, pair.read]; }
  private uniform(program: Program, name: string, value: number | boolean | number[], integer = false) {
    const location = program.uniforms.get(name);
    if (location === undefined) return;
    const previous = program.values.get(name), gl = this.gl;
    if (Array.isArray(value)) {
      if (Array.isArray(previous) && previous[0] === value[0] && previous[1] === value[1]) return;
      gl.uniform2f(location, value[0], value[1]); program.values.set(name, [value[0], value[1]]);
    } else {
      if (previous === value) return;
      if (typeof value === 'boolean' || integer) gl.uniform1i(location, Number(value));
      else gl.uniform1f(location, value);
      program.values.set(name, value);
    }
  }
  private draw(name: keyof typeof SOURCES, target: Target | null, uniforms: Record<string, Uniform>) {
    const gl = this.gl, program = this.programs.get(name)!;
    const filtered = this.linearSampler && (name === 'display' || name === 'scan' || name === 'crestHeight' || name === 'features');
    gl.useProgram(program.value); gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.buffer ?? null);
    gl.viewport(0, 0, target?.size ?? this.canvas.width, target?.size ?? this.canvas.height);
    this.uniform(program, 'boundaryRadius', this.boundaryRadius);
    this.uniform(program, 'hybridBoundary', this.rimMode === 'hybrid' || this.rimMode === 'curved');
    this.uniform(program, 'curvedBoundary', this.rimMode === 'curved');
    this.uniform(program, 'mergedBoundary', this.rimMode === 'curved' && this.mergeCells);
    this.uniform(program, 'texel', [1 / this.simSize, 1 / this.simSize]);
    let unit = 0;
    for (const [key, value] of Object.entries({ boundaryGeometry: this.boundaryGeometry, mergeGeometry: this.mergeGeometry, ...uniforms })) {
      if (!program.uniforms.has(key)) continue;
      if (typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) this.uniform(program, key, value);
      else {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value.texture);
        if (filtered) gl.bindSampler(unit, this.linearSampler);
        this.uniform(program, key, unit++, true);
      }
    }
    if (name === 'flowDisplay' || name === 'scan') {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (name === 'flowDisplay') gl.drawArrays(gl.POINTS, 0, PARTICLE_SIZE * PARTICLE_SIZE);
      else gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
    } else gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (filtered) for (let i = 0; i < unit; i++) gl.bindSampler(i, null);
  }
  private resize() {
    const size = Math.max(1, Math.min(this.renderLimit, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))));
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
  }
  setTilt(value: Tilt) { this.targetTilt = clampTilt(value); }
  setWaveStrength(value: number) {
    if (Number.isFinite(value)) this.waveStrength = Math.min(WAVE_STRENGTH.max, Math.max(WAVE_STRENGTH.min, value));
  }
  setWaveViscosity(value: number) {
    if (Number.isFinite(value)) this.waveViscosity = Math.min(WAVE_VISCOSITY.max, Math.max(WAVE_VISCOSITY.min, value));
  }
  setEffects(values: readonly SurfaceEffect[]) { this.effects = new Set(values); }
  setRimMode(value: RimMode) {
    if (this.disposed || value === this.rimMode) return;
    const previousRadius = this.boundaryRadius;
    const previousCurved = this.rimMode === 'curved';
    this.rimMode = value;
    this.boundaryRadius = value === 'hybrid' || value === 'curved' ? VISIBLE_RADIUS : OUTER_RADIUS;
    if (previousRadius === this.boundaryRadius && previousCurved === (value === 'curved')) return;
    // Carry the current portion into the new domain instead of reseeding it.
    for (const pair of [this.velocity, this.surface, this.dye]) {
      this.draw('reframe', pair.write, { source: pair.read, previousRadius, isVelocity: pair === this.velocity, isDye: pair === this.dye });
      this.swap(pair);
    }
    this.draw('reframeParticles', this.particles.write, { particleState: this.particles.read, previousRadius });
    this.swap(this.particles);
    this.anchorMaterial();
    this.render();
  }
  getMotion() { return { offset: this.slosh.offset, oil: 0 }; }
  private materialTotals() {
    let source = this.dye.read;
    for (const target of this.phaseReductions) {
      this.draw('phaseReduce', target, { source, first: source === this.dye.read }); source = target;
    }
    return source;
  }
  private anchorMaterial() {
    this.draw('phaseAnchor', this.phaseAnchor, { totals: this.materialTotals() });
  }
  private stepMaterial(dt: number) {
    const velocity = this.velocity.read;
    // Art-directed surface-film travel amplifies the tray-driven flow while
    // leaving the accepted bowl waves and wall solver unchanged.
    const travel = dt * 3;
    this.draw('phaseTransport', this.phaseForward, { phase: this.dye.read, velocity, dt: travel, correct: false });
    this.draw('phaseTransport', this.phaseReverse, { phase: this.phaseForward, velocity, dt: -travel, correct: false });
    this.draw('phaseTransport', this.dye.write, { phase: this.phaseForward, original: this.dye.read, reverse: this.phaseReverse, velocity, dt: travel, correct: true });
    this.swap(this.dye);
    const steps = Math.ceil(dt * 12 / 0.03);
    for (let i = 0; i < steps; i++) {
      this.draw('phaseChemical', this.phaseChemical, { phase: this.dye.read });
      this.draw('phaseRelax', this.dye.write, { chemical: this.phaseChemical, phaseStep: dt * 12 / steps });
      this.swap(this.dye);
    }
    // Transport on this compressible 2D surface can drift in area. Correct only
    // the interface toward the initial phase ratio; don't repaint the pattern.
    this.draw('phaseConserve', this.dye.write, { phase: this.dye.read, totals: this.materialTotals(), anchor: this.phaseAnchor });
    this.swap(this.dye);
  }
  private reportFrame(time: number) {
    if (!this.statsStart) { this.statsStart = time; this.statsFrames = 0; return; }
    this.statsFrames++;
    const seconds = (time - this.statsStart) / 1000;
    if (seconds < 1) return;
    const fps = this.statsFrames / seconds;
    this.slowSamples = fps < 50 ? this.slowSamples + 1 : 0;
    if (this.quality === 'performance' && this.slowSamples >= 3 && this.renderLimit > 600) {
      // Reduce shading pixels only. Never change grid/state mid-portion or
      // relax stable physics steps to catch up with a slow device.
      this.renderLimit = Math.max(600, Math.round(this.renderLimit * 0.85));
      this.resize(); this.slowSamples = 0;
    }
    this.onStats?.({ fps: Math.round(fps), quality: this.quality, pixels: this.canvas.width, resolution: this.simSize });
    this.statsStart = time; this.statsFrames = 0;
  }
  private render() {
    const crestsEnabled = this.effects.has('crests'), gridEnabled = this.effects.has('grid'), dotsEnabled = this.effects.has('dots'), flowEnabled = this.effects.has('flow');
    const crestMode = crestsEnabled || gridEnabled || dotsEnabled;
    let surface = this.surface.read, dye = this.dye.read, velocity = this.velocity.read;
    if (this.rimMode === 'hybrid' || this.rimMode === 'curved') {
      this.draw('padding', this.paddedSurface, { source: surface, extrapolateHeight: true, tangentVelocity: false });
      this.draw('padding', this.paddedDye, { source: dye, extrapolateHeight: false, tangentVelocity: false });
      surface = this.paddedSurface; dye = this.paddedDye;
      if (flowEnabled) {
        this.draw('padding', this.paddedVelocity, { source: velocity, extrapolateHeight: false, tangentVelocity: true });
        velocity = this.paddedVelocity;
      }
    }
    if (crestMode || flowEnabled) {
      let featureSurface = surface;
      if (this.rimMode === 'curved' && crestMode) {
        this.draw('crestHeight', this.crestSurface, { surface });
        featureSurface = this.crestSurface;
      }
      this.draw('features', this.features, { surface: featureSurface, velocity, flowMode: flowEnabled, crestMode });
    }
    this.draw('display', null, { dye, surface, features: this.features, crestsEnabled, gridEnabled, dotsEnabled, flowEnabled, contoursEnabled: this.effects.has('contours'), heightEnabled: this.effects.has('height'), tilt: [this.tilt.x, -this.tilt.y] });
    if (flowEnabled) this.draw('flowDisplay', null, { particleState: this.particles.read, viewportSize: this.canvas.width });
    const scanning = this.scanElapsed >= 0 && !this.motionPreference.matches;
    if (!scanning) return;
    const progress = this.scanElapsed / SCAN_DURATION;
    const pass = 1 - Math.abs(progress * 2 - 1);
    const t = Math.max(0, Math.min(1, (pass - 0.08) / 0.86));
    const beamY = 1.08 - 1.16 * t * t * (3 - 2 * t);
    this.draw('scan', null, { dye, surface, progress, beamY, viewportSize: this.canvas.width });
  }
  reset() {
    if (this.disposed) return;
    const gl = this.gl;
    for (const target of this.targets) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindTexture(gl.TEXTURE_2D, this.boundaryGeometry.texture);
    const geometry = circleBoundary(this.simSize, VISIBLE_RADIUS);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simSize, this.simSize, gl.RGBA, gl.FLOAT, geometry);
    gl.bindTexture(gl.TEXTURE_2D, this.mergeGeometry.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simSize, this.simSize, gl.RGBA, gl.FLOAT, circleMergeGroups(this.simSize, geometry));
    this.draw('init', this.dye.read, { seed: Math.random() * 20 });
    this.anchorMaterial();
    this.draw('particleInit', this.particles.read, { seed: Math.random() * 20 });
    this.slosh = { offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } }; this.scanElapsed = -3;
    this.render();
  }
  private tick = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (document.hidden || !this.visible) { this.lastTime = 0; this.statsStart = 0; this.statsFrames = 0; this.slowSamples = 0; return; }
    if (!this.lastTime) { this.lastTime = time; return; }
    const elapsed = (time - this.lastTime) / 1000;
    if (elapsed < 1 / 62) return;
    this.lastTime = time;
    this.scanElapsed += Math.min(elapsed, 0.1);
    if (this.scanElapsed > SCAN_DURATION) this.scanElapsed = -(11 + Math.random() * 7);
    const dt = Math.min(elapsed, 1 / 30);
    const previous = this.tilt;
    this.tilt = smoothTilt(previous, this.targetTilt, dt);
    const trayForce = tiltForces(previous, this.tilt, dt);
    // Increase the physical surface response, including the matching wall
    // pressure condition. Sensor calibration, damping and rendering stay fixed.
    const force = { x: trayForce.x * this.waveStrength, y: trayForce.y * this.waveStrength };
    const viscosity = BASE_VISCOSITY * this.waveViscosity;
    // Explicit diffusion needs a smaller step as viscosity rises. Keep a
    // margin below dx² / (4ν), including at diagnostic grid resolutions.
    const diffusionStep = 0.2 / (viscosity * this.simSize ** 2);
    // The exaggerated >2× forcing also needs more substeps for steep waves.
    const waveStep = this.maxStep / Math.max(1, this.waveStrength - 1);
    const steps = Math.ceil(dt / Math.min(waveStep, diffusionStep)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.slosh = stepSlosh(this.slosh, force, step);
      this.draw('advect', this.velocity.write, { velocity: this.velocity.read, source: this.velocity.read, dt: step, decay: 1, isVelocity: true }); this.swap(this.velocity);
      this.draw('momentum', this.velocity.write, { velocity: this.velocity.read, surface: this.surface.read, push: [force.x, force.y], dt: step, viscosity }); this.swap(this.velocity);
      const merging = this.rimMode === 'curved' && this.mergeCells;
      this.draw('surface', merging ? this.surfaceUpdate : this.surface.write, { velocity: this.velocity.read, surface: this.surface.read, push: [force.x, force.y], dt: step });
      if (merging) this.draw('mergeSurface', this.surface.write, { updates: this.surfaceUpdate, surface: this.surface.read, push: [force.x, force.y] });
      this.swap(this.surface);
    }
    this.stepMaterial(dt);
    if (this.effects.has('flow')) {
      this.draw('particleStep', this.particles.write, { particleState: this.particles.read, velocity: this.velocity.read, dt }); this.swap(this.particles);
    }
    this.reportFrame(time);
    this.render();
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
    for (const program of this.programs.values()) this.gl.deleteProgram(program.value);
    for (const target of this.targets) { this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.buffer); }
    this.gl.deleteSampler(this.linearSampler);
    this.gl.deleteVertexArray(this.vao);
  }
}
