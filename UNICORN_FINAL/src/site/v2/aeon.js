// UNICORN V2 — "Aeon" extensions: audio + bloom + passkey + xr + view-transitions + DNA
// © Vladoi Ionut — original work
(function(){
'use strict';
const THREE = window.THREE;
const $ = (s,r=document)=>r.querySelector(s);
const cfg = window.__UNICORN__ || {};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.__UNICORN_REDUCED__ = reduced;

// ================= Generative DNA (deterministic per visitor) =================
(function dna(){
  try {
    let seed = localStorage.getItem('u_seed');
    if (!seed) { seed = (Math.random().toString(36).slice(2,10) + Date.now().toString(36)); localStorage.setItem('u_seed', seed); }
    // hash to [0,1)^3 channel
    let h = 2166136261; for (let i=0;i<seed.length;i++){ h^=seed.charCodeAt(i); h=(h*16777619)>>>0; }
    const a = ((h    )&0xff)/255, b = ((h>>>8)&0xff)/255, c = ((h>>>16)&0xff)/255;
    window.__UNICORN_DNA__ = { seed, a, b, c,
      violet: `oklch(0.68 0.22 ${280+Math.round(a*40)})`,
      blue:   `oklch(0.75 0.17 ${230+Math.round(b*30)})`,
      gold:   `oklch(0.82 0.15 ${80+Math.round(c*20)})`
    };
    // Subtle: personalize accent
    const root = document.documentElement;
    if (CSS.supports('color', 'oklch(0.7 0.2 280)')) {
      root.style.setProperty('--violet', window.__UNICORN_DNA__.violet);
      root.style.setProperty('--blue',   window.__UNICORN_DNA__.blue);
    }
  } catch(_) {}
})();

// ================= Audio (disabled — silent by default) =================
const Audio = (() => {
  // Audio intentionally disabled: procedural sounds removed for a calmer UX.
  const noop = () => {};
  return { init: noop, tick: noop, thunder: noop, setMuted: noop, get muted(){ return true; } };
})();
window.__UNICORN_AUDIO__ = Audio;

// ================= Bloom post-processing (mini custom composer) =================
// We re-render the scene into an offscreen target, extract brights, blur, additively composite.
window.__UNICORN_POSTFX__ = {
  attach(renderer, scene, camera, host){
    if (!THREE) return null;
    const w = host.clientWidth, h = host.clientHeight;
    const rt  = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    const rtA = new THREE.WebGLRenderTarget(w>>1, h>>1, { type: THREE.HalfFloatType });
    const rtB = new THREE.WebGLRenderTarget(w>>1, h>>1, { type: THREE.HalfFloatType });
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const quadGeo = new THREE.PlaneGeometry(2,2);
    const brightMat = new THREE.ShaderMaterial({ uniforms:{ tDiffuse:{value:null}, threshold:{value:0.78} },
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv; uniform sampler2D tDiffuse; uniform float threshold;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); vec3 b = c * smoothstep(threshold, threshold+0.25, l); gl_FragColor = vec4(b, 1.0); }` });
    const blurMat = new THREE.ShaderMaterial({ uniforms:{ tDiffuse:{value:null}, dir:{value: new THREE.Vector2(1,0)}, res:{value: new THREE.Vector2(w>>1,h>>1)} },
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 res;
        void main(){ vec2 px = dir/res; vec3 c = vec3(0.0);
          c += texture2D(tDiffuse, vUv - px*4.0).rgb * 0.051;
          c += texture2D(tDiffuse, vUv - px*3.0).rgb * 0.0918;
          c += texture2D(tDiffuse, vUv - px*2.0).rgb * 0.1231;
          c += texture2D(tDiffuse, vUv - px    ).rgb * 0.1935;
          c += texture2D(tDiffuse, vUv         ).rgb * 0.227;
          c += texture2D(tDiffuse, vUv + px    ).rgb * 0.1935;
          c += texture2D(tDiffuse, vUv + px*2.0).rgb * 0.1231;
          c += texture2D(tDiffuse, vUv + px*3.0).rgb * 0.0918;
          c += texture2D(tDiffuse, vUv + px*4.0).rgb * 0.051;
          gl_FragColor = vec4(c, 1.0);
        }` });
    const finalMat = new THREE.ShaderMaterial({ uniforms:{ tBase:{value:null}, tBloom:{value:null}, u_time:{value:0}, u_ca:{value:0.0025} },
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0);}',
      fragmentShader:`varying vec2 vUv; uniform sampler2D tBase; uniform sampler2D tBloom; uniform float u_time; uniform float u_ca;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 o = (vUv - 0.5);
          float ca = u_ca * (0.5 + length(o));
          float r = texture2D(tBase, vUv + vec2(ca, 0.0)).r;
          float g = texture2D(tBase, vUv).g;
          float b = texture2D(tBase, vUv - vec2(ca, 0.0)).b;
          vec3 base = vec3(r,g,b);
          vec3 bloom = texture2D(tBloom, vUv).rgb * 1.05;
          // vignette
          float vign = smoothstep(1.1, 0.3, length(o)*1.3);
          // film grain
          float grain = (hash(vUv*vec2(1920.0,1080.0) + u_time*60.0) - 0.5) * 0.035;
          vec3 col = (base + bloom) * vign + grain;
          gl_FragColor = vec4(col, 1.0);
        }` });
    const quad = new THREE.Mesh(quadGeo, finalMat); quadScene.add(quad);

    function resize(W, H){
      rt.setSize(W, H); rtA.setSize(W>>1, H>>1); rtB.setSize(W>>1, H>>1);
      blurMat.uniforms.res.value.set(W>>1, H>>1);
    }
    function render(t){
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      // bright
      quad.material = brightMat; brightMat.uniforms.tDiffuse.value = rt.texture;
      renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
      // blur H
      quad.material = blurMat; blurMat.uniforms.tDiffuse.value = rtA.texture; blurMat.uniforms.dir.value.set(1,0);
      renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
      // blur V
      blurMat.uniforms.tDiffuse.value = rtB.texture; blurMat.uniforms.dir.value.set(0,1);
      renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
      // final
      quad.material = finalMat; finalMat.uniforms.tBase.value = rt.texture; finalMat.uniforms.tBloom.value = rtA.texture; finalMat.uniforms.u_time.value = t;
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    }
    function dispose(){
      rt.dispose(); rtA.dispose(); rtB.dispose();
      brightMat.dispose(); blurMat.dispose(); finalMat.dispose(); quadGeo.dispose();
    }
    return { render, resize, dispose };
  }
};

