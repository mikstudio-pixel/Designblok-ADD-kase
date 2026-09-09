import { clampTilt, smoothTilt, tiltForces, type Tilt } from './tilt';

// Circular incompressible 2D flow with dye advection. Tilt is art-directed.
const SIM_SIZE = 192;
const DYE_SIZE = 512;
const PARTICLE_SIZE = 32;
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
const float R=0.495;
bool inside(vec2 p){return length(p-0.5)<R;}
vec2 wall(vec2 p){vec2 d=p-0.5;return 0.5+d*min(1.0,(R-texel.x)/max(length(d),0.00001));}
vec4 sampleLinear(sampler2D source, vec2 p){
  vec2 size=vec2(textureSize(source,0));
  vec2 q=p*size-0.5;vec2 i=floor(q);vec2 f=fract(q);
  vec2 a=(i+0.5)/size;vec2 h=1.0/size;
  return mix(mix(texture(source,a),texture(source,a+vec2(h.x,0)),f.x),mix(texture(source,a+vec2(0,h.y)),texture(source,a+h),f.x),f.y);
}
`;
const PARTICLE_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D particleState;
uniform float viewportSize;
out vec2 uv;
out float grainSeed;
void main(){
  ivec2 cell=ivec2(gl_VertexID%32,gl_VertexID/32);
  vec2 p=texelFetch(particleState,cell,0).xy;
  grainSeed=fract(sin(float(gl_VertexID)*127.1+31.7)*43758.5453);
  uv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);
  gl_PointSize=max(2.0,viewportSize*(0.003+0.004*grainSeed+0.007*step(0.93,grainSeed)));
}`;
const SOURCES = {
  init: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
float lumps(vec2 p){return noise(p)*0.57+noise(p*2.13+7.1)*0.28+noise(p*4.37+19.3)*0.15;}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 // Overlapping irregular patches replace the radial, three-lobed garnish.
 vec2 p=uv*5.8;
 p+=vec2(noise(p+3.2),noise(p+11.7))*0.9;
 float cocoa=smoothstep(0.48,0.76,lumps(p+vec2(13,2)))*0.72;
 float darkPatches=smoothstep(0.42,0.73,lumps(p*1.35+vec2(2,17)))*0.62;
 float lightPatches=smoothstep(0.34,0.70,lumps(p*2.2+31.0))*0.48;
 vec2 cell=floor(uv*110.0);vec2 local=fract(uv*110.0)-0.5;
 float grain=(1.0-smoothstep(0.12,0.34,length(local)))*step(0.80,hash(cell));
 fragColor=vec4(clamp(cocoa+grain*0.45,0.,1.),darkPatches,lightPatches,1.0);
}`,
  particleInit: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
void main(){
 vec2 cell=floor(uv*32.0);float a=hash(cell)*6.2831853;float r=sqrt(hash(cell+17.3))*0.465;
 fragColor=vec4(vec2(cos(a),sin(a))*r+0.5,0,0);
}`,
  particleStep: `uniform sampler2D particleState;uniform sampler2D velocity;uniform float dt;
void main(){
 vec4 state=texture(particleState,uv);vec2 p=state.xy;
 vec2 flow=sampleLinear(velocity,p).xy;
 vec2 v=mix(state.zw,flow,1.0-exp(-dt*35.0));
 // Polar integration preserves circular orbits instead of Euler drift to the rim.
 vec2 offset=p-0.5;float radius=max(length(offset),0.003);
 vec2 normal=offset/radius;vec2 tangent=vec2(-normal.y,normal.x);
 float angle=atan(offset.y,offset.x)+dot(v,tangent)/radius*dt;
 radius=max(0.003,radius+dot(v,normal)*dt*0.16);
 p=0.5+vec2(cos(angle),sin(angle))*radius;
 vec2 d=p-0.5;float r=length(d);
 if(r>0.475){vec2 n=d/max(r,0.00001);p=0.5+n*0.475;v-=1.5*n*max(dot(v,n),0.0);}
 fragColor=vec4(p,v);
}`,
  particleDisplay: `in float grainSeed;
void main(){
 vec2 p=gl_PointCoord*2.0-1.0;
 float angle=atan(p.y,p.x);float edge=0.90+0.065*sin(angle*5.0+grainSeed*11.0);
 float r=length(p)/edge;if(r>1.0)discard;
 float light=0.5+0.5*dot(normalize(vec3(-p.x,p.y,sqrt(max(0.0,1.0-r*r)))),normalize(vec3(-0.5,0.7,0.9)));
 float shade=mix(0.27,0.91,light);
 if(grainSeed>0.93)shade*=0.63;
 fragColor=vec4(vec3(shade),1.0-smoothstep(0.72,1.0,r));
}`,
  advect: `uniform sampler2D velocity;
uniform sampler2D source;
uniform float dt;
uniform float decay;
uniform bool isVelocity;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 v=sampleLinear(velocity,uv).xy;
 vec2 midpoint=wall(uv-0.5*dt*v);
 vec2 back=wall(uv-dt*sampleLinear(velocity,midpoint).xy);
 vec4 value=sampleLinear(source,back)*decay;
 if(isVelocity){vec2 n=normalize(uv-0.5+vec2(0.000001));float edge=smoothstep(R-texel.x*2.5,R,length(uv-0.5));value.xy-=n*dot(value.xy,n)*edge;}
 fragColor=value;
}`,
  force: `uniform sampler2D velocity;
uniform vec2 tilt;
uniform vec2 push;
uniform float spin;
uniform float dt;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 d=uv-0.5;float r=length(d);
 vec2 v=texture(velocity,uv).xy;
 float center=exp(-dot(d,d)/0.075);
 vec2 mover=d-tilt*0.23;float local=exp(-dot(mover,mover)/0.018);
 vec2 n=d/max(r,0.00001);
 // Circular stirring dominates. Translation is only a small disturbance.
 v-=n*dot(v,n)*(1.0-exp(-dt*7.0));
 vec2 f=push*(center*0.8+local*1.2)*0.055+vec2(-d.y,d.x)*spin*3.2*(1.0-smoothstep(0.31,R,r));
 v+=dt*f;
 v*=min(1.0,1.5/max(length(v),0.0001));
 v-=n*dot(v,n)*smoothstep(R-texel.x*3.0,R,r);
 fragColor=vec4(v,0,1);
}`,
  curl: `uniform sampler2D velocity;
vec2 vel(vec2 p){return inside(p)?texture(velocity,p).xy:vec2(0);}
void main(){if(!inside(uv)){fragColor=vec4(0);return;}
 float value=(vel(uv+vec2(texel.x,0)).y-vel(uv-vec2(texel.x,0)).y-vel(uv+vec2(0,texel.y)).x+vel(uv-vec2(0,texel.y)).x)*0.5;
 fragColor=vec4(value,0,0,1);
}`,
  vorticity: `uniform sampler2D velocity;uniform sampler2D curl;uniform float dt;
void main(){if(!inside(uv)){fragColor=vec4(0);return;}
 float c=texture(curl,uv).x;
 vec2 gradient=vec2(abs(texture(curl,uv+vec2(texel.x,0)).x)-abs(texture(curl,uv-vec2(texel.x,0)).x),abs(texture(curl,uv+vec2(0,texel.y)).x)-abs(texture(curl,uv-vec2(0,texel.y)).x));
 vec2 n=gradient/(length(gradient)+0.00001);
 vec2 v=texture(velocity,uv).xy+dt*vec2(n.y,-n.x)*c*9.0;
 fragColor=vec4(v,0,1);
}`,
  divergence: `uniform sampler2D velocity;
vec2 vel(vec2 p){
 vec2 v=texture(velocity,uv).xy;
 if(inside(p))return texture(velocity,p).xy;
 vec2 n=normalize(p-0.5);return v-2.0*n*dot(v,n);
}
void main(){if(!inside(uv)){fragColor=vec4(0);return;}
 float d=(vel(uv+vec2(texel.x,0)).x-vel(uv-vec2(texel.x,0)).x+vel(uv+vec2(0,texel.y)).y-vel(uv-vec2(0,texel.y)).y)/(2.0*texel.x);
 fragColor=vec4(d,0,0,1);
}`,
  pressure: `uniform sampler2D pressure;uniform sampler2D divergence;
float p(vec2 at){return texture(pressure,inside(at)?at:uv).x;}
void main(){if(!inside(uv)){fragColor=vec4(0);return;}
 float result=(p(uv-vec2(texel.x,0))+p(uv+vec2(texel.x,0))+p(uv-vec2(0,texel.y))+p(uv+vec2(0,texel.y))-texture(divergence,uv).x*texel.x*texel.x)*0.25;
 fragColor=vec4(result,0,0,1);
}`,
  project: `uniform sampler2D pressure;uniform sampler2D velocity;
float p(vec2 at){return texture(pressure,inside(at)?at:uv).x;}
void main(){if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 gradient=vec2(p(uv+vec2(texel.x,0))-p(uv-vec2(texel.x,0)),p(uv+vec2(0,texel.y))-p(uv-vec2(0,texel.y)))/(2.0*texel.x);
 vec2 v=texture(velocity,uv).xy-gradient;
 float r=length(uv-0.5);vec2 n=(uv-0.5)/max(r,0.00001);
 v-=n*dot(v,n)*smoothstep(R-texel.x*2.0,R,r);
 fragColor=vec4(v,0,1);
}`,
  display: `uniform sampler2D dye;uniform vec2 tilt;uniform float oil;uniform vec2 oilOffset;
float oilField(vec2 p){
 p=p*18.0+oilOffset;
 p+=vec2(sin(p.y*0.53),cos(p.x*0.41))*1.9;
 return sin(p.x)*cos(p.y)*0.55+sin(p.x*0.71+p.y*0.39+1.0)*0.32;
}
float heightAt(vec2 p){vec3 d=sampleLinear(dye,wall(p)).rgb;return d.r*0.45+d.g*0.18+d.b*0.2;}
void main(){
 vec2 d=uv-0.5;float r=length(d);
 if(r>R){fragColor=vec4(vec3(0.065),1);return;}
 vec3 pigment=max(sampleLinear(dye,uv).rgb,vec3(0));
 vec3 milk=vec3(0.83);
 vec3 cocoa=vec3(0.18),darkRibbon=vec3(0.40),lightRibbon=vec3(0.67);
 vec3 col=milk;
 col=mix(col,cocoa,clamp(pigment.r*1.25,0.,0.90));
 col=mix(col,darkRibbon,clamp(pigment.g*1.55,0.,0.88));
 col=mix(col,lightRibbon,clamp(pigment.b*1.3,0.,0.82));
 vec2 h=vec2(1.0/512.0,0);
 vec2 gradient=vec2(heightAt(uv+h)-heightAt(uv-h),heightAt(uv+h.yx)-heightAt(uv-h.yx));
 vec3 normal=normalize(vec3(-gradient*16.0+tilt*0.09,1.0));
 vec3 light=normalize(vec3(-0.4,0.6,1.0));
 col*=0.77+0.27*max(dot(normal,light),0.);
 col+=pow(max(dot(reflect(-light,normal),vec3(0,0,1)),0.),28.0)*0.10;
 float edge=smoothstep(R-0.045,R,r);col*=1.0-0.39*edge;
 float glint=exp(-pow((r-(R-0.012))/0.004,2.0))*max(dot(normalize(d+vec2(0.00001)),normalize(vec2(-0.6,0.8))),0.0);
 col+=glint*0.16;
 // Emulsification is stylized: patches reappear gradually once the tray settles.
 float field=oilField(uv);
 float film=smoothstep(0.22,0.38,field)*oil*(1.0-smoothstep(0.42,R,r));
 float rim=exp(-pow((field-0.30)/0.032,2.0))*oil;
 float sheen=0.5+0.5*sin(uv.x*13.0+uv.y*9.0+oilOffset.x);
 col=mix(col,col*0.80+vec3(0.13+0.11*sheen),film*0.72);
 col+=vec3(rim*0.085)*(1.0-smoothstep(0.44,R,r));
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 col+=(grain-0.5)*0.016;
 fragColor=vec4(col,1);
}`,
};

