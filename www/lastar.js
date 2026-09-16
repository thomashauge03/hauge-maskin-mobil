/* ══════════════════════════════════════════════════════════════════════
   ÅPNINGSSEKVENSEN

   H-en står alene i mørket. Den lener seg bakover – den vet hva som
   kommer. M-en braker inn fra høyre, strukket av farten, og treffer.
   Støvet spruter, kameraet rister, begge bokstavene svinger ut slaget,
   og logoen faller på plass mens et rødt lys sveiper over den.

   Det som gjør det til en animasjonsfilm og ikke en logo som snurrer,
   er de klassiske prinsippene, og de er alle her:

     Forberedelse   H-en lener seg BAKOVER før støtet. Publikum skjønner
                    at noe skal skje før det skjer.
     Squash/stretch M-en er strukket langs fartsretningen mens hun flyr,
                    og klemt flat i det hun treffer. Volumet holdes –
                    blir hun 22 % lavere, blir hun 22 % bredere.
     Etterslep      Innsiden av bokstavene henger 55 ms etter ytterkanten.
                    Det er derfor de kjennes laget av noe, ikke tegnet.
     Overskyting    Ingenting stopper på målet. Alt går forbi og svinger
                    tilbake, med fjærer som dør ut i ulik takt.
     Sekundær       H-en svinger etter støtet med sin egen rytme, ute av
                    fase med M-en. To gjenstander, ikke én.
     Iscenesetting  Kontaktskygge på gulvet, så de har vekt. Den blir
                    bred og flat i slaget.

   Hvorfor ikke three.js: biblioteket er ~730 KB. Å legge det på den
   kritiske veien inn i appen ville gjort åpningsbildet til det tregeste
   i hele appen. Modellen er 684 trekanter, tre flate materialer, ingen
   teksturer. Dette er en renderer som gjør nøyaktig det, og ikke mer.

   Sekvensen dekker EKTE ventetid: innloggingssjekken og henting av
   sidelista går mens den spilles. Blir arbeidet ferdig først, venter vi
   ut filmen; blir filmen ferdig først, holder vi på siste bilde.

   Uten WebGL, uten fila, eller med redusert bevegelse slått på: flat
   logo. Ingenting her får stoppe noen fra å komme inn i appen.
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Løst mot skriptets egen adresse, ikke mot sida. Ellers brekker
     modellen i det noen legger en side i en undermappe. */
  var BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/[^/]*$/, '') : '';
  })();
  /* HM_LASTAR_GLB lar modellen peke et annet sted – en annen logo, eller
     en data-URI der binære filer ikke kan serveres. */
  var GLB = window.HM_LASTAR_GLB || (BASE + 'assets/hm-logo.glb');
  var FLAT = window.HM_LASTAR_FLAT || (BASE + 'assets/logo-trim.png');

  /* Slagplanen, i millisekund. */
  var T = {
    aleine:  0,      // H-en alene i mørket
    anslag:  260,    // hun lener seg bakover
    kast:    620,    // M-en slippes løs
    slag:    1010,   // treffet
    sving:   1080,   // kameraet svinger fram
    ro:      1900,   // front mot logoen
    hald:    2260    // ferdig – herfra holder vi til arbeidet er gjort
  };

  var LAG_ANSIKT = 55;   // innsiden henger etter ytterkanten

  /* ────────────────────────────────────────────────────────────────
     Matrisemat. Kolonnemajor, som OpenGL vil ha det.
     ──────────────────────────────────────────────────────────────── */

  function m4() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }

  function mul(ut, a, b) {
    for (var c = 0; c < 4; c++) {
      var b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
      ut[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      ut[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      ut[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      ut[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return ut;
  }

  function fraTRS(t, r, s) {
    var x = r[0], y = r[1], z = r[2], w = r[3];
    var x2 = x+x, y2 = y+y, z2 = z+z;
    var xx = x*x2, xy = x*y2, xz = x*z2;
    var yy = y*y2, yz = y*z2, zz = z*z2;
    var wx = w*x2, wy = w*y2, wz = w*z2;
    var m = m4();
    m[0]  = (1-(yy+zz))*s[0]; m[1]  = (xy+wz)*s[0];     m[2]  = (xz-wy)*s[0];
    m[4]  = (xy-wz)*s[1];     m[5]  = (1-(xx+zz))*s[1]; m[6]  = (yz+wx)*s[1];
    m[8]  = (xz+wy)*s[2];     m[9]  = (yz-wx)*s[2];     m[10] = (1-(xx+yy))*s[2];
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
    return m;
  }

  /* Flytt–roter–skaler rundt et eget senter. Det er dette squash og
     stretch trenger: klemmer du uten å si hvor midten er, glir
     gjenstanden i stedet for å bli klemt. */
  function omSenter(sx, sy, sz, rz, tx, ty, senter) {
    var c = Math.cos(rz), s = Math.sin(rz);
    var m = m4();
    m[0] = c*sx;  m[1] = s*sx;
    m[4] = -s*sy; m[5] = c*sy;
    m[10] = sz;
    m[12] = senter[0] + tx - (c*sx*senter[0] - s*sy*senter[1]);
    m[13] = senter[1] + ty - (s*sx*senter[0] + c*sy*senter[1]);
    m[14] = senter[2] - sz*senter[2];
    return m;
  }

  function perspektiv(fovy, sv, naer, fjern) {
    var f = 1 / Math.tan(fovy / 2), m = m4();
    m[0] = f / sv; m[5] = f; m[10] = (fjern+naer)/(naer-fjern);
    m[11] = -1; m[14] = 2*fjern*naer/(naer-fjern); m[15] = 0;
    return m;
  }

  function sePaa(oye, maal, opp) {
    var zx = oye[0]-maal[0], zy = oye[1]-maal[1], zz = oye[2]-maal[2];
    var zl = Math.hypot(zx, zy, zz) || 1; zx/=zl; zy/=zl; zz/=zl;
    var xx = opp[1]*zz - opp[2]*zy, xy = opp[2]*zx - opp[0]*zz, xz = opp[0]*zy - opp[1]*zx;
    var xl = Math.hypot(xx, xy, xz) || 1; xx/=xl; xy/=xl; xz/=xl;
    var yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
    var m = m4();
    m[0]=xx; m[1]=yx; m[2]=zx; m[4]=xy; m[5]=yy; m[6]=zy;
    m[8]=xz; m[9]=yz; m[10]=zz;
    m[12] = -(xx*oye[0] + xy*oye[1] + xz*oye[2]);
    m[13] = -(yx*oye[0] + yy*oye[1] + yz*oye[2]);
    m[14] = -(zx*oye[0] + zy*oye[1] + zz*oye[2]);
    return m;
  }

  function normalMat(m) {
    var a00=m[0],a01=m[1],a02=m[2], a10=m[4],a11=m[5],a12=m[6], a20=m[8],a21=m[9],a22=m[10];
    var b01= a22*a11 - a12*a21, b11=-a22*a10 + a12*a20, b21= a21*a10 - a11*a20;
    var det = a00*b01 + a01*b11 + a02*b21;
    var o = new Float32Array(9);
    if (!det) { o[0]=o[4]=o[8]=1; return o; }
    det = 1/det;
    o[0]=b01*det; o[1]=(-a22*a01 + a02*a21)*det; o[2]=( a12*a01 - a02*a11)*det;
    o[3]=b11*det; o[4]=( a22*a00 - a02*a20)*det; o[5]=(-a12*a00 + a02*a10)*det;
    o[6]=b21*det; o[7]=(-a21*a00 + a01*a20)*det; o[8]=( a11*a00 - a01*a10)*det;
    return o;
  }

  /* ────────────────────────────────────────────────────────────────
     Kurvene. Animasjon er nesten bare dette.
     ──────────────────────────────────────────────────────────────── */
  var E = {
    ut:  function (t) { return 1 - Math.pow(1 - t, 3); },
    utQ: function (t) { return 1 - Math.pow(1 - t, 5); },
    inn: function (t) { return t * t * t; },
    myk: function (t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; },
    /* Fjær som dør ut. demp styrer hvor lenge den svinger, frek hvor fort. */
    fjaer: function (t, demp, frek) {
      if (t >= 1) return 1;
      if (t <= 0) return 0;
      return 1 - Math.pow(2, -(demp || 9) * t) * Math.cos(t * (frek || 13.5));
    }
  };
  function spenn(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function bland(a, b, t) { return a + (b - a) * t; }

  /* ────────────────────────────────────────────────────────────────
     GLB-lesing. Bevisst smal: denne fila har ingen utvidelser, ingen
     teksturer, ingen animasjon og ikke-indeksert geometri.
     ──────────────────────────────────────────────────────────────── */

  function lesGlb(buf) {
    var dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('ikke glb');
    var off = 12, json = null, bin = null;
    while (off + 8 <= dv.byteLength) {
      var len = dv.getUint32(off, true), typ = dv.getUint32(off + 4, true);
      if (typ === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (typ === 0x004E4942) bin = { start: off + 8, len: len };
      off += 8 + len;
      if (len % 4) off += 4 - (len % 4);
    }
    if (!json || !bin) throw new Error('mangler chunk');

    function les(iAcc) {
      var a = json.accessors[iAcc];
      var bv = json.bufferViews[a.bufferView];
      var tal = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }[a.type];
      var start = bin.start + (bv.byteOffset || 0) + (a.byteOffset || 0);
      var stride = bv.byteStride || 0;
      if (a.componentType !== 5126) throw new Error('ventet float');
      if (!stride || stride === tal * 4) return new Float32Array(buf.slice(start, start + a.count * tal * 4));
      var ut = new Float32Array(a.count * tal), d = new DataView(buf);
      for (var i = 0; i < a.count; i++)
        for (var k = 0; k < tal; k++) ut[i*tal+k] = d.getFloat32(start + i*stride + k*4, true);
      return ut;
    }

    var deler = [];
    function gaa(iNode, foreldre, bokstav) {
      var n = json.nodes[iNode];
      var lokal = n.matrix ? new Float32Array(n.matrix)
                           : fraTRS(n.translation || [0,0,0], n.rotation || [0,0,0,1], n.scale || [1,1,1]);
      var verd = mul(m4(), foreldre, lokal);
      var min = bokstav;
      if (!min && (n.name === 'H' || n.name === 'M')) min = n.name;

      if (n.mesh != null) {
        var me = json.meshes[n.mesh];
        for (var p = 0; p < me.primitives.length; p++) {
          var pr = me.primitives[p];
          var mat = json.materials[pr.material] || {};
          var pbr = mat.pbrMetallicRoughness || {};
          var f = pbr.baseColorFactor || [1,1,1,1];
          deler.push({
            bokstav: min || 'H',
            /* Innsiden ("face") henger etter ytterkanten. Det er hele
               overlappende handling, og modellen har dem som egne noder. */
            etterslep: /face/i.test(n.name || '') ? LAG_ANSIKT : 0,
            verd: verd,
            pos: les(pr.attributes.POSITION),
            nrm: pr.attributes.NORMAL != null ? les(pr.attributes.NORMAL) : null,
            tal: json.accessors[pr.attributes.POSITION].count,
            farge: [f[0], f[1], f[2]],
            metall: pbr.metallicFactor == null ? 1 : pbr.metallicFactor,
            ru: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor
          });
        }
      }
      (n.children || []).forEach(function (c) { gaa(c, verd, min); });
    }
    json.scenes[json.scene || 0].nodes.forEach(function (i) { gaa(i, m4(), null); });

    /* Verdensgrenser, per bokstav og totalt. */
    var alt = { lo: [1e9,1e9,1e9], hi: [-1e9,-1e9,-1e9] };
    var per = { H: { lo: [1e9,1e9,1e9], hi: [-1e9,-1e9,-1e9] },
                M: { lo: [1e9,1e9,1e9], hi: [-1e9,-1e9,-1e9] } };
    deler.forEach(function (d) {
      var b = per[d.bokstav] || alt;
      for (var i = 0; i < d.tal; i++) {
        var x = d.pos[i*3], y = d.pos[i*3+1], z = d.pos[i*3+2];
        var w = [
          d.verd[0]*x + d.verd[4]*y + d.verd[8]*z  + d.verd[12],
          d.verd[1]*x + d.verd[5]*y + d.verd[9]*z  + d.verd[13],
          d.verd[2]*x + d.verd[6]*y + d.verd[10]*z + d.verd[14]
        ];
        for (var k = 0; k < 3; k++) {
          if (w[k] < b.lo[k]) b.lo[k] = w[k];
          if (w[k] > b.hi[k]) b.hi[k] = w[k];
          if (w[k] < alt.lo[k]) alt.lo[k] = w[k];
          if (w[k] > alt.hi[k]) alt.hi[k] = w[k];
        }
      }
    });

    var senter = [(alt.lo[0]+alt.hi[0])/2, (alt.lo[1]+alt.hi[1])/2, (alt.lo[2]+alt.hi[2])/2];
    var skala = 2 / Math.max(alt.hi[0]-alt.lo[0], alt.hi[1]-alt.lo[1], 0.001);

    /* Bokstavsentrene, i det sentrerte og skalerte rommet. Squash
       rundt feil punkt ser ut som en gli, ikke som et trykk. */
    var bokstavSenter = {};
    ['H','M'].forEach(function (k) {
      var b = per[k];
      if (b.lo[0] > 1e8) { bokstavSenter[k] = [0,0,0]; return; }
      bokstavSenter[k] = [
        ((b.lo[0]+b.hi[0])/2 - senter[0]) * skala,
        ((b.lo[1]+b.hi[1])/2 - senter[1]) * skala,
        ((b.lo[2]+b.hi[2])/2 - senter[2]) * skala
      ];
    });
    var golv = (alt.lo[1] - senter[1]) * skala - 0.16;

    return { deler: deler, senter: senter, skala: skala,
             bokstavSenter: bokstavSenter, golv: golv };
  }

  /* ────────────────────────────────────────────────────────────────
     Skyggeleggerne
     ──────────────────────────────────────────────────────────────── */

  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm;',
    'uniform mat4 uMVP; uniform mat4 uModell; uniform mat3 uNrm;',
    'varying vec3 vVerd; varying vec3 vN;',
    'void main(){',
    '  vVerd = (uModell * vec4(aPos,1.0)).xyz;',
    '  vN = normalize(uNrm * aNrm);',
    '  gl_Position = uMVP * vec4(aPos,1.0);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vVerd; varying vec3 vN;',
    'uniform vec3 uFarge, uKam, uLys;',
    'uniform float uMetall, uRu, uAlfa, uSveip, uGlod;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(uKam - vVerd);',
    '  vec3 L = normalize(uLys);',
    /* Halv-lambert: mykere fall, og holder de svarte kantene fra å
       forsvinne rett ut i den svarte bakgrunnen. */
    '  float d = dot(N,L)*0.5+0.5; d = d*d;',
    '  vec3 H = normalize(L+V);',
    '  float sk = pow(max(dot(N,H),0.0), mix(12.0, 96.0, 1.0-uRu)) * mix(0.25, 1.1, uMetall);',
    '  float f = pow(1.0 - max(dot(N,V),0.0), 3.0);',
    '  float s = exp(-pow((vVerd.x - uSveip)*2.6, 2.0));',
    '  vec3 c = uFarge * (0.10 + 0.95*d);',
    '  c += vec3(1.0,0.96,0.94) * sk * 0.6;',
    '  c += vec3(0.886,0.0,0.10) * f * (0.55 + uGlod);',
    '  c += vec3(1.0,0.72,0.74) * s * (0.30 + 0.9*sk);',
    '  gl_FragColor = vec4(pow(max(c,0.0), vec3(0.4545)), 1.0) * uAlfa;',
    '}'
  ].join('\n');

  /* Kontaktskygge: ett kvad på gulvet, mørkere mot midten. Uten den
     svever bokstavene, og da har de ingen vekt. */
  var SKYGGE_VS = [
    'attribute vec2 aXY; uniform mat4 uMVP; uniform vec3 uMidt;',
    'uniform vec2 uStorleik; varying vec2 vXY;',
    'void main(){ vXY = aXY;',
    '  gl_Position = uMVP * vec4(uMidt.x + aXY.x*uStorleik.x, uMidt.y, uMidt.z + aXY.y*uStorleik.y, 1.0); }'
  ].join('\n');

  var SKYGGE_FS = [
    'precision mediump float; varying vec2 vXY; uniform float uStyrke;',
    'void main(){',
    '  float r = length(vXY);',
    '  float a = smoothstep(1.0, 0.0, r); a *= a;',
    '  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uStyrke);',
    '}'
  ].join('\n');

  /* Støvet i slaget. gl.POINTS, additiv – billig og leser som gnister. */
  var STOEV_VS = [
    'attribute vec3 aStart; attribute vec3 aFart; attribute float aFroe;',
    'uniform mat4 uMVP; uniform float uT; uniform float uPx;',
    'varying float vLiv;',
    'void main(){',
    '  float liv = clamp(uT / (0.55 + aFroe*0.5), 0.0, 1.0);',
    '  vLiv = 1.0 - liv;',
    '  vec3 p = aStart + aFart * uT;',
    '  p.y -= 2.4 * uT * uT;',                 // tyngdekraft
    '  gl_Position = uMVP * vec4(p, 1.0);',
    '  gl_PointSize = uPx * (0.35 + vLiv*1.5) / max(gl_Position.w, 0.2);',
    '}'
  ].join('\n');

  var STOEV_FS = [
    'precision mediump float; varying float vLiv;',
    'void main(){',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float a = smoothstep(0.5, 0.0, length(d)) * vLiv;',
    '  gl_FragColor = vec4(mix(vec3(0.95,0.25,0.22), vec3(1.0,0.92,0.86), vLiv), 1.0) * a;',
    '}'
  ].join('\n');

  /* ════════════════════════════════════════════════════════════════ */

  function Lastar(vert) {
    this.vert = vert; this.rot = null; this.gl = null; this.modell = null;
    this.t0 = 0; this.framgang = 0; this.visFramgang = 0;
    this.ferdigKall = []; this.arbeidFerdig = false; this.avslutta = false;
    this.ramme = null; this.hoppa = false; this.gaar = false;
  }

  Lastar.prototype.bygg = function () {
    var d = document.createElement('div');
    d.className = 'lastar';
    d.innerHTML =
      '<canvas class="lastar-lerret"></canvas>' +
      '<div class="lastar-blink"></div>' +
      '<div class="lastar-vignett"></div>' +
      '<div class="lastar-flat" hidden><img src="' + FLAT + '" alt="Hauge Maskin"></div>' +
      '<div class="lastar-tekst">' +
        '<div class="lastar-merke"><b>HAUGE</b><span>MASKIN</span></div>' +
        '<div class="lastar-skinne"><i></i></div>' +
        '<div class="lastar-steg">Kobler til…</div>' +
      '</div>';
    this.rot = d;
    this.lerret = d.querySelector('.lastar-lerret');
    this.skinne = d.querySelector('.lastar-skinne i');
    this.steg   = d.querySelector('.lastar-steg');
    this.flat   = d.querySelector('.lastar-flat');
    this.blink  = d.querySelector('.lastar-blink');
    this.vert.appendChild(d);

    /* Har du sett filmen femti ganger i dag, skal du slippe. */
    var meg = this;
    d.addEventListener('pointerdown', function () {
      if (meg.gaar && !meg.hoppa) { meg.hoppa = true; meg.t0 -= T.hald; }
    });
    return this;
  };

  Lastar.prototype.flatFallback = function (grunn) {
    this.flatModus = true;
    this.rot.classList.add('lastar-enkel', 'lastar-tekst-inne');
    this.flat.hidden = false;
    if (this.lerret) this.lerret.hidden = true;
    if (window.console && grunn) console.warn('[lastar] flat visning:', grunn);
  };

  Lastar.prototype.start = function () {
    var meg = this;
    this.t0 = performance.now();
    this.gaar = true;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.flatFallback('redusert bevegelse'); return this;
    }
    var gl = null;
    try {
      gl = this.lerret.getContext('webgl', { alpha: false, antialias: true, depth: true,
                                             powerPreference: 'low-power' });
    } catch (e) { /* under */ }
    if (!gl) { this.flatFallback('ingen webgl'); return this; }
    this.gl = gl;

    fetch(GLB)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then(function (b) {
        meg.modell = lesGlb(b);
        meg.klargjer();
        /* Klokka starter når det faktisk er noe å se. Ellers spiller
           de første bildene mot en tom skjerm. */
        meg.t0 = performance.now();
        meg.ramme = requestAnimationFrame(function (t) { meg.teikn(t); });
      })
      .catch(function (e) { meg.flatFallback(e.message); });

    return this;
  };

  Lastar.prototype.program = function (vs, fs, attr, unif) {
    var gl = this.gl;
    function del(typ, kjelde) {
      var s = gl.createShader(typ);
      gl.shaderSource(s, kjelde); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, del(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, del(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var o = { p: p, a: {}, u: {} };
    attr.forEach(function (n) { o.a[n] = gl.getAttribLocation(p, n); });
    unif.forEach(function (n) { o.u[n] = gl.getUniformLocation(p, n); });
    return o;
  };

  Lastar.prototype.klargjer = function () {
    var gl = this.gl;

    this.pLogo = this.program(VS, FS, ['aPos','aNrm'],
      ['uMVP','uModell','uNrm','uFarge','uKam','uLys','uMetall','uRu','uAlfa','uSveip','uGlod']);
    this.pSkygge = this.program(SKYGGE_VS, SKYGGE_FS, ['aXY'],
      ['uMVP','uMidt','uStorleik','uStyrke']);
    this.pStoev = this.program(STOEV_VS, STOEV_FS, ['aStart','aFart','aFroe'],
      ['uMVP','uT','uPx']);

    this.modell.deler.forEach(function (d) {
      d.bPos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, d.bPos);
      gl.bufferData(gl.ARRAY_BUFFER, d.pos, gl.STATIC_DRAW);
      if (d.nrm) {
        d.bNrm = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, d.bNrm);
        gl.bufferData(gl.ARRAY_BUFFER, d.nrm, gl.STATIC_DRAW);
      }
      d.pos = null; d.nrm = null;   // ute av JS-minnet, de ligger på kortet nå
    });

    /* Skyggekvadet */
    this.bKvad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bKvad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    /* Støvet. Fast antall, fast bane – regnet i skyggeleggeren, så det
       koster ingenting per bilde på CPU-en. */
    var N = 90, start = new Float32Array(N*3), fart = new Float32Array(N*3), froe = new Float32Array(N);
    var kontakt = this.modell.bokstavSenter.M;
    for (var i = 0; i < N; i++) {
      /* Deterministisk spredning – ingen Math.random, så sekvensen er
         den samme hver gang og kan finjusteres. */
      var a = (i * 2.39996), r = 0.28 + (i % 7) * 0.05;
      var opp = 0.35 + ((i * 37) % 100) / 100 * 1.5;
      start[i*3]   = kontakt[0] - 0.55 + Math.cos(a) * 0.07;
      start[i*3+1] = kontakt[1] + Math.sin(a) * 0.30;
      start[i*3+2] = Math.cos(a * 1.7) * 0.10;
      fart[i*3]    = -Math.abs(Math.cos(a)) * r * 2.6 - 0.25;
      fart[i*3+1]  = Math.sin(a) * r * 2.2 + opp * 0.55;
      fart[i*3+2]  = Math.sin(a * 2.3) * r * 1.6;
      froe[i] = ((i * 53) % 100) / 100;
    }
    this.stoevN = N;
    this.bStart = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bStart); gl.bufferData(gl.ARRAY_BUFFER, start, gl.STATIC_DRAW);
    this.bFart  = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bFart);  gl.bufferData(gl.ARRAY_BUFFER, fart,  gl.STATIC_DRAW);
    this.bFroe  = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bFroe);  gl.bufferData(gl.ARRAY_BUFFER, froe,  gl.STATIC_DRAW);

    gl.clearColor(0.039, 0.039, 0.047, 1);
    this.maal();
  };

  /* Målingen leser vinduet, ALDRI et element som inneholder lerretet.
     Gjorde den det, ville et lerret uten CSS-størrelse la sitt eget
     bredde/høyde-attributt styre layouten, som målingen så leste, som
     satte attributtet større – og buffere på titalls millioner piksler
     er ikke en skjønnhetsfeil, det er en telefon som ryker. Stilene
     settes derfor også her, så de gjelder om stilarket skulle utebli. */
  Lastar.prototype.maal = function () {
    var s = this.lerret.style;
    if (s.position !== 'absolute') {
      s.position = 'absolute'; s.left = '0'; s.top = '0';
      s.width = '100%'; s.height = '100%'; s.display = 'block';
    }
    /* DPR-tak på 2: på en telefon med DPR 3 er det 2,25 ganger så mange
       piksler å fylle, og forskjellen er ikke synlig uten teksturer. */
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.br = Math.max(1, Math.min(window.innerWidth  || 360, 4096));
    this.hg = Math.max(1, Math.min(window.innerHeight || 640, 4096));
    this.lerret.width  = Math.round(this.br * dpr);
    this.lerret.height = Math.round(this.hg * dpr);
    this.gl.viewport(0, 0, this.lerret.width, this.lerret.height);
  };

  /* Avstanden der modellen fyller `fyll` av bildebredden.
     En fast avstand fungerer bare for ett bildeformat. På en høy, smal
     telefon er BREDDEN det trange målet, og en logo som er 2 enheter bred
     blir da stående utenfor rammen uten at noen ser hvorfor. */
  Lastar.prototype.avstand = function (fov, fyll) {
    var sv = this.lerret.width / this.lerret.height;
    var halv = Math.tan(fov * Math.PI / 360);
    var breidd = 2.0;                    /* modellen er normalisert til dette */
    var etterBreidd = breidd / (fyll * 2 * halv * Math.max(sv, 0.05));
    var etterHoegd  = 1.35 / (fyll * 2 * halv);
    return Math.max(etterBreidd, etterHoegd);
  };

  /* ── Kameraet ─────────────────────────────────────────────────── */
  Lastar.prototype.kamera = function (t) {
    var oye, maal = [0, 0, 0], fov;
    var hSenter = this.modell.bokstavSenter.H;

    if (t < T.sving) {
      /* Nært på kanten av H-en – men ikke nærmere enn at hun leses som en
         form mot svart. Kameraet står til side, så vi ser ekstruderingen
         i kant, ikke den hvite flaten rett på. */
      var e = E.myk(spenn(t, 0, T.sving));
      fov = bland(21, 25, e);
      var dn = this.avstand(fov, bland(1.75, 1.32, e));
      var vn = bland(-1.16, -0.86, e);
      oye  = [hSenter[0] + Math.sin(vn) * dn, bland(-0.30, -0.10, e), Math.cos(vn) * dn];
      maal = [bland(hSenter[0] + 0.10, hSenter[0] + 0.26, e), bland(-0.05, 0, e), 0];
    } else if (t < T.ro) {
      /* Svingen fram. Lang utrulling – det er her det ser dyrt ut. */
      var u = E.utQ(spenn(t, T.sving, T.ro));
      fov = bland(25, 28, u);
      var vink = bland(-0.86, 0, u);
      var dist = bland(this.avstand(fov, 1.32), this.avstand(fov, 0.60), u);
      oye  = [bland(hSenter[0], 0, u) + Math.sin(vink) * dist,
              bland(-0.10, 0.09, u),
              Math.cos(vink) * dist];
      maal = [bland(hSenter[0] + 0.26, 0, u), 0, 0];
    } else {
      /* Hvile. Et nesten umerkelig driv, så bildet ikke fryser. */
      var s = (t - T.ro) / 1000;
      var driv = Math.sin(s * 0.62) * 0.05;
      fov = 28;
      var dr = this.avstand(fov, 0.60);
      oye = [Math.sin(driv) * dr, 0.09 + Math.sin(s * 0.47) * 0.025, Math.cos(driv) * dr];
    }

    /* Rist i slaget. Tre–fire bilder. Mer leses som en feil. */
    var r = spenn(t, T.slag, T.slag + 210);
    if (r > 0 && r < 1) {
      var k = (1 - r) * (1 - r) * 0.08;
      oye[0] += Math.sin(t * 0.09) * k;
      oye[1] += Math.cos(t * 0.115) * k;
    }
    return { oye: oye, maal: maal, fov: fov };
  };

  /* ── Bokstavene. Her ligger animasjonen. ──────────────────────── */
  Lastar.prototype.bokstav = function (navn, t) {
    var tx = 0, ty = 0, rz = 0, sx = 1, sy = 1, alfa = 1;

    if (navn === 'M') {
      var inn = spenn(t, T.kast, T.slag);
      if (inn <= 0) return { alfa: 0 };
      if (inn < 1) {
        /* Innkjøringen. Strukket langs farten – volumet holdes, så den
           blir like mye smalere i høyden som den blir lengre. */
        var fart = E.inn(1 - inn);
        tx = bland(4.2, 0, E.utQ(inn) * 0.35 + inn * 0.65);
        sx = 1 + fart * 0.42;
        sy = 1 / (1 + fart * 0.42);
        rz = -fart * 0.10;
        alfa = Math.min(1, inn * 6);
      } else {
        /* Treffet, og utsvingen. To fjærer i ulik takt: posisjonen
           lander fort, formen bruker lengre tid på å slippe. */
        var e = spenn(t, T.slag, T.slag + 700);
        var k = spenn(t, T.slag, T.slag + 480);
        tx = (1 - E.fjaer(e, 7.5, 15.0)) * -0.30;
        var klem = (1 - E.fjaer(k, 6.0, 17.0)) * 0.26;
        sx = 1 - klem; sy = 1 + klem * 0.92;
        rz = (1 - E.fjaer(e, 8.0, 12.0)) * 0.05;
      }
    } else {
      /* H-en. Først forberedelsen: hun lener seg BAKOVER før støtet. */
      var opp = spenn(t, T.aleine, T.anslag + 240);
      alfa = E.ut(spenn(t, 0, 340));
      var ant = spenn(t, T.anslag, T.slag);
      rz = -E.myk(ant) * 0.075;
      tx = -E.myk(ant) * 0.05;

      if (t >= T.slag) {
        /* Sekundærbevegelsen: hun tar imot og svinger ut på egen rytme,
           ute av fase med M-en. To gjenstander, ikke én. */
        var h = spenn(t, T.slag, T.slag + 820);
        rz = bland(-0.075, 0, E.fjaer(h, 5.5, 11.0));
        tx = bland(-0.05, 0, E.fjaer(h, 5.0, 9.5)) + (1 - E.fjaer(h, 7.0, 14.0)) * -0.16;
        var kh = spenn(t, T.slag, T.slag + 520);
        var kl = (1 - E.fjaer(kh, 6.5, 13.0)) * 0.14;
        sx = 1 + kl * 0.7; sy = 1 - kl;
      }
      if (opp < 1) { /* holder alfa-rampen */ }
    }

    /* Pustet mens vi venter. Uten det fryser bildet, og et frosset
       bilde leser som at appen har hengt seg. */
    if (t > T.ro) {
      var p = Math.sin((t - T.ro) / 1000 * 1.15 + (navn === 'M' ? 1.1 : 0)) * 0.009;
      sx += p; sy += p;
    }
    return { tx: tx, ty: ty, rz: rz, sx: sx, sy: sy, alfa: alfa };
  };

  Lastar.prototype.teikn = function (naa) {
    if (this.avslutta) return;
    var meg = this, gl = this.gl, t = naa - this.t0;

    if (window.innerWidth !== this.br || window.innerHeight !== this.hg) this.maal();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var kam = this.kamera(t);
    var proj = perspektiv(kam.fov * Math.PI / 180, this.lerret.width / this.lerret.height, 0.1, 40);
    var vp = mul(m4(), proj, sePaa(kam.oye, kam.maal, [0, 1, 0]));

    /* Nøkkellyset svinger med. Et lys som står stille gir flater som
       aldri forandrer seg, og det ser billig ut. */
    var lysV = bland(-1.1, 0.55, E.myk(spenn(t, T.anslag, T.ro)));
    var lys = [Math.sin(lysV) * 2.2, 1.35, 1.9];

    var sv = spenn(t, T.sving + 200, T.ro + 320);
    var sveip = bland(-2.4, 2.4, E.myk(sv));
    if (t > T.hald) sveip = bland(-2.4, 2.4, ((t - T.hald) % 3400) / 3400);
    var glod = (1 - spenn(t, T.slag, T.slag + 440)) * 1.5;

    var sentrer = m4();
    sentrer[0] = sentrer[5] = sentrer[10] = this.modell.skala;
    sentrer[12] = -this.modell.senter[0] * this.modell.skala;
    sentrer[13] = -this.modell.senter[1] * this.modell.skala;
    sentrer[14] = -this.modell.senter[2] * this.modell.skala;

    /* ── Skyggen først, under alt ── */
    var slagN = spenn(t, T.slag, T.slag + 460);
    gl.useProgram(this.pSkygge.p);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bKvad);
    gl.enableVertexAttribArray(this.pSkygge.a.aXY);
    gl.vertexAttribPointer(this.pSkygge.a.aXY, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.pSkygge.u.uMVP, false, vp);
    ['H','M'].forEach(function (k) {
      var b = meg.bokstav(k, t);
      if (!b || b.alfa <= 0.01) return;
      var c = meg.modell.bokstavSenter[k];
      /* Skyggen blir bred og flat i slaget – det er der vekta ligger. */
      var spreie = 1 + (slagN > 0 && slagN < 1 ? Math.sin(slagN * Math.PI) * 0.55 : 0);
      gl.uniform3fv(meg.pSkygge.u.uMidt, [c[0] + (b.tx || 0), meg.modell.golv, c[2]]);
      gl.uniform2fv(meg.pSkygge.u.uStorleik, [0.62 * spreie, 0.30 * spreie]);
      gl.uniform1f(meg.pSkygge.u.uStyrke, 0.55 * b.alfa / spreie);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });

    /* ── Logoen ── */
    gl.useProgram(this.pLogo.p);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    var u = this.pLogo.u;
    gl.uniform3fv(u.uKam, kam.oye);
    gl.uniform3fv(u.uLys, lys);
    gl.uniform1f(u.uSveip, sveip);
    gl.uniform1f(u.uGlod, glod);

    var deler = this.modell.deler;
    for (var i = 0; i < deler.length; i++) {
      var d = deler[i];
      /* Etterslepet: innsiden leses på et tidligere tidspunkt enn
         ytterkanten. Det er hele overlappende handling. */
      var b = this.bokstav(d.bokstav, t - d.etterslep);
      if (!b || b.alfa <= 0.004) continue;

      var anim = omSenter(b.sx, b.sy, 1, b.rz, b.tx, b.ty, this.modell.bokstavSenter[d.bokstav]);
      var modell = mul(m4(), anim, mul(m4(), sentrer, d.verd));

      gl.uniformMatrix4fv(u.uMVP, false, mul(m4(), vp, modell));
      gl.uniformMatrix4fv(u.uModell, false, modell);
      gl.uniformMatrix3fv(u.uNrm, false, normalMat(modell));
      gl.uniform3fv(u.uFarge, d.farge);
      gl.uniform1f(u.uMetall, d.metall);
      gl.uniform1f(u.uRu, d.ru);
      gl.uniform1f(u.uAlfa, b.alfa);

      gl.bindBuffer(gl.ARRAY_BUFFER, d.bPos);
      gl.enableVertexAttribArray(this.pLogo.a.aPos);
      gl.vertexAttribPointer(this.pLogo.a.aPos, 3, gl.FLOAT, false, 0, 0);
      if (d.bNrm) {
        gl.bindBuffer(gl.ARRAY_BUFFER, d.bNrm);
        gl.enableVertexAttribArray(this.pLogo.a.aNrm);
        gl.vertexAttribPointer(this.pLogo.a.aNrm, 3, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, d.tal);
    }

    /* ── Støvet, bare mens det lever ── */
    var st = (t - T.slag) / 1000;
    if (st > 0 && st < 1.15) {
      gl.useProgram(this.pStoev.p);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      var a = this.pStoev.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bStart); gl.enableVertexAttribArray(a.aStart); gl.vertexAttribPointer(a.aStart, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bFart);  gl.enableVertexAttribArray(a.aFart);  gl.vertexAttribPointer(a.aFart,  3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bFroe);  gl.enableVertexAttribArray(a.aFroe);  gl.vertexAttribPointer(a.aFroe,  1, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(this.pStoev.u.uMVP, false, vp);
      gl.uniform1f(this.pStoev.u.uT, st);
      gl.uniform1f(this.pStoev.u.uPx, this.lerret.height * 0.035);
      gl.drawArrays(gl.POINTS, 0, this.stoevN);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    /* ── Blinket i slaget, og teksten ── */
    var bl = spenn(t, T.slag, T.slag + 150);
    this.blink.style.opacity = (bl > 0 && bl < 1) ? (1 - bl) * 0.5 : 0;
    this.rot.classList.toggle('lastar-tekst-inne', t > T.sving + 260);
    this.visFramgang += (this.framgang - this.visFramgang) * 0.12;
    this.skinne.style.transform = 'scaleX(' + this.visFramgang.toFixed(4) + ')';

    if (this.arbeidFerdig && t >= T.hald) { this.avslutt(); return; }
    this.ramme = requestAnimationFrame(function (x) { meg.teikn(x); });
  };

  Lastar.prototype.sett = function (del, tekst) {
    this.framgang = Math.max(this.framgang, Math.min(1, del));
    if (tekst && this.steg) this.steg.textContent = tekst;
  };

  Lastar.prototype.ferdig = function () {
    var meg = this;
    this.arbeidFerdig = true;
    this.framgang = 1;
    return new Promise(function (ok) {
      if (meg.avslutta) return ok();
      meg.ferdigKall.push(ok);

      /* Flat visning har ingen tegneløkke som kan avslutte for oss. */
      if (meg.flatModus) {
        var gaatt = performance.now() - meg.t0;
        setTimeout(function () { meg.avslutt(); }, Math.max(0, 900 - gaatt));
        return;
      }

      /* Ellers avslutter tegneløkka selv når filmen er spilt ut. At
         modellen ennå ikke er hentet er IKKE det samme som at vi har gitt
         opp – klokka starter først når den er her, og da skal filmen få gå.
         Dette er bare en bakstopper for et nett som aldri svarer. */
      setTimeout(function () { meg.avslutt(); }, T.hald + 900);
    });
  };

  Lastar.prototype.avslutt = function () {
    if (this.avslutta) return;
    this.avslutta = true;
    if (this.ramme) cancelAnimationFrame(this.ramme);
    var meg = this;
    this.rot.classList.add('lastar-ut');
    setTimeout(function () {
      if (meg.rot && meg.rot.parentNode) meg.rot.parentNode.removeChild(meg.rot);
      /* Kontekst og buffere slippes eksplisitt. En WebGL-kontekst som
         blir liggende er minne appen ikke får igjen. */
      if (meg.gl) {
        var mist = meg.gl.getExtension('WEBGL_lose_context');
        if (mist) mist.loseContext();
        meg.gl = null;
      }
      meg.modell = null;
      meg.ferdigKall.forEach(function (f) { f(); });
      meg.ferdigKall = [];
    }, 520);
  };

  window.HM_LASTAR = {
    lag: function (vert) { return new Lastar(vert || document.body).bygg(); }
  };
})();
