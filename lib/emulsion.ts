// A transported concentration field. The dedicated material-current solver
// supplies velocity; this material model does not feed capillary forces back
// into that solver. All mass reductions/corrections stay on the GPU.
const PHASE = `
uniform sampler2D phase;
float concentration(vec2 p){
 return texture(phase,inside(p)?p:uv).r;
}
`;

export const EMULSION_SOURCES = {
  init: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 p=uv*11.0;
 p+=vec2(noise(p*0.72+7.0),noise(p*0.72+23.0))*1.6;
 float field=noise(p)*0.70+noise(p*2.1+11.0)*0.25+noise(p*4.3)*0.05;
 float c=smoothstep(0.465,0.505,field);
 fragColor=vec4(c,0,0,1);
}`,
  // Bounded MacCormack transport recovers fine filaments lost by a single
  // semi-Lagrangian lookup. The donor-cell limiter prevents ringing/overshoot.
  phaseTransport: `uniform sampler2D phase;uniform sampler2D velocity;uniform float dt;
uniform sampler2D original;uniform sampler2D reverse;uniform bool correct;
vec2 phaseWall(vec2 p){
 vec2 d=p-0.5;float inset=1.5/float(textureSize(phase,0).x);
 return 0.5+d*min(1.0,(boundaryRadius-inset)/max(length(d),0.00001));
}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 v=sampleLinear(velocity,uv).xy;
 vec2 mid=phaseWall(uv-dt*v*0.5);
 vec2 back=phaseWall(uv-dt*sampleLinear(velocity,mid).xy);
 float c;
 if(correct){
  c=texture(phase,uv).r+0.5*(texture(original,uv).r-texture(reverse,uv).r);
  vec2 size=vec2(textureSize(original,0));vec2 p=(floor(back*size-0.5)+0.5)/size;
  float lo=1.0,hi=0.0;
  for(int y=0;y<2;y++)for(int x=0;x<2;x++){
   float a=texture(original,phaseWall(p+vec2(float(x),float(y))/size)).r;
   lo=min(lo,a);hi=max(hi,a);
  }
  c=clamp(c,lo,hi);
 }else c=sampleLinear(phase,back).r;
 fragColor=vec4(clamp(c,0.0,1.0),0,0,1);
}`,
  phaseChemical: PHASE + `
uniform float miscibility;
uniform float separationSeed;
float separationHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+separationSeed)*43758.5453);}
float separationNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(separationHash(i),separationHash(i+vec2(1,0)),f.x),mix(separationHash(i+vec2(0,1)),separationHash(i+1.0),f.x),f.y);
}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 float h=1.0/float(textureSize(phase,0).x),c=concentration(uv),lap=0.0;
 // Nine-point isotropic Laplacian reduces alignment with the texture grid.
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(x==0&&y==0)continue;
  float w=x==0||y==0?2.0/3.0:1.0/6.0;
  lap+=w*(concentration(uv+vec2(float(x),float(y))*h)-c);
 }
 // Stirring gradually turns the phase-separating potential into a convex
 // mixing potential. Neighbor exchange then blends the actual concentration;
 // it is not a screen-wide fade to gray. Quiet periods restore separation.
 float chemical=(1.0-miscibility)*4.0*c*(c-0.5)*(c-1.0)+miscibility*1.5*c-0.70*lap;
 // A perfectly uniform concentration cannot spontaneously break symmetry.
 // Tiny smooth chemical-potential fluctuations nucleate new domains as the
 // mixture cools, without injecting concentration or restoring the seed image.
 // Fade them outside the transition and once a domain becomes distinct.
 float recovery=smoothstep(0.02,0.12,miscibility)*(1.0-smoothstep(0.20,0.40,miscibility));
 float mixed=exp(-pow((c-0.5)/0.16,2.0));
 vec2 p=mat2(0.8,-0.6,0.6,0.8)*uv;
 float fluctuation=2.0*(0.7*separationNoise(p*17.0)+0.3*separationNoise(p*31.0+17.0)-0.5);
 chemical+=0.0015*recovery*mixed*fluctuation;
 fragColor=vec4(c,chemical,0,1);
}`,
  // Cahn–Hilliard-style chemical-potential exchange. Each shared edge uses
  // equal/opposite transfers, limited by donor and receiver capacities. This
  // keeps both fractions bounded and conserves their sum without CPU readback.
  phaseRelax: `uniform sampler2D chemical;uniform float phaseStep;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 state=texture(chemical,uv).rg;float c=state.r;
 float h=1.0/float(textureSize(chemical,0).x),change=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(x==0&&y==0)continue;
  vec2 p=uv+vec2(float(x),float(y))*h;
  if(!inside(p))continue;
  vec2 other=texture(chemical,p).rg;
  float w=x==0||y==0?2.0/3.0:1.0/6.0;
  float transfer=phaseStep*w*(other.g-state.g);
  transfer=clamp(transfer,-min(c,1.0-other.r)/8.0,min(other.r,1.0-c)/8.0);
  change+=transfer;
 }
 fragColor=vec4(c+change,0,0,1);
}`,
  phaseReduce: `uniform sampler2D source;uniform bool first;
void main(){
 ivec2 cell=ivec2(gl_FragCoord.xy)*2;vec4 sum=vec4(0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  ivec2 p=cell+ivec2(x,y);vec4 value=texelFetch(source,p,0);
  if(first){
   vec2 point=(vec2(p)+0.5)/vec2(textureSize(source,0));
   float c=clamp(value.r,0.0,1.0);
   value=inside(point)?vec4(c,min(c,1.0-c),1,0):vec4(0);
  }
  sum+=value;
 }
 fragColor=sum*0.25;
}`,
  phaseAnchor: `uniform sampler2D totals;
void main(){vec4 s=texelFetch(totals,ivec2(0),0);fragColor=vec4(s.r/max(s.b,0.00001),0,0,1);}`,
  phaseConserve: `uniform sampler2D phase;uniform sampler2D totals;uniform sampler2D anchor;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec4 s=texelFetch(totals,ivec2(0),0);
 float target=texelFetch(anchor,ivec2(0),0).r;
 float correction=clamp((target*s.b-s.r)/max(s.g,0.0000001),-1.0,1.0);
 float c=clamp(texture(phase,uv).r,0.0,1.0);
 c+=min(c,1.0-c)*correction;
 fragColor=vec4(c,0,0,1);
}`,
};