// ================= View Transitions API =================
(function vt(){
  const orig = history.pushState.bind(history);
  // Wrap app to enable smooth crossfade; respect reduced motion
  document.addEventListener('click', e => {
    if (reduced) return;
    const a = e.target.closest('a[data-link]');
    if (!a || !document.startViewTransition) return;
    // let the existing router handle fetching; just add a flag so it runs inside a transition
    window.__UNICORN_VT__ = true;
  }, true);
})();
// Hook (patched by client.js): if __UNICORN_VT__ is set, wrap swap in startViewTransition
window.__UNICORN_VT_WRAP__ = function(swap){
  if (window.__UNICORN_VT__ && document.startViewTransition && !reduced) {
    window.__UNICORN_VT__ = false;
    return document.startViewTransition(swap);
  }
  return swap();
};

// ================= WebXR entry =================
(async function xr(){
  if (!('xr' in navigator)) return;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false);
    if (!ok) return;
    const btn = document.createElement('button');
    btn.textContent = '🥽 Enter Zeus in VR';
    btn.className = 'btn btn-ghost';
    btn.style.cssText = 'position:fixed;left:22px;bottom:22px;z-index:50';
    btn.addEventListener('click', async () => {
      try {
        const s = await navigator.xr.requestSession('immersive-vr');
        s.addEventListener('end', () => btn.disabled = false);
        btn.disabled = true;
      } catch(_) {}
    });
    document.body.appendChild(btn);
  } catch(_) {}
})();

