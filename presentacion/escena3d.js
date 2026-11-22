/* ============================================================
   KYNUS — escena 3D (three.js)
   - la estrella del logo, facetada, cromada e iridiscente
   - el llavero: carcasa "boom", pantalla OLED viva, piezas internas,
     tapa, tecla y argolla. Se puede "explotar" para ver lo de adentro.
   ============================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const lim = v => v < 0 ? 0 : v > 1 ? 1 : v;
const suave = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/* Misma estrella que el logo y la animación: [ángulo en pantalla, largo, ancho] */
const BRAZOS = [[0, 36, 3.5], [Math.PI, 36, 3.5], [-Math.PI / 2, 28, 4.5], [Math.PI / 2, 32, 4.5],
  [-Math.PI / 4, 15, 2.8], [-3 * Math.PI / 4, 13, 2.8], [Math.PI / 4, 13, 2.8], [3 * Math.PI / 4, 14, 2.8]];

/* ---------- Estrella facetada: cada brazo es una pirámide doble con lomo ---------- */
function geometriaEstrella(radio = 1.8, alto = 0.46, grosor = 1.4){
  const k = radio / 36, v = [];
  const meter = (...p) => p.forEach(q => v.push(q[0], q[1], q[2]));
  for (const [angPantalla, largo, ancho] of BRAZOS){
    const ang = -angPantalla;                         // en pantalla "y" baja; en 3D sube
    const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
    const L = largo * k, w = ancho * k * grosor, b = L * 0.3;
    const T = [dx * L, dy * L, 0];
    const S1 = [dx * b + px * w, dy * b + py * w, 0];
    const S2 = [dx * b - px * w, dy * b - py * w, 0];
    const A = [0, 0, alto], B = [0, 0, -alto];
    meter(A, S2, T, A, T, S1);                        // frente
    meter(B, T, S2, B, S1, T);                        // espalda
    meter(A, S1, B, A, B, S2);                        // costados internos
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------- Ambiente pastel para los reflejos (cielo + paneles de luz) ---------- */
function crearAmbiente(){
  const amb = new THREE.Scene();
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      arriba: { value: new THREE.Color('#5E9FDB') },
      medio: { value: new THREE.Color('#F4F0FF') },
      banda: { value: new THREE.Color('#2B1F55') },
      abajo: { value: new THREE.Color('#F49AD6') },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // cielo arriba, una banda oscura en el horizonte (le da contraste al cromado) y rosa abajo
    fragmentShader: 'uniform vec3 arriba; uniform vec3 medio; uniform vec3 banda; uniform vec3 abajo; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(medio, arriba, smoothstep(0.05, 0.7, y)) : mix(medio, abajo, smoothstep(0.0, 0.7, -y)); c = mix(c, banda, (1.0 - smoothstep(0.0, 0.16, abs(y + 0.04))) * 0.92); gl_FragColor = vec4(c, 1.0); }',
  }));
  amb.add(cielo);
  const panel = (color, intensidad, pos, tam) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tam[0], tam[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensidad), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); amb.add(m);
  };
  panel('#ffffff', 7, [0, 6.5, 5], [7, 2.2]);
  panel('#C9A4F2', 3.5, [-7.5, 1, 2], [3, 7]);
  panel('#F49AD6', 3.2, [7.5, -1, 2.5], [3, 7]);
  panel('#A6D8F7', 3, [0, -1.5, -8], [9, 3]);
  panel('#ffffff', 2.5, [5, 3, -5], [2, 2]);
  return amb;
}

