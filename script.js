(() => {
  'use strict';

  /* ================== Configuración ================== */
  let apuesta = 10;
  const MAX_SALDO = 1_000_000_000;

  const S = {
    cereza:  { id: 'cereza',  txt: '🍒' },
    campana: { id: 'campana', txt: '🔔' },
    ocho:    { id: 'ocho',    txt: '8'  },
    A:       { id: 'A',       txt: 'A'  },
    G:       { id: 'G',       txt: 'G'  },
    J:       { id: 'J',       txt: 'J'  },
  };

  // Cada columna tiene su propia letra: A / G / J
  const CARRETES = [
    [S.cereza, S.A, S.campana, S.ocho],
    [S.cereza, S.G, S.campana, S.ocho],
    [S.cereza, S.J, S.campana, S.ocho],
  ];
  const PREMIOS = { cereza: 5, campana: 20, ocho: 50 };

  /* ================== Referencias ================== */
  const $ = id => document.getElementById(id);
  const el = {
    ajuste: $('ajuste'), escenario: $('escenario'), maquina: $('maquina'),
    saldo: $('saldo'), premio: $('premio'), mensaje: $('mensaje'),
    palanca: $('palanca'), bandeja: $('bandeja'), caja: $('caja'),
    importe: $('importe'), ingresar: $('ingresar'),
    capa: $('capaMonedas'), velo: $('velo'), perdido: $('perdido'),
    pagar: $('pagar'), sonido: $('sonido'),
    modo: $('modo'), modoTexto: $('modoTexto'), titulo: $('titulo'), textoOcho: $('textoOcho'),
    menos: $('menos'), mas: $('mas'), maxAp: $('maxApuesta'), apuestaIn: $('apuestaIn'), apuestaOut: $('apuestaOut'),
  };
  const rodillos = [...document.querySelectorAll('.rodillo')];

  /* ================== Estado ================== */
  let saldo = 0;
  let girando = false;
  const aleatorio = lista => lista[Math.floor(Math.random() * lista.length)];
  let goat = false;
  // Normal: todos los símbolos por igual. GOAT: solo 8 y la letra de cada columna.
  const simbolo = i => {
    if (!goat) return aleatorio(CARRETES[i]);
    return Math.random() < 0.55 ? CARRETES[i][1] : S.ocho;
  };
  const premios = () => (goat ? { ocho: 888 } : PREMIOS);
  const nuevosVisibles = () => CARRETES.map((_, i) => [simbolo(i), simbolo(i), simbolo(i)]);
  let visibles = nuevosVisibles();
  const formato = n => n.toLocaleString('es-ES') + ' €';
  const htmlSim = s => `<div class="sim sim-${s.id}">${s.txt}</div>`;

  /* ================== Sonido (sintetizado, sin archivos) ================== */
  const Sonido = (() => {
    let ctx = null, master = null, ruido = null, activo = true;

    function iniciar() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7;
        master.connect(ctx.destination);
        ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = ruido.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    }
    const ok = () => ctx && activo;

    function tono(f, t, dur, { tipo = 'sine', vol = 0.2, fin = null } = {}) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(f, t);
      if (fin) o.frequency.exponentialRampToValueAtTime(fin, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    function golpe(t, { vol = 0.2, freq = 2000, q = 1, dur = 0.03, tipo = 'bandpass' } = {}) {
      const s = ctx.createBufferSource();
      s.buffer = ruido;
      const f = ctx.createBiquadFilter();
      f.type = tipo; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random() * 0.5, dur + 0.01);
    }

    function campanilla(f, t, vol) {
      tono(f, t, 0.7, { vol });
      tono(f * 2.76, t, 0.4, { vol: vol * 0.4 });
    }

    function bale(t, dur, f0) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 1.1, t);
      o.frequency.linearRampToValueAtTime(f0, t + 0.15);
      o.frequency.linearRampToValueAtTime(f0 * 0.78, t + dur);

      const lfo = ctx.createOscillator(); lfo.frequency.value = 24;
      const lg = ctx.createGain(); lg.gain.value = f0 * 0.1;
      lfo.connect(lg); lg.connect(o.frequency);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(1000, t);
      bp.frequency.linearRampToValueAtTime(1500, t + dur * 0.4);
      bp.frequency.linearRampToValueAtTime(1100, t + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.06);
      g.gain.setValueAtTime(0.6, t + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const tl = ctx.createOscillator(); tl.frequency.value = 24;
      const tg = ctx.createGain(); tg.gain.value = 0.25;
      tl.connect(tg); tg.connect(g.gain);

      o.connect(bp); bp.connect(g); g.connect(master);
      [o, lfo, tl].forEach(n => { n.start(t); n.stop(t + dur + 0.05); });
    }

    // Si existe cabra.mp3 junto a index.html se usa ese; si no, suena el balido sintetizado
    const archivo = new Audio('cabra.mp3');
    archivo.preload = 'auto';
    function conArchivo(respaldo) {
      if (!activo) return;
      archivo.currentTime = 0;
      const p = archivo.play();
      if (p && p.catch) p.catch(() => { if (ok()) respaldo(); });
    }

    return {
      iniciar,
      parar() { archivo.pause(); archivo.currentTime = 0; },
      alternar() { activo = !activo; if (!activo) { archivo.pause(); } return activo; },

      // Tirón de palanca: carraca mecánica + golpe + muelle
      palanca() {
        if (!ok()) return;
        const t = ctx.currentTime;
        for (let k = 0; k < 9; k++) {
          golpe(t + k * 0.04, { vol: 0.25, freq: 1500 + k * 220, q: 4 });
          tono(300 + k * 40, t + k * 0.04, 0.03, { tipo: 'square', vol: 0.04 });
        }
        golpe(t + 0.36, { vol: 0.5, freq: 400, dur: 0.08 });
        tono(120, t + 0.36, 0.18, { tipo: 'triangle', vol: 0.45, fin: 45 });
        for (let k = 0; k < 6; k++) golpe(t + 0.62 + k * 0.05, { vol: 0.12, freq: 900 - k * 80, q: 3 });
        tono(180, t + 0.62, 0.35, { tipo: 'triangle', vol: 0.1, fin: 420 });
      },
      tick() {
        if (!ok()) return;
        const t = ctx.currentTime;
        golpe(t, { vol: 0.12, freq: 2500 + Math.random() * 1200, q: 6, dur: 0.015 });
        tono(700, t, 0.02, { tipo: 'square', vol: 0.02 });
      },
      parada(i) {
        if (!ok()) return;
        const t = ctx.currentTime;
        tono(190 - i * 20, t, 0.16, { tipo: 'triangle', vol: 0.5, fin: 55 });
        golpe(t, { vol: 0.35, freq: 700, dur: 0.05 });
      },
      ganar(mult) {
        if (!ok()) return;
        const t = ctx.currentTime;
        [1046.5, 1318.5, 1568, 2093].forEach((f, j) => {
          tono(f, t + j * 0.09, 0.3, { tipo: 'square', vol: 0.06 });
          tono(f * 2, t + j * 0.09, 0.2, { vol: 0.04 });
        });
        const pings = Math.min(8 + mult, 40);
        for (let j = 0; j < pings; j++) {
          const tt = t + 0.35 + j * 0.06 + Math.random() * 0.02;
          tono(2200 + Math.random() * 1600, tt, 0.09, { vol: 0.09 });
          golpe(tt, { vol: 0.12, freq: 6000, q: 2, dur: 0.03, tipo: 'highpass' });
        }
      },
      jackpot() {
        if (!ok()) return;
        const t = ctx.currentTime;
        const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
        for (let r = 0; r < 3; r++) base.forEach((f, j) => campanilla(f, t + r * 0.7 + j * 0.07, 0.12));
        for (let j = 0; j < 55; j++) {
          const tt = t + 0.2 + j * 0.055 + Math.random() * 0.02;
          tono(2200 + Math.random() * 1600, tt, 0.09, { vol: 0.09 });
          golpe(tt, { vol: 0.12, freq: 6000, q: 2, dur: 0.03, tipo: 'highpass' });
        }
      },
      perder() {
        if (!ok()) return;
        const t = ctx.currentTime;
        tono(260, t, 0.18, { tipo: 'sawtooth', vol: 0.06, fin: 180 });
        tono(200, t + 0.16, 0.25, { tipo: 'sawtooth', vol: 0.06, fin: 120 });
      },
      error() {
        if (!ok()) return;
        const t = ctx.currentTime;
        tono(180, t, 0.12, { tipo: 'square', vol: 0.08 });
        tono(140, t + 0.12, 0.18, { tipo: 'square', vol: 0.08 });
      },
      ingreso() {
        if (!ok()) return;
        const t = ctx.currentTime;
        golpe(t, { vol: 0.2, freq: 5000, q: 2, dur: 0.05, tipo: 'highpass' });
        tono(1568, t, 0.25, { vol: 0.12 });
        tono(2093, t + 0.09, 0.45, { vol: 0.12 });
      },
      balido() {
        conArchivo(() => bale(ctx.currentTime, 0.8, 400));
      },
      // Dos balidos y trombón triste
      cabra() {
        conArchivo(() => {
          const t = ctx.currentTime;
          bale(t, 1.0, 420);
          bale(t + 1.25, 0.8, 380);
          [233, 220, 208, 196].forEach((f, j) => {
            tono(f, t + 2.2 + j * 0.35, j === 3 ? 0.9 : 0.34, { tipo: 'sawtooth', vol: 0.09, fin: j === 3 ? f * 0.9 : null });
          });
        });
      },
    };
  })();

  /* ================== Monedas animadas ================== */
  const centro = nodo => {
    const r = nodo.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // 'caer' = baja (gastas o pierdes)  |  'subir' = sube (ganas o ingresas)
  function monedas(modo, n, desde, hasta) {
    const a = centro(desde), b = centro(hasta);
    n = Math.min(Math.max(n, 1), 26);
    const pos = (x, y, giro, esc) =>
      `perspective(300px) translate(${x - 17}px, ${y - 17}px) rotateY(${giro}deg) scale(${esc})`;

    for (let i = 0; i < n; i++) {
      const img = new Image();
      img.src = 'moneda.png';
      img.alt = '';
      img.className = 'moneda';
      el.capa.appendChild(img);

      const jx = () => (Math.random() - 0.5) * 70;
      const x0 = a.x + jx(), y0 = a.y + (Math.random() - 0.5) * 20;
      const x1 = b.x + jx(), y1 = b.y + (Math.random() - 0.5) * 20;
      const giro = 540 + Math.random() * 540;

      let frames;
      if (modo === 'caer') {
        frames = [
          { transform: pos(x0, y0, 0, 1),   opacity: 0, offset: 0 },
          { transform: pos(x0, y0, 0, 1),   opacity: 1, offset: 0.08 },
          { transform: pos(x1, y1, giro, .8), opacity: 1, offset: 0.85 },
          { transform: pos(x1, y1, giro, .8), opacity: 0, offset: 1 },
        ];
      } else {
        const ym = Math.min(y0, y1) - 40;
        frames = [
          { transform: pos(x0, y0, 0, .8),  opacity: 0, offset: 0 },
          { transform: pos(x0, y0, 0, .8),  opacity: 1, offset: 0.08 },
          { transform: pos((x0 + x1) / 2, ym, giro / 2, 1.1), opacity: 1, offset: 0.5 },
          { transform: pos(x1, y1, giro, .6), opacity: 1, offset: 0.88 },
          { transform: pos(x1, y1, giro, .6), opacity: 0, offset: 1 },
        ];
      }
      const anim = img.animate(frames, {
        duration: 900 + Math.random() * 400,
        delay: i * 70,
        easing: modo === 'caer' ? 'cubic-bezier(.5,0,1,.6)' : 'cubic-bezier(.2,.7,.3,1)',
        fill: 'both',
      });
      anim.onfinish = () => img.remove();
    }
  }

  /* ================== Interfaz ================== */
  function pintarSaldo(efecto) {
    el.saldo.textContent = formato(saldo);
    if (efecto) {
      el.saldo.classList.remove('sube', 'baja');
      void el.saldo.offsetWidth;
      el.saldo.classList.add(efecto);
    }
  }
  function mensaje(texto, clase = '') {
    el.mensaje.textContent = texto;
    el.mensaje.className = 'mensaje ' + clase;
  }
  function sacudir(nodo) {
    nodo.classList.remove('sacudir');
    void nodo.offsetWidth;
    nodo.classList.add('sacudir');
  }
  function estadoPalanca() {
    el.palanca.classList.toggle('ocupada', girando);
    el.palanca.classList.toggle('listo', !girando && saldo >= apuesta);
    el.palanca.setAttribute('aria-disabled', String(girando));
    [el.menos, el.mas, el.maxAp, el.apuestaIn].forEach(n => { n.disabled = girando; });
    const bloqueado = saldo > 0 || girando;
    el.modo.classList.toggle('bloqueado', bloqueado);
    el.modo.setAttribute('aria-pressed', String(goat));
    el.modo.textContent = (bloqueado ? '🔒 ' : '🐐 ') + 'GOAT';
    el.modoTexto.textContent = (goat ? 'Modo GOAT: el 888 paga x888, pero Ander acecha' : 'Modo normal')
      + (saldo > 0 && !girando ? ' (solo puedes cambiar sin dinero)' : '');
  }

  /* ================== Apuesta ================== */
  const ESCALA = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000];
  function fijarApuesta(v) {
    v = Math.floor(Number(v));
    if (!Number.isFinite(v) || v < 1) v = 1;
    apuesta = Math.min(v, MAX_SALDO);
    el.apuestaIn.value = apuesta;
    el.apuestaOut.textContent = formato(apuesta);
    estadoPalanca();
  }

  /* ================== Modo GOAT ================== */
  function cambiarModo() {
    if (girando) return;
    Sonido.iniciar();
    if (saldo > 0) {
      mensaje('Solo puedes cambiar de modo cuando no tienes dinero', 'alerta');
      Sonido.error();
      sacudir(el.modo);
      return;
    }
    goat = !goat;
    document.body.classList.toggle('goat', goat);
    el.titulo.textContent = goat ? 'GOAT MODE' : 'TRAGAPERRAS';
    el.textoOcho.textContent = goat ? 'x888 GOAT JACKPOT' : 'x50 JACKPOT';
    visibles = nuevosVisibles();
    rodillos.forEach((r, i) => {
      const t = r.querySelector('.tira');
      t.style.transition = 'none';
      t.style.transform = 'translateY(0)';
      t.innerHTML = visibles[i].map(htmlSim).join('');
    });
    if (goat) { Sonido.balido(); mensaje('🐐 Modo GOAT: solo salen 8 y A G J. Cuidado con Ander', 'impuesto'); }
    else mensaje('Modo normal', 'pierde');
    estadoPalanca();
    setTimeout(ajustar, 0);
  }

  // Escala la máquina para que quepa en cualquier pantalla
  function ajustar() {
    const w = el.escenario.offsetWidth, h = el.escenario.offsetHeight;
    const s = Math.max(0.4, Math.min(1, (document.documentElement.clientWidth - 16) / w, (document.documentElement.clientHeight - 16) / h));
    el.ajuste.style.width = w * s + 'px';
    el.ajuste.style.height = h * s + 'px';
    el.escenario.style.transform = `scale(${s})`;
  }

  /* ================== Juego ================== */
  function tirar() {
    if (girando) return;
    Sonido.iniciar();

    if (saldo < apuesta) {
      mensaje(saldo === 0 ? 'Ingresa dinero para poder jugar' : `Tu saldo no llega para apostar ${formato(apuesta)}. Baja la apuesta`, 'alerta');
      Sonido.error();
      sacudir(el.caja);
      return;
    }

    girando = true;
    saldo -= apuesta;
    pintarSaldo('baja');
    estadoPalanca();
    mensaje('', '');
    monedas('caer', 3, el.saldo, el.bandeja);

    el.palanca.classList.remove('tirada');
    void el.palanca.offsetWidth;
    el.palanca.classList.add('tirada');
    Sonido.palanca();

    setTimeout(girarRodillos, 350);
  }

  function girarRodillos() {
    const resultado = CARRETES.map((_, i) => simbolo(i));
    const alto = rodillos[0].clientHeight / 3;
    let restantes = rodillos.length;
    const tick = setInterval(() => Sonido.tick(), 75);

    rodillos.forEach((r, i) => {
      const tira = r.querySelector('.tira');
      const L = 24 + i * 10;
      const nuevo = [simbolo(i), resultado[i], simbolo(i)];
      // Arriba: el resultado final. Abajo: lo que se veía antes. Los símbolos bajan.
      const items = [...nuevo];
      while (items.length < L - 3) items.push(simbolo(i));
      items.push(...visibles[i]);

      tira.style.transition = 'none';
      tira.style.transform = `translateY(${-(L - 3) * alto}px)`;
      tira.innerHTML = items.map(htmlSim).join('');
      void tira.offsetHeight;

      const dur = 1700 + i * 650;
      tira.style.transition = `transform ${dur}ms cubic-bezier(.22,.7,.2,1)`;
      tira.style.transform = 'translateY(0)';
      r.classList.add('girando');
      setTimeout(() => r.classList.remove('girando'), dur - 600);

      setTimeout(() => {
        tira.style.transition = 'none';
        tira.innerHTML = nuevo.map(htmlSim).join('');
        tira.style.transform = 'translateY(0)';
        visibles[i] = nuevo;
        Sonido.parada(i);
        if (--restantes === 0) {
          clearInterval(tick);
          evaluar(resultado);
        }
      }, dur + 30);
    });
  }

  function marcarGanadores() {
    rodillos.forEach(r => r.querySelectorAll('.sim')[1].classList.add('ganador'));
  }

  function evaluar(res) {
    const ids = res.map(s => s.id);

    // A · G · J  →  Impuesto de la cabra
    if (ids[0] === 'A' && ids[1] === 'G' && ids[2] === 'J') {
      const perdido = saldo;
      saldo = 0;
      marcarGanadores();
      mensaje('Impuesto de la cabra…', 'impuesto');
      Sonido.cabra();
      setTimeout(() => {
        pintarSaldo('baja');
        monedas('caer', Math.max(8, Math.min(perdido / 10, 22)), el.saldo, el.bandeja);
        el.perdido.textContent = '−' + formato(perdido);
        el.velo.classList.add('abierto');
        el.pagar.focus();
      }, 700);
      return;
    }

    const unico = ids[0] === ids[1] && ids[1] === ids[2];
    if (unico && premios()[ids[0]]) {
      const mult = premios()[ids[0]];
      const ganancia = apuesta * mult;
      saldo = Math.min(saldo + ganancia, MAX_SALDO);
      pintarSaldo('sube');
      el.premio.textContent = formato(ganancia);
      marcarGanadores();
      monedas('subir', Math.min(5 + mult / 2, 26), el.bandeja, el.saldo);
      if (ids[0] === 'ocho') {
        mensaje(goat ? `🐐 ¡GOAT JACKPOT x888! +${formato(ganancia)}` : `🎉 ¡JACKPOT! +${formato(ganancia)}`, 'gana');
        Sonido.jackpot();
        el.maquina.classList.add('jackpot');
        setTimeout(() => el.maquina.classList.remove('jackpot'), 3500);
      } else {
        mensaje(`¡Has ganado! +${formato(ganancia)}`, 'gana');
        Sonido.ganar(mult);
      }
    } else {
      mensaje('Inténtalo de nuevo', 'pierde');
      Sonido.perder();
    }

    girando = false;
    estadoPalanca();
  }

  function cerrarImpuesto() {
    Sonido.parar();
    el.velo.classList.remove('abierto');
    girando = false;
    estadoPalanca();
    mensaje('Ander se ha quedado con todo. Ingresa dinero para volver a jugar', 'alerta');
  }

  /* ================== Ingreso de dinero ================== */
  function ingresar(cantidad) {
    Sonido.iniciar();
    if (girando) { mensaje('Espera a que paren los rodillos', 'alerta'); Sonido.error(); return; }
    const valor = Math.floor(Number(cantidad));
    if (!Number.isFinite(valor) || valor < 1) {
      mensaje('Escribe un importe válido (mínimo 1 €)', 'alerta');
      Sonido.error();
      sacudir(el.caja);
      return;
    }
    const antes = saldo;
    saldo = Math.min(saldo + valor, MAX_SALDO);
    const real = saldo - antes;
    pintarSaldo('sube');
    estadoPalanca();
    Sonido.ingreso();
    monedas('subir', Math.min(3 + real / 20, 18), el.importe, el.saldo);
    mensaje(`Has ingresado ${formato(real)}. ¡A tirar de la palanca!`, 'gana');
    el.importe.value = '';
  }

  /* ================== Eventos ================== */
  el.palanca.addEventListener('click', tirar);
  el.palanca.addEventListener('animationend', e => {
    if (e.animationName === 'brazo') el.palanca.classList.remove('tirada');
  });
  // Botón "Ingresar" con el campo vacío: no es un error, solo indicamos cómo hacerlo
  function ingresarEscrito() {
    if (el.importe.value.trim() === '') {
      mensaje('Escribe un importe o pulsa +20, +50, +100 o +500', 'alerta');
      el.importe.focus();
      return;
    }
    ingresar(el.importe.value);
  }
  el.ingresar.addEventListener('click', ingresarEscrito);
  el.importe.addEventListener('keydown', e => { if (e.key === 'Enter') ingresarEscrito(); });
  document.querySelectorAll('.chips button').forEach(b =>
    b.addEventListener('click', () => ingresar(b.dataset.valor)));
  el.pagar.addEventListener('click', cerrarImpuesto);
  el.modo.addEventListener('click', cambiarModo);
  el.menos.addEventListener('click', () => fijarApuesta([...ESCALA].reverse().find(v => v < apuesta) ?? 1));
  el.mas.addEventListener('click', () => fijarApuesta(ESCALA.find(v => v > apuesta) ?? apuesta));
  el.maxAp.addEventListener('click', () => {
    if (saldo < 1) { mensaje('Ingresa dinero primero', 'alerta'); Sonido.iniciar(); Sonido.error(); return; }
    fijarApuesta(saldo);
  });
  el.apuestaIn.addEventListener('input', () => {
    const v = Math.floor(Number(el.apuestaIn.value));
    if (Number.isFinite(v) && v >= 1) {
      apuesta = Math.min(v, MAX_SALDO);
      el.apuestaOut.textContent = formato(apuesta);
      estadoPalanca();
    }
  });
  el.apuestaIn.addEventListener('change', () => fijarApuesta(el.apuestaIn.value));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el.velo.classList.contains('abierto')) cerrarImpuesto();
    // Barra espaciadora = tirar de la palanca
    if (e.code === 'Space' && !['INPUT', 'BUTTON'].includes(document.activeElement.tagName)
        && !el.velo.classList.contains('abierto')) {
      e.preventDefault();
      tirar();
    }
  });
  el.sonido.addEventListener('click', () => {
    Sonido.iniciar();
    const on = Sonido.alternar();
    el.sonido.textContent = on ? '🔊' : '🔇';
    el.sonido.setAttribute('aria-pressed', String(on));
    el.sonido.setAttribute('aria-label', on ? 'Silenciar sonido' : 'Activar sonido');
  });
  window.addEventListener('resize', ajustar);

  /* ================== Arranque ================== */
  rodillos.forEach((r, i) => {
    r.querySelector('.tira').innerHTML = visibles[i].map(htmlSim).join('');
  });
  pintarSaldo();
  estadoPalanca();
  ajustar();
  window.addEventListener('load', ajustar);
})();