type Target = { texture: WebGLTexture; buffer: WebGLFramebuffer; size: number };
type Pair = { read: Target; write: Target };
type Program = { value: WebGLProgram; uniforms: Map<string, WebGLUniformLocation> };
type Uniform = number | boolean | number[] | Target;

export class FluidBowl {
  private gl: WebGL2RenderingContext;
  private programs = new Map<keyof typeof SOURCES, Program>();
  private targets: Target[] = [];
  private velocity: Pair;
  private dye: Pair;
  private pressure: Pair;
  private divergence: Target;
  private curl: Target;
  private particles: Pair;
  private vao: WebGLVertexArrayObject;
  private tilt: Tilt = { x: 0, y: 0 };
  private targetTilt: Tilt = { x: 0, y: 0 };
  private frame = 0;
  private lastTime = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private visible = true;
  private intersectionObserver: IntersectionObserver;
  private quietTime = 0;
  private oil = 0;
  private oilOffset: Tilt = { x: 0, y: 0 };
  private circulation = 0;
  private phase = 0;
  private activity = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Tento prohlížeč nepodporuje potřebnou grafiku.');
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Nepodařilo se připravit grafiku.');
    this.vao = vao;
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    try {
      for (const [key, source] of Object.entries(SOURCES)) this.programs.set(key as keyof typeof SOURCES, this.program(HEADER + source, key === 'particleDisplay' ? PARTICLE_VERTEX : VERTEX));
      this.velocity = this.pair(SIM_SIZE);
      this.dye = this.pair(DYE_SIZE);
      this.pressure = this.pair(SIM_SIZE);
      this.divergence = this.target(SIM_SIZE);
      this.curl = this.target(SIM_SIZE);
      this.particles = this.pair(PARTICLE_SIZE);
    } catch (error) {
      for (const program of this.programs.values()) gl.deleteProgram(program.value);
      for (const target of this.targets) { gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.buffer); }
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
    return { value, uniforms };
  }
  private target(size: number): Target {
    const gl = this.gl, texture = gl.createTexture(), buffer = gl.createFramebuffer();
    if (!texture || !buffer) { if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteFramebuffer(buffer); throw new Error('Nedostatek grafické paměti.'); }
    const target = { texture, buffer, size }; this.targets.push(target);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Zařízení nepodporuje výpočty proudění.');
    return target;
  }
  private pair(size: number): Pair { return { read: this.target(size), write: this.target(size) }; }
  private swap(pair: Pair) { [pair.read, pair.write] = [pair.write, pair.read]; }
  private draw(name: keyof typeof SOURCES, target: Target | null, uniforms: Record<string, Uniform>) {
    const gl = this.gl, program = this.programs.get(name)!;
    gl.useProgram(program.value); gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.buffer ?? null);
    gl.viewport(0, 0, target?.size ?? this.canvas.width, target?.size ?? this.canvas.height);
    const texel = program.uniforms.get('texel');
    if (texel !== undefined) gl.uniform2f(texel, 1 / SIM_SIZE, 1 / SIM_SIZE);
    let unit = 0;
    for (const [key, value] of Object.entries(uniforms)) {
      const location = program.uniforms.get(key);
      if (location === undefined) continue;
      if (typeof value === 'number') gl.uniform1f(location, value);
      else if (typeof value === 'boolean') gl.uniform1i(location, value ? 1 : 0);
      else if (Array.isArray(value)) gl.uniform2f(location, value[0], value[1]);
      else { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value.texture); gl.uniform1i(location, unit++); }
    }
    if (name === 'particleDisplay') {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_SIZE * PARTICLE_SIZE); gl.disable(gl.BLEND);
    } else gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private resize() {
    const size = Math.max(1, Math.min(1300, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))));
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
  }
  setTilt(value: Tilt) { this.targetTilt = clampTilt(value); }
  getMotion() { return { phase: this.phase, activity: this.activity, oil: this.oil }; }
  private render() {
    this.draw('display', null, { dye: this.dye.read, tilt: [this.tilt.x, -this.tilt.y], oil: this.oil, oilOffset: [this.oilOffset.x, this.oilOffset.y] });
    this.draw('particleDisplay', null, { particleState: this.particles.read, viewportSize: this.canvas.width });
  }
  reset() {
    if (this.disposed) return;
    const gl = this.gl;
    for (const target of this.targets) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    this.draw('init', this.dye.read, { seed: Math.random() * 20 });
    this.draw('particleInit', this.particles.read, { seed: Math.random() * 20 });
    this.quietTime = 0; this.oil = 0; this.phase = 0; this.circulation = 0; this.activity = 0; this.oilOffset = { x: 0, y: 0 };
    this.render();
  }
  private tick = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (document.hidden || !this.visible) { this.lastTime = 0; return; }
    if (!this.lastTime) { this.lastTime = time; return; }
    const elapsed = (time - this.lastTime) / 1000;
    if (elapsed < 1 / 62) return;
    this.lastTime = time;
    const dt = Math.min(elapsed, 1 / 30);
    const previous = this.tilt;
    this.tilt = smoothTilt(previous, this.targetTilt, dt);
    const force = tiltForces(previous, this.tilt, dt);
    const energy = Math.min(1, Math.hypot(this.tilt.x, this.tilt.y) + Math.abs(force.spin) * 0.25);
    this.activity += (energy - this.activity) * (1 - Math.exp(-dt * (energy > this.activity ? 8 : 1.2)));
    this.circulation += (force.spin - this.circulation) * (1 - Math.exp(-dt * 1.8));
    this.phase += (this.circulation * 1.4 + this.activity * 0.2) * dt;
    this.quietTime = energy < 0.025 ? this.quietTime + dt : 0;
    const surfaceOil = 1 - Math.exp(-Math.max(0, this.quietTime - 1.8) / 4.0);
    this.oil += (surfaceOil - this.oil) * (1 - Math.exp(-dt * (surfaceOil > this.oil ? 1.2 : 6)));
    this.oilOffset.x += (force.x * 0.3 + this.circulation * 0.2) * dt;
    this.oilOffset.y += force.y * 0.3 * dt;
    this.draw('advect', this.velocity.write, { velocity: this.velocity.read, source: this.velocity.read, dt, decay: Math.exp(-1.0 * dt), isVelocity: true }); this.swap(this.velocity);
    this.draw('force', this.velocity.write, { velocity: this.velocity.read, tilt: [this.tilt.x, -this.tilt.y], push: [force.x, force.y], spin: Math.max(-0.8, Math.min(0.8, this.circulation)), dt }); this.swap(this.velocity);
    this.draw('curl', this.curl, { velocity: this.velocity.read });
    this.draw('vorticity', this.velocity.write, { velocity: this.velocity.read, curl: this.curl, dt }); this.swap(this.velocity);
    this.draw('divergence', this.divergence, { velocity: this.velocity.read });
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.pressure.read.buffer); this.gl.clearColor(0, 0, 0, 0); this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    for (let i = 0; i < 24; i++) { this.draw('pressure', this.pressure.write, { pressure: this.pressure.read, divergence: this.divergence }); this.swap(this.pressure); }
    this.draw('project', this.velocity.write, { velocity: this.velocity.read, pressure: this.pressure.read }); this.swap(this.velocity);
    this.draw('advect', this.dye.write, { velocity: this.velocity.read, source: this.dye.read, dt, decay: 1, isVelocity: false }); this.swap(this.dye);
    this.draw('particleStep', this.particles.write, { particleState: this.particles.read, velocity: this.velocity.read, dt }); this.swap(this.particles);
    this.render();
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
    for (const program of this.programs.values()) this.gl.deleteProgram(program.value);
    for (const target of this.targets) { this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.buffer); }
    this.gl.deleteVertexArray(this.vao);
  }
}