function texturaBrillo(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,0.95)');
  r.addColorStop(0.18, 'rgba(255,240,252,0.7)');
  r.addColorStop(0.42, 'rgba(244,154,214,0.28)');
  r.addColorStop(0.7, 'rgba(201,164,242,0.10)');
  r.addColorStop(1, 'rgba(201,164,242,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaChispa(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(35, 29, 64, 32); g.quadraticCurveTo(35, 35, 32, 64); g.quadraticCurveTo(29, 35, 0, 32); g.quadraticCurveTo(29, 29, 32, 0); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Formas 2D de la carcasa ---------- */
function poligonoRedondeado(puntos, radios, destino){
  const n = puntos.length, p = i => puntos[(i + n) % n];
  for (let i = 0; i < n; i++){
    const [x, y] = p(i), [ax, ay] = p(i - 1), [bx, by] = p(i + 1);
    const la = Math.hypot(ax - x, ay - y), lb = Math.hypot(bx - x, by - y);
    const r = Math.min(radios[i], la * 0.45, lb * 0.45);
    const x1 = x + (ax - x) / la * r, y1 = y + (ay - y) / la * r;
    const x2 = x + (bx - x) / lb * r, y2 = y + (by - y) / lb * r;
    if (i === 0) destino.moveTo(x1, y1); else destino.lineTo(x1, y1);
    destino.quadraticCurveTo(x, y, x2, y2);
  }
  destino.closePath();
  return destino;
}
function puntosBoom(R){
  // estrella "boom" de cómic: 5 puntas irregulares
  const puntas = [[90, 1.0], [162, 0.9], [236, 0.95], [306, 0.88], [376, 0.96]];
  const valles = [0.69, 0.66, 0.7, 0.67, 0.68];
  const pts = [];
  for (let i = 0; i < 5; i++){
    const [a, r] = puntas[i], a2 = (a + puntas[(i + 1) % 5][0] + (i === 4 ? 360 : 0)) / 2;
    pts.push([Math.cos(a * Math.PI / 180) * R * r, Math.sin(a * Math.PI / 180) * R * r]);
    pts.push([Math.cos(a2 * Math.PI / 180) * R * valles[i], Math.sin(a2 * Math.PI / 180) * R * valles[i]]);
  }
  return pts;
}
function rectRedondeado(w, h, r, destino){
  const x = -w / 2, y = -h / 2;
  destino.moveTo(x + r, y); destino.lineTo(x + w - r, y); destino.quadraticCurveTo(x + w, y, x + w, y + r);
  destino.lineTo(x + w, y + h - r); destino.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  destino.lineTo(x + r, y + h); destino.quadraticCurveTo(x, y + h, x, y + h - r);
  destino.lineTo(x, y + r); destino.quadraticCurveTo(x, y, x + r, y);
  return destino;
}
function extruir(forma, profundidad, bisel){
  return new THREE.ExtrudeGeometry(forma, {
    depth: profundidad, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel,
    bevelSegments: 4, curveSegments: 20,
  });
}

/* ---------- El llavero ---------- */
function crearLlavero(lienzoPantalla){
  const grupo = new THREE.Group();
  const R = 3.2;
  const contorno = puntosBoom(R);
  const radios = contorno.map((_, i) => i % 2 === 0 ? 0.6 : 0.95);
  const interior = contorno.map(([x, y]) => [x * 0.9, y * 0.9]);
  const radiosInt = radios.map(r => r * 0.9);
  const exterior = () => poligonoRedondeado(contorno, radios, new THREE.Shape());
  const hueco = () => poligonoRedondeado(interior, radiosInt, new THREE.Path());

  const plastico = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.36, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.22,
    sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5, ...extra,
  });
  const matFrente = plastico('#B58AEE', { sheen: 0.25 });
  const matTapa = plastico('#F28FD0', { sheen: 0.25 });
  const matTecla = plastico('#9FE8C8');
  const metal = new THREE.MeshStandardMaterial({ color: '#E9EAF2', metalness: 1, roughness: 0.18 });
  const dorado = new THREE.MeshStandardMaterial({ color: '#E8C46C', metalness: 1, roughness: 0.3 });
  const pcbAzul = new THREE.MeshStandardMaterial({ color: '#2450B4', roughness: 0.55 });
  const pcbNegro = new THREE.MeshStandardMaterial({ color: '#17171F', roughness: 0.5 });
  const plata = new THREE.MeshStandardMaterial({ color: '#C8CDD8', metalness: 1, roughness: 0.28 });
  const negro = new THREE.MeshStandardMaterial({ color: '#111116', roughness: 0.4 });
  const vidrio = new THREE.MeshPhysicalMaterial({ color: '#06060B', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  const bateriaMat = new THREE.MeshStandardMaterial({ color: '#B9C8EA', metalness: 0.65, roughness: 0.32 });

  const partes = {};
  const parte = nombre => { const g = new THREE.Group(); g.name = nombre; grupo.add(g); partes[nombre] = g; return g; };

  // Frente: placa con ventana + pared hueca + aro + argolla
  const frente = parte('frente');
  const formaPlaca = exterior(); formaPlaca.holes.push(rectRedondeado(2.42, 1.32, 0.14, new THREE.Path()));
  const placa = new THREE.Mesh(extruir(formaPlaca, 0.12, 0.06), matFrente); placa.position.z = 0.70;
  const formaPared = exterior(); formaPared.holes.push(hueco());
  const pared = new THREE.Mesh(extruir(formaPared, 0.68, 0), matFrente); pared.position.z = 0.02;
  const arriba = R * 0.93;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 16, 40), matFrente); aro.position.set(0, arriba + 0.1, 0.42);
  const argolla = new THREE.Group(); argolla.position.set(0, arriba + 0.1, 0.42);
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 12, 72), metal);
  anillo.rotation.y = Math.PI / 2; anillo.position.y = 0.85; argolla.add(anillo);
  frente.add(placa, pared, aro, argolla);

  // Pantalla OLED: placa azul, vidrio negro y la pantalla viva
  const oled = parte('oled');
  const pcbOled = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.55, 0.06), pcbAzul); pcbOled.position.z = 0.5;
  const vidrioOled = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.42, 0.05), vidrio); vidrioOled.position.z = 0.56;
  const textura = new THREE.CanvasTexture(lienzoPantalla);
  textura.colorSpace = THREE.SRGBColorSpace; textura.anisotropy = 4;
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: textura, toneMapped: false }));
  pantalla.position.z = 0.588;
  oled.add(pcbOled, vidrioOled, pantalla);
  for (let i = 0; i < 4; i++){
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.07), dorado);
    pin.position.set(-0.39 + i * 0.26, 1.1, 0.5); oled.add(pin);
  }

  // Capa 2: ESP32-C3 Super Mini + cargador TP4056
  const capa2 = parte('capa2');
  const esp = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.8, 0.06), pcbNegro); esp.position.set(-0.78, 0, 0.15);
  const blindaje = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.95, 0.14, 2, 0.03), plata); blindaje.position.set(-0.78, 0.2, 0.24);
  const usb1 = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.18, 0.13, 2, 0.05), plata); usb1.position.set(-0.78, -0.86, 0.24);
  const tp = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.95, 0.06), pcbAzul); tp.position.set(0.8, 0, 0.15);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.08), negro); chip.position.set(0.8, 0.25, 0.22);
  const usb2 = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.18, 0.13, 2, 0.05), plata); usb2.position.set(0.8, -0.93, 0.24);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: '#7CFFB2', toneMapped: false })); led.position.set(0.5, 0.75, 0.2);
  capa2.add(esp, blindaje, usb1, tp, chip, usb2, led);

  // Capa 3: batería LiPo + interruptor
  const capa3 = parte('capa3');
  const bateria = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.7, 0.42, 4, 0.12), bateriaMat); bateria.position.set(-0.15, 0, -0.36);
  const cableR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#E2453C', roughness: 0.5 }));
  cableR.position.set(0.95, 0.95, -0.3);
  const cableN = cableR.clone(); cableN.material = negro; cableN.position.x = 0.82;
  const interruptor = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.3, 0.3, 2, 0.04), negro); interruptor.position.set(1.45, 0.75, -0.36);
  const palanca = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), plata); palanca.position.set(1.5, 0.75, -0.16);
  capa3.add(bateria, cableR, cableN, interruptor, palanca);

  // Tapa y tecla
  const tapa = parte('tapa');
  const placaT = new THREE.Mesh(extruir(exterior(), 0.12, 0.06), matTapa); placaT.position.z = -0.82;
  const formaParedT = exterior(); formaParedT.holes.push(hueco());
  const paredT = new THREE.Mesh(extruir(formaParedT, 0.68, 0), matTapa); paredT.position.z = -0.70;
  tapa.add(placaT, paredT);
  const tecla = parte('tecla');
  const boton = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 40), matTecla);
  boton.rotation.x = Math.PI / 2; boton.position.z = -0.98; tecla.add(boton);

  const anclas = {
    pantalla: { parte: oled, punto: [0, 0, 0.6] },
    frente: { parte: frente, punto: [1.6, 2.0, 0.86] },
    oled: { parte: oled, punto: [-1.1, -0.55, 0.6] },
    capa2: { parte: capa2, punto: [0.8, 0.4, 0.22] },
    capa3: { parte: capa3, punto: [-1.2, -0.6, -0.15] },
    tapa: { parte: tapa, punto: [1.9, -1.2, -0.86] },
    tecla: { parte: tecla, punto: [-0.3, -0.3, -1.1] },
  };
  return { grupo, partes, anclas, textura, argolla };
}