// ================= Passkey (WebAuthn) =================
window.__UNICORN_PASSKEY__ = {
  supported: !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create),
  async register(email, password){
    const authHeaders = {'Content-Type':'application/json'};
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('customerToken') || localStorage.getItem('authToken');
      if (token) authHeaders.Authorization = `Bearer ${token}`;
    } catch(_) {}
    const r = await fetch('/api/auth/passkey/challenge', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, mode:'register', password }) });
    const j = await r.json();
    if (!r.ok || !j.publicKey) return j;
    const pk = j.publicKey;
    pk.challenge = b64uToBuf(pk.challenge); pk.user.id = b64uToBuf(pk.user.id);
    // Decode excludeCredentials[].id from base64url to ArrayBuffer (else browser rejects when re-enrolling)
    (pk.excludeCredentials||[]).forEach(c => { if (typeof c.id === 'string') c.id = b64uToBuf(c.id); });
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: pk });
    } catch (err) {
      console.error('[passkey/register] navigator.credentials.create threw:', err.name, err.message);
      return { ok: false, error: 'navigator.credentials.create failed', message: err.name + ': ' + err.message };
    }
    if (!cred) {
      console.error('[passkey/register] navigator.credentials.create returned null (user cancelled?)');
      return { ok: false, error: 'Credential creation failed', message: 'user_cancelled_or_null' };
    }
    const att = {
      id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
      response: {
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        attestationObject: bufToB64u(cred.response.attestationObject)
      }
    };
    const v = await fetch('/api/auth/passkey/register', { method:'POST', credentials:'same-origin', headers:authHeaders, body: JSON.stringify({ email, password, credential: att }) });
    return v.json();
  },
  async login(email){
    const r = await fetch('/api/auth/passkey/challenge', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, mode:'assert' }) });
    const j = await r.json();
    if (!r.ok || !j.publicKey) return j;
    const pk = j.publicKey;
    pk.challenge = b64uToBuf(pk.challenge);
    (pk.allowCredentials||[]).forEach(c => c.id = b64uToBuf(c.id));
    let cred;
    try {
      cred = await navigator.credentials.get({ publicKey: pk });
    } catch (err) {
      console.error('[passkey/login] navigator.credentials.get threw:', err.name, err.message);
      return { ok: false, error: 'navigator.credentials.get failed', message: err.name + ': ' + err.message };
    }
    if (!cred) {
      console.error('[passkey/login] navigator.credentials.get returned null (user cancelled?)');
      return { ok: false, error: 'Credential retrieval failed', message: 'user_cancelled_or_null' };
    }
    const att = {
      id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
      response: {
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        authenticatorData: bufToB64u(cred.response.authenticatorData),
        signature: bufToB64u(cred.response.signature),
        userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : null
      }
    };
    const v = await fetch('/api/auth/passkey/assert', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, credential: att }) });
    return v.json();
  }
};
function b64uToBuf(s){
  s = String(s||'').replace(/-/g,'+').replace(/_/g,'/'); s += '='.repeat((4 - s.length%4)%4);
  const bin = atob(s); const a = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a.buffer;
}
function bufToB64u(b){
  const a = new Uint8Array(b); let s=''; for (let i=0;i<a.length;i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

// ================= Service Worker strategy =================
// Important: avoid stale UI/cache mismatches in production by unregistering old SWs.
// This keeps navigation and checkout behavior deterministic.
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if (window.caches && typeof window.caches.keys === 'function') {
      window.caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => String(k).startsWith('unicorn-v2-')).map((k) => window.caches.delete(k))))
        .catch(() => {});
    }
  });
}

// ================= Reduced motion class =================
if (reduced) document.documentElement.classList.add('reduced-motion');
})();