/* ---------- Chispitas flotando ---------- */
function crearChispas(cantidad){
  const pos = new Float32Array(cantidad * 3), col = new Float32Array(cantidad * 3);
  const paleta = ['#ffffff', '#ffffff', '#F9D3EE', '#C9A4F2', '#F49AD6', '#A6D8F7'].map(c => new THREE.Color(c));
  for (let i = 0; i < cantidad; i++){
    pos[i * 3] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 2] = -8 + Math.random() * 11;
    const c = paleta[i % paleta.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.24, map: texturaChispa(), transparent: true, depthWrite: false, vertexColors: true, opacity: 0.9, sizeAttenuation: true });
  return new THREE.Points(g, m);
}

/* ============================================================
   ESCENA
   ============================================================ */
export function crearEscena(lienzo, { lienzoPantalla, movil = false } = {}){
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, movil ? 1.6 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camara.position.set(0, 0, 14);

  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(crearAmbiente(), 0.03).texture;
  pmrem.dispose();

  escena.add(new THREE.HemisphereLight('#EAF4FF', '#F4B8E4', 1.1));
  const sol = new THREE.DirectionalLight('#ffffff', 1.8); sol.position.set(3, 5, 7); escena.add(sol);
  const contra = new THREE.DirectionalLight('#C9A4F2', 1.4); contra.position.set(-6, -2, -4); escena.add(contra);

  // Estrella
  const estrella = new THREE.Group();
  const cuerpo = new THREE.Mesh(geometriaEstrella(), new THREE.MeshPhysicalMaterial({
    color: '#F1E8FF', metalness: 1, roughness: 0.16, flatShading: true,
    iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [260, 820],
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25,
  }));
  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(), transparent: true, depthWrite: false, opacity: 0.9 }));
  brillo.scale.setScalar(8.5); brillo.position.z = -0.8;
  estrella.add(brillo, cuerpo);
  escena.add(estrella);

  // Llavero
  const { grupo: llavero, partes, anclas, textura, argolla } = crearLlavero(lienzoPantalla);
  escena.add(llavero);

  // Chispas
  const chispas = crearChispas(movil ? 70 : 150);
  escena.add(chispas);

  const raton = { x: 0, y: 0 };
  const desplazar = { frente: [0, 0.3, 3.1], oled: [0, 0.12, 1.95], capa2: [0, 0, 0.6], capa3: [0, -0.1, -1.05], tapa: [0, -0.25, -2.5], tecla: [0, -0.3, -3.3] };
  const giros = { frente: 0.08, oled: -0.05, capa2: 0.04, capa3: -0.06, tapa: 0.07, tecla: 0 };
  const orden = ['frente', 'oled', 'capa2', 'capa3', 'tapa', 'tecla'];
  let ancho = 1, alto = 1;

  function redimensionar(){
    ancho = lienzo.clientWidth || window.innerWidth;
    alto = lienzo.clientHeight || window.innerHeight;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  }
  redimensionar();

  function explotar(e){
    orden.forEach((n, i) => {
      const k = suave(lim((e - Math.abs(i - 2.5) * 0.04) / 0.8));
      const [dx, dy, dz] = desplazar[n];
      partes[n].position.set(dx * k, dy * k, dz * k);
      partes[n].rotation.z = giros[n] * k;
    });
  }

  function actualizar(estado, ahora){
    const t = ahora / 1000;
    raton.x += (estado.raton.x - raton.x) * 0.06;
    raton.y += (estado.raton.y - raton.y) * 0.06;

    const E = estado.estrella;
    estrella.visible = E.escala > 0.003;
    if (estrella.visible){
      estrella.position.set(E.x, E.y + Math.sin(t * 1.1) * 0.08, E.z);
      estrella.scale.setScalar(E.escala);
      // se hamaca (nunca queda de canto) y gira despacito sobre sí misma
      cuerpo.rotation.set(raton.y * 0.35 + Math.sin(t * 0.7) * 0.18, Math.sin(t * 0.55) * 0.6 + E.giro + raton.x * 0.5, t * 0.12);
    }

    const K = estado.llavero;
    llavero.visible = K.visible;
    if (llavero.visible){
      llavero.position.set(K.x, K.y + Math.sin(t * 1.3) * 0.06, K.z);
      llavero.scale.setScalar(K.escala);
      llavero.rotation.set(K.rotX + raton.y * K.seguir * 0.3, K.rotY + raton.x * K.seguir * 0.45, K.rotZ);
      explotar(K.explosion);
      argolla.rotation.x = Math.sin(t * 1.6) * 0.22;
      argolla.rotation.z = Math.sin(t * 1.1) * 0.12;
    }

    chispas.rotation.y = t * 0.02 + raton.x * 0.1;
    chispas.rotation.x = raton.y * 0.06;

    camara.position.set(estado.camara.x, estado.camara.y, estado.camara.z);
    camara.lookAt(estado.camara.x, estado.camara.y, 0);
    renderer.render(escena, camara);
  }

  const v = new THREE.Vector3();
  function proyectar(nombre){
    const a = anclas[nombre]; if (!a) return null;
    v.set(a.punto[0], a.punto[1], a.punto[2]);
    a.parte.localToWorld(v);
    v.project(camara);
    return { x: (v.x * 0.5 + 0.5) * ancho, y: (-v.y * 0.5 + 0.5) * alto, z: v.z };
  }

  return {
    actualizar,
    redimensionar,
    proyectar,
    pantallaCambiada(){ textura.needsUpdate = true; },
  };
}
