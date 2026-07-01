// ============================================================
// BoviSal Control Pro — by Solugan SG
// V 260619.14 — JAN A. GONZALEZ
// ============================================================

// ─── FIREBASE CONFIG ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDO0926bDZ-6meOB7X91glxeisfWtfkagM",
  authDomain: "bovisal-control-pro.firebaseapp.com",
  projectId: "bovisal-control-pro",
  storageBucket: "bovisal-control-pro.firebasestorage.app",
  messagingSenderId: "801046420629",
  appId: "1:801046420629:web:9e6800c40c511995f04f9c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

db.enablePersistence().catch(err => {
  if (err.code === 'failed-precondition') console.warn('Persistencia: Múltiples tabs.');
  else if (err.code === 'unimplemented') console.warn('Persistencia: Navegador no compatible.');
});

const ADMIN_EMAIL = "solugansg@gmail.com";
const COLLECTION = "bovisal_registros";
const USER_COLL  = "bovisal_users";

// ─── CATEGORÍAS (orden fijo) ──────────────────────────────
const CATEGORIAS = [
  { cod: 'CH', nombre: 'Cría Hembra',        gr: 15  },
  { cod: 'HL', nombre: 'Hembra Levante',      gr: 50  },
  { cod: 'NV', nombre: 'Novilla Vientre',     gr: 60  },
  { cod: 'VP', nombre: 'Vaca Parida',         gr: 80  },
  { cod: 'VS', nombre: 'Vaca Seca',           gr: 80  },
  { cod: 'CM', nombre: 'Cría Macho',          gr: 15  },
  { cod: 'ML', nombre: 'Macho Levante',       gr: 40  },
  { cod: 'MC', nombre: 'Macho de Ceba',       gr: 50  },
  { cod: 'TR',  nombre: 'Toro / Reproductor',  gr: 70  },
];

// ─── ESTADO LOCAL ─────────────────────────────────────────
let state = {
  productos: [],        // [{ id: '123', nombre: 'Sal', pesoBulto: 40, costoBulto: 0, consumoGr: {} }]
  lotes: [],            // Array de 20 lotes con valores por categoría
  config: {},
  historico: [],
  selectedRecord: null, // Registro seleccionado en histórico
  currentUser: null,
  perfil: {},
};

// ─── SPINNER LOGIC (LONG PRESS) ───────────────────────────
let spinInterval = null;
let spinTimeout = null;

window.startSpin = function(e, actionFn) {
  if(e.cancelable) e.preventDefault();
  actionFn();
  spinTimeout = setTimeout(() => {
    spinInterval = setInterval(() => {
      actionFn();
    }, 70);
  }, 400);
};

window.stopSpin = function() {
  clearTimeout(spinTimeout);
  clearInterval(spinInterval);
};

// Inicializar consumoGr desde categorías por defecto
function initProductos() {
  let consumoGr = {};
  CATEGORIAS.forEach(c => {
    consumoGr[c.cod] = c.gr;
  });

  state.productos = [{
    id: Date.now().toString(),
    nombre: '',
    pesoBulto: '',
    costoBulto: '',
    consumoGr: consumoGr
  }];
}

// Inicializar arreglo vacío de lotes
function initLotes() {
  state.lotes = [];
}

// ─── AUTH STATE ──────────────────────────────────────────
auth.onAuthStateChanged(user => {
  const authContainer  = document.getElementById('auth-container');
  const appMainLayout  = document.getElementById('app-main-layout');
  const navAdmin       = document.getElementById('nav-admin');
  const sidebarConsultor = document.getElementById('sidebar-consultor');

  if (user) {
    state.currentUser = user;
    if (authContainer)  authContainer.style.display  = 'none';
    if (appMainLayout)  appMainLayout.style.display   = 'flex';

    // Abrir menú lateral por defecto en móviles al iniciar
    if (window.innerWidth <= 900) {
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar && !sidebar.classList.contains('active')) {
        sidebar.classList.add('active');
        if (overlay) overlay.style.display = 'block';
      }
    }

    // Cargar perfil del usuario desde Firestore
    db.collection(USER_COLL).doc(user.uid).get().then(docSnap => {
      if (docSnap.exists) {
        const data = docSnap.data();
        state.perfil = {
          nit:   data.nit   || '',
          name:  data.name  || data.nombre || user.displayName || '',
          email: data.email || user.email  || '',
          finca: data.finca || '',
          phone: data.phone || '',
          pais:  data.pais  || 'Colombia',
        };
        // Guardar en localStorage
        localStorage.setItem('bovisal_perfil', JSON.stringify(state.perfil));
      } else {
        // Guardar nuevo doc en users
        db.collection(USER_COLL).doc(user.uid).set({
          uid: user.uid,
          email: user.email,
          name: user.displayName || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(console.error);
      }

      const nameEl = document.getElementById('sidebar-consultor-name');
      const displayName = state.perfil.name || user.displayName || user.email || '';
      if (nameEl) nameEl.innerText = displayName.toUpperCase();
      if (sidebarConsultor) sidebarConsultor.style.display = 'block';

      // Incrementar accesos
      db.collection(USER_COLL).doc(user.uid).update({
        accessCount: firebase.firestore.FieldValue.increment(1),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});

    }).catch(console.error);

    // Configuración personal del usuario
    db.collection(USER_COLL).doc(user.uid).get().then(snap => {
      if (snap.exists) {
        const d = snap.data();
        if (d.configFinca)  { const el = document.getElementById('config-finca-default');  if (el) el.value = d.configFinca; }
        // Migración en nube
        if (!d.productos && d.consumoGr) {
           let consumoGr = {};
           CATEGORIAS.forEach(c => { consumoGr[c.cod] = d.consumoGr[c.cod] !== undefined ? d.consumoGr[c.cod] : c.gr; });
           state.productos = [{
             id: Date.now().toString(),
             nombre: d.configSal || 'Producto 1',
             pesoBulto: d.pesoBulto || 40,
             costoBulto: d.costoBulto || 0,
             consumoGr: consumoGr
           }];
        }
        if (d.configFinca)  { const el = document.getElementById('config-finca-default');  if (el) el.value = d.configFinca; }
        if (d.configResp)   { const el = document.getElementById('config-responsable-default'); if (el) el.value = d.configResp; }
      }
      
      // Sincronizar hacia los campos principales
      const salVal = document.getElementById('config-sal-nombre')?.value || '';
      const fincaVal = document.getElementById('config-finca-default')?.value || '';
      const respVal = document.getElementById('config-responsable-default')?.value || '';
      
      if (null)  null.value = salVal;
      if (null)  null.value = salVal;

      // Aplicar peso bulto
      const pbEl = document.getElementById('config-peso-bulto');
      if (pbEl) pbEl.value = state.pesoBulto;
      const cbEl = document.getElementById('config-costo-bulto');
      if (cbEl && state.costoBulto > 0) cbEl.value = state.costoBulto.toLocaleString('es-CO');
      actualizarLabelBulto();
      if (typeof calcularCostoSal === 'function') calcularCostoSal();
      renderConfigSal();
      renderRefTabla();
    }).catch(() => {
      renderConfigSal();
      renderRefTabla();
    });

    // Admin
    if (user.email === ADMIN_EMAIL) {
      if (navAdmin) navAdmin.style.display = 'inline-flex';
      cargarUsuariosAdmin();
    } else {
      if (navAdmin) navAdmin.style.display = 'none';
    }

    // Inicializar el formulario vacío, sin cargar datos previos
    state.lotes = [];
    if (document.getElementById('reg-fecha')) document.getElementById('reg-fecha').value = '';
    if (document.getElementById('reg-finca-reg')) document.getElementById('reg-finca-reg').value = '';
    if (document.getElementById('reg-responsable')) document.getElementById('reg-responsable').value = '';

    renderFormularioLoteInputs();
    renderTablalotes();
    calcularTotales();
    lucide.createIcons();

  } else {
    state.currentUser = null;
    if (authContainer)  authContainer.style.display  = 'flex';
    if (appMainLayout)  appMainLayout.style.display   = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
    lucide.createIcons();
  }
});

// ─── AUTH HELPERS ─────────────────────────────────────────
window.showLoginForm = function() {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display    = 'block';
};

window.showRegisterForm = function() {
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('login-form').style.display    = 'none';
};

window.handleRegister = function(event) {
  event.preventDefault();
  const nit   = document.getElementById('reg-nit').value.trim();
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const finca = document.getElementById('reg-finca').value.trim();
  const pais  = document.getElementById('reg-pais').value;
  const pass  = document.getElementById('reg-pass').value;

  if (pass.length < 6) { showToast('La contraseña debe tener mínimo 6 caracteres.', 'error'); return; }

  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerText = 'Registrando...';

  auth.createUserWithEmailAndPassword(email, pass)
    .then(cred => cred.user.updateProfile({ displayName: name }).then(() =>
      db.collection(USER_COLL).doc(cred.user.uid).set({
        uid: cred.user.uid, nit, name, email, phone, finca, pais,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
    ))
    .catch(err => {
      if (err.code === 'auth/email-already-in-use') {
        return auth.signInWithEmailAndPassword(email, pass)
          .then(cred => db.collection(USER_COLL).doc(cred.user.uid).set(
            { nit, name, email, phone, finca, pais, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          ));
      }
      btn.disabled = false; btn.innerText = 'REGISTRARSE Y EMPEZAR';
      showToast('Error: ' + traducirErrorFirebase(err.code), 'error');
    });
};

window.handleLogin = function(event) {
  event.preventDefault();
  const ident = document.getElementById('login-identificador').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const btn   = event.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.innerText = 'Iniciando sesión...';

  if (ident.includes('@')) {
    auth.signInWithEmailAndPassword(ident, pass)
      .catch(err => {
        btn.disabled = false; btn.innerText = 'INICIAR SESIÓN';
        showToast('Error: ' + traducirErrorFirebase(err.code), 'error');
      });
  } else {
    db.collection(USER_COLL).where('nit', '==', ident).limit(1).get()
      .then(snap => {
        if (snap.empty) throw { code: 'auth/user-not-found' };
        const email = snap.docs[0].data().email;
        return auth.signInWithEmailAndPassword(email, pass);
      })
      .catch(err => {
        btn.disabled = false; btn.innerText = 'INICIAR SESIÓN';
        showToast('Error: ' + traducirErrorFirebase(err.code), 'error');
      });
  }
};

window.handleLogout = function() {
  if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) return;
  auth.signOut().then(() => {
    localStorage.removeItem('bovisal_last_lotes');
    localStorage.removeItem('bovisal_perfil');
    location.reload();
  }).catch(console.error);
};

function traducirErrorFirebase(code) {
  const map = {
    'auth/email-already-in-use':    'El correo ya está en uso.',
    'auth/invalid-email':           'Correo inválido.',
    'auth/weak-password':           'Contraseña muy débil.',
    'auth/user-not-found':          'Usuario no encontrado.',
    'auth/wrong-password':          'Contraseña incorrecta.',
    'auth/too-many-requests':       'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed':  'Sin conexión a Internet.',
  };
  return map[code] || code;
}

// ─── NAVEGACIÓN ───────────────────────────────────────────
window.showSection = function(id, btn) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  
  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  
  // Sincronizar botones (sidebar y bottom nav)
  if (id === 'registro-lotes') {
    document.getElementById('nav-registro')?.classList.add('active');
    document.getElementById('bot-nav-registro')?.classList.add('active');
  } else if (id === 'dashboard') {
    document.getElementById('nav-dashboard')?.classList.add('active');
    document.getElementById('bot-nav-dashboard')?.classList.add('active');
  } else if (id === 'historico') {
    document.getElementById('nav-historico')?.classList.add('active');
    document.getElementById('bot-nav-historico')?.classList.add('active');
  } else if (id === 'configuracion') {
    document.getElementById('nav-config')?.classList.add('active');
  } else if (id === 'admin-users') {
    document.getElementById('nav-admin')?.classList.add('active');
  }

  // Acciones al cambiar pestaña
  if (id === 'dashboard') actualizarDashboard();
  if (id === 'historico') cargarHistorico();
  if (id === 'admin-users') cargarUsuariosAdmin();

  // Cerrar sidebar en móvil
  if (window.innerWidth <= 900) toggleSidebar(true);

  lucide.createIcons();
};

window.toggleSidebar = function(forceClose) {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  if (forceClose || sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
    if (overlay) overlay.style.display = 'none';
  } else {
    sidebar.classList.add('active');
    if (overlay) overlay.style.display = 'block';
  }
};

// ─── FORMULARIO LOTE ──────────────────────────────────────
function renderFormularioLoteInputs() {
  const selectProd = document.getElementById('nuevo-lote-producto');
  if (selectProd) {
    selectProd.innerHTML = state.productos.map(p => `<option value="${p.id}" style="background-color:#1e293b; color:#fff;">${p.nombre}</option>`).join('');
  }

  const container = document.getElementById('nuevo-lote-inputs');
  if (!container) return;
  container.innerHTML = CATEGORIAS.map(c => `
    <div style="background:rgba(0,0,0,0.15); border:1px solid rgba(16,185,129,0.1); border-radius:8px; padding:0.5rem 0.75rem; display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
      <div style="text-align:left; font-size:0.85rem; color:var(--accent); font-weight:800; line-height:1.2;">
        ${c.nombre}
        <div style="color:var(--text-muted); font-weight:400; font-size:0.75rem; margin-top:2px;">${c.gr}g</div>
      </div>
      <div class="spinner-wrap" style="display:flex; border-radius:6px; overflow:hidden; border:1px solid rgba(16,185,129,0.3); height:32px; background:rgba(0,0,0,0.2); width:120px;">
        <button class="spin-btn minus" onpointerdown="startSpin(event, () => spinFormLote('${c.cod}',-1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="padding:0 10px; color:var(--accent); cursor:pointer; background:none; border:none;">&#8722;</button>
        <input type="number" autocomplete="off" id="nuevo_lote_${c.cod}" class="cell-input" style="flex:1; min-width:0; color:var(--text-main); font-weight:700; text-align:center; padding:0; background:transparent; border:none;" placeholder="0" min="0" onkeydown="if(event.key==='Enter'){agregarLote();}">
        <button class="spin-btn plus" onpointerdown="startSpin(event, () => spinFormLote('${c.cod}',1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="padding:0 10px; color:var(--accent); cursor:pointer; background:none; border:none;">&#43;</button>
      </div>
    </div>
  `).join('');
}

window.spinFormLote = function(cod, delta) {
  const el = document.getElementById(`nuevo_lote_${cod}`);
  if (!el) return;
  el.value = Math.max(0, (parseInt(el.value) || 0) + delta);
};

window.agregarLote = function() {
  
  const inputNombre = document.getElementById('nuevo-lote-nombre');
  let nombre = inputNombre.value.trim() || `LOTE ${state.lotes.length + 1}`;
  
  const prodSelect = document.getElementById('nuevo-lote-producto');
  const productoId = prodSelect ? prodSelect.value : (state.productos[0] ? state.productos[0].id : null);
  const nuevoLote = { nombre, productoId };
  let tieneAnimales = false;
  
  CATEGORIAS.forEach(c => {
    const v = parseInt(document.getElementById(`nuevo_lote_${c.cod}`)?.value) || 0;
    nuevoLote[c.cod] = v;
    if (v > 0) tieneAnimales = true;
  });
  
  if (!tieneAnimales && !confirm('¿Estás seguro de agregar un lote sin animales?')) {
    return;
  }
  
  state.lotes.push(nuevoLote);
  limpiarFormularioLote();
  renderTablalotes();
  calcularTotales();
  autoGuardarLocal();
  showToast('Lote agregado', 'success');
};

window.limpiarFormularioLote = function() {
  const n = document.getElementById('nuevo-lote-nombre');
  if (n) { n.value = ''; n.focus(); }
  CATEGORIAS.forEach(c => {
    const el = document.getElementById(`nuevo_lote_${c.cod}`);
    if (el) el.value = '';
  });
};

window.eliminarLote = function(idx) {
  if (!confirm(`¿Eliminar ${state.lotes[idx].nombre}?`)) return;
  state.lotes.splice(idx, 1);
  renderTablalotes();
  calcularTotales();
  autoGuardarLocal();
};

// ─── RENDER TABLA LOTES ──────────────────────────────────
function renderTablalotes() {
  const tbody = document.getElementById('tbody-lotes');
  const emptyState = document.getElementById('lotes-empty-state');
  const tableWrap = document.getElementById('tabla-lotes-wrap');
  const lblTotalLotes = document.getElementById('lbl-total-lotes');
  const lblFormLotes = document.getElementById('contador-lotes-form');
  
  if (!tbody) return;
  
  if (lblTotalLotes) lblTotalLotes.textContent = state.lotes.length;
  if (lblFormLotes) lblFormLotes.textContent = `(${state.lotes.length} lotes)`;
  
  if (state.lotes.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (tableWrap) tableWrap.style.display = 'none';
    tbody.innerHTML = '';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
    
    tbody.innerHTML = '';
    state.lotes.forEach((lote, i) => {
      const tr = document.createElement('tr');

      // Nombre lote
      const tdNombre = document.createElement('td');
      tdNombre.className = 'lote-name';
      tdNombre.innerHTML = `<span style="color:var(--text-muted);font-size:0.72rem;">${i+1}.</span> <input type="text" autocomplete="off" value="${lote.nombre}" style="background:transparent;border:none;color:var(--text-main);font-weight:700;width:80px;" onchange="onLoteNameChange(${i}, this.value)">`;
      tr.appendChild(tdNombre);
      const tdProd = document.createElement('td');
      const prod = state.productos.find(p => p.id === lote.productoId);
      tdProd.innerHTML = `<select onchange="onLoteProductoChange(${i}, this.value)" style="background:var(--bg-input);border:1px solid rgba(16,185,129,0.4);border-radius:4px;color:var(--text-main);font-size:0.75rem;padding:0.3rem;min-width:130px;width:auto;max-width:160px;text-overflow:ellipsis;">
        ${state.productos.map(p => `<option value="${p.id}" style="background-color:#1e293b; color:#fff;" ${p.id === lote.productoId ? 'selected' : ''}>${p.nombre}</option>`).join('')}
      </select>`;
      tr.appendChild(tdProd);

      // Inputs por categoría
      CATEGORIAS.forEach(cat => {
        const td = document.createElement('td');
        td.innerHTML = `<input type="number" autocomplete="off" class="lote-input" id="lote${i}_${cat.cod}" value="${lote[cat.cod] || 0}" min="0" oninput="onLoteInput(${i},'${cat.cod}',this.value)" onwheel="this.blur()">`;
        tr.appendChild(td);
      });

      // Total animales (calculado)
      const tdTotalAnim = document.createElement('td');
      tdTotalAnim.className = 'lote-total';
      tdTotalAnim.id = `row${i}_total`;
      tdTotalAnim.textContent = '0';
      tr.appendChild(tdTotalAnim);

      // Gr sal / día (calculado)
      const tdSalGr = document.createElement('td');
      tdSalGr.className = 'lote-sal';
      tdSalGr.id = `row${i}_gr`;
      tdSalGr.textContent = '0';
      tr.appendChild(tdSalGr);

      // Kg sal / mes (calculado)
      const tdKgMes = document.createElement('td');
      tdKgMes.className = 'lote-kilos';
      tdKgMes.id = `row${i}_kgmes`;
      tdKgMes.textContent = '0.0';
      tr.appendChild(tdKgMes);

      // Acción (Eliminar)
      const tdAccion = document.createElement('td');
      tdAccion.innerHTML = `<button onclick="eliminarLote(${i})" style="background:transparent;border:none;color:#ef4444;cursor:pointer;padding:4px;" title="Eliminar lote">✕</button>`;
      tr.appendChild(tdAccion);

      tbody.appendChild(tr);
    });
  }

  calcularTotales();
}

window.onLoteNameChange = function(loteIdx, val) {
  state.lotes[loteIdx].nombre = val.trim();
  autoGuardarLocal();
};

// Input de lote cambiado
window.onLoteInput = function(loteIdx, cod, val) {
  const v = parseInt(val) || 0;
  state.lotes[loteIdx][cod] = v;
  calcularTotales();
  autoGuardarLocal();
};

// ─── CALCULAR TOTALES ─────────────────────────────────────
window.calcularTotales = function() {
  let totalAnimalesFinca = 0;
  let totalGrDia = 0;
  let lotesActivos = 0;

  // Totales por categoría (columnas)
  const totalesCat = {};
  const salPorCat = {};
  CATEGORIAS.forEach(c => { totalesCat[c.cod] = 0; salPorCat[c.cod] = 0; });
  const totalesPorProducto = {};

  for (let i = 0; i < state.lotes.length; i++) {
    const lote = state.lotes[i];
    let loteAnim = 0;
    let loteGr   = 0;
    
    let prod = state.productos.find(p => p.id === lote.productoId) || state.productos[0] || {consumoGr:{}};

    CATEGORIAS.forEach(c => {
      const v = parseInt(lote[c.cod]) || 0;
      loteAnim += v;
      const grCat = v * (prod.consumoGr[c.cod] !== undefined ? prod.consumoGr[c.cod] : c.gr);
      loteGr += grCat;
      totalesCat[c.cod] += v;
      salPorCat[c.cod] += grCat;
    });

    if (!totalesPorProducto[prod.id]) {
      totalesPorProducto[prod.id] = { nombre: prod.nombre, pesoBulto: parseInt(prod.pesoBulto)||40, costoBulto: parseInt(String(prod.costoBulto).replace(/\D/g, ''))||0, totalGrDia: 0, totalAnim: 0 };
    }
    totalesPorProducto[prod.id].totalGrDia += loteGr;
    totalesPorProducto[prod.id].totalAnim += loteAnim;

    // Actualizar fila
    const tdAnim  = document.getElementById(`row${i}_total`);
    const tdGr    = document.getElementById(`row${i}_gr`);
    const tdKgMes = document.getElementById(`row${i}_kgmes`);
    if (tdAnim)  tdAnim.textContent  = loteAnim;
    if (tdGr)    tdGr.textContent    = loteGr.toLocaleString('es-CO');
    if (tdKgMes) tdKgMes.textContent = ((loteGr / 1000) * 30).toFixed(1);

    totalAnimalesFinca += loteAnim;
    totalGrDia         += loteGr;
    if (loteAnim > 0) lotesActivos++;
  }

  const totalKgDia = totalGrDia / 1000;
  const totalKgMes = totalKgDia * 30;
  
  let bultosAl = 0;
  let costoMensual = 0;
  Object.values(totalesPorProducto).forEach(p => {
    const kgDia = p.totalGrDia / 1000;
    const kgMes = kgDia * 30;
    const bm = p.pesoBulto > 0 ? (kgMes / p.pesoBulto) : 0;
    bultosAl += bm;
    costoMensual += (bm * p.costoBulto);
  });

  // Actualizar footer de tabla
  CATEGORIAS.forEach(c => {
    const el = document.getElementById(`total-${c.cod}`);
    if (el) el.textContent = totalesCat[c.cod];
  });
  setVal('total-general', totalAnimalesFinca);
  setVal('total-gr-dia',  totalGrDia.toLocaleString('es-CO'));
  setVal('total-kg-mes',  totalKgMes.toFixed(1));

  // Resumen rápido
  setVal('r-total-animales', totalAnimalesFinca);
  setVal('r-total-lotes',    lotesActivos);
  setVal('r-sal-gr-dia',     totalGrDia.toLocaleString('es-CO'));
  setVal('r-sal-kg-dia',     totalKgDia.toFixed(2));
  setVal('r-sal-kg-mes',     totalKgMes.toFixed(1));
  setVal('r-bultos-mes',     bultosAl.toFixed(1));

  // Estado para dashboard
  state.cachedTotales = {
    totalAnimalesFinca, totalGrDia, totalKgDia, totalKgMes, bultosAl, costoMensual,
    lotesActivos, totalesCat, totalesPorProducto, salPorCat
  };
};

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── AUTO-GUARDAR LOCAL ───────────────────────────────────
let autoSaveTimer = null;
function autoGuardarLocal() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    localStorage.setItem('bovisal_last_lotes', JSON.stringify(state.lotes));
    const fecha = document.getElementById('reg-fecha')?.value       || '';
    const finca = document.getElementById('reg-finca-reg')?.value   || '';
    const resp  = document.getElementById('reg-responsable')?.value || '';
    const sal   = null?.value  || '';
    localStorage.setItem('bovisal_last_fecha', fecha);
    localStorage.setItem('bovisal_last_finca', finca);
    localStorage.setItem('bovisal_last_resp',  resp);
    localStorage.setItem('bovisal_last_sal',   sal);
  }, 400);
}

// ─── GUARDAR REGISTRO EN FIRESTORE ───────────────────────
window.guardarRegistro = function() {
    if (!state.currentUser) { showToast('Debes iniciar sesión.', 'error'); return; }
  
    const fecha       = document.getElementById('reg-fecha')?.value       || '';
    const fincaNombre = document.getElementById('reg-finca-reg')?.value   || '';
    const responsable = document.getElementById('reg-responsable')?.value || '';
  
    if (!fecha)       { showToast('Por favor ingresa la fecha.', 'error');       return; }
    if (!fincaNombre) { showToast('Por favor ingresa el nombre de la finca.', 'error'); return; }
  
    const t = state.cachedTotales || {};
  
    const registro = {
      uid:          state.currentUser.uid,
      userNit:      state.perfil?.nit || '',
      userName:     state.perfil?.name || state.currentUser.displayName || state.currentUser.email || '',
      fecha,
      fincaNombre,
      salNombre:    'Varios Productos',
      responsable,
      lotes:        JSON.parse(JSON.stringify(state.lotes || [])),
      productos:    JSON.parse(JSON.stringify(state.productos || [])),
      totalAnimales: t.totalAnimalesFinca || 0,
      totalGrDia:    t.totalGrDia || 0,
      totalKgMes:    t.totalKgMes || 0,
      bultosAl:      t.bultosAl || 0,
      lotesActivos:  t.lotesActivos || 0,
      totalesCat:    t.totalesCat || {},
      totalesPorProducto: t.totalesPorProducto || {},
      salPorCat:     t.salPorCat || {},
      createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
      version:       '260701.14'
    };
  
    db.collection(COLLECTION).add(registro)
      .then(() => {
        showToast('✅ Registro guardado correctamente.', 'success');
        autoGuardarLocal();
      })
      .catch(err => {
        console.error(err);
        showToast('Error al guardar. Verifica la conexión.', 'error');
      });
  };

  // ─── LIMPIAR LOTES ───────────────────────────────────────
window.limpiarLotes = function() {
  if (!confirm('¿Limpiar todos los lotes y reiniciar la tabla?')) return;
  initLotes();

  const configSal = document.getElementById('config-sal-nombre')?.value || '';
  const configFinca = document.getElementById('config-finca-default')?.value || '';
  const configResp = document.getElementById('config-responsable-default')?.value || '';

  if (document.getElementById('reg-finca-reg')) document.getElementById('reg-finca-reg').value = '';
  if (document.getElementById('reg-responsable')) document.getElementById('reg-responsable').value = '';
  if (null) null.value = '';

  renderTablalotes();
  autoGuardarLocal();
  showToast('Tabla limpiada y valores por defecto aplicados.', 'info');
};

// ─── DASHBOARD ───────────────────────────────────────────
function actualizarDashboard() {
  const t = state.cachedTotales || {};

  setVal('dash-total-animales', t.totalAnimalesFinca || 0);
  setVal('dash-sal-gr',   t.totalGrDia ? t.totalGrDia.toLocaleString('es-CO') : '0');
  setVal('dash-sal-kg-dia',  t.totalKgDia  ? t.totalKgDia.toFixed(2)  : '0.0');
  setVal('dash-sal-kg-mes',  t.totalKgMes  ? t.totalKgMes.toFixed(1)  : '0.0');
  setVal('dash-bultos', t.bultosAl ? t.bultosAl.toFixed(1) : '0.0');
  setVal('dash-lotes-activos', t.lotesActivos || 0);
  setVal('dash-bultos-unit', 'Bultos totales');
  setVal('dash-costo-mes', t.costoMensual ? `$${Math.round(t.costoMensual).toLocaleString('es-CO')}` : '$0');

  // Info finca
  const finca = document.getElementById('reg-finca-reg')?.value   || '—';
  const fecha = document.getElementById('reg-fecha')?.value       || '';
  const resp  = document.getElementById('reg-responsable')?.value || '';
  setVal('dash-finca-nombre',   finca);
  setVal('dash-fecha-registro', fecha ? `Fecha: ${fecha}` : 'Sin fecha');
  setVal('dash-responsable',    resp  ? `Responsable: ${resp}` : '');

  // Inventario por categoría
  renderDashCategorias(t.totalesCat || {}, t.totalAnimalesFinca || 1);
  // Consumo sal por categoría
  renderDashSalCategorias(t.salPorCat || {});

  // Tarjetas por producto
  if(typeof renderDashProductos === 'function') {
    renderDashProductos(t.totalesPorProducto || {});
  }
}

function renderDashCategorias(totalesCat, totalAnimales) {
  const div = document.getElementById('dash-categorias');
  if (!div) return;
  const colors = ['#10b981','#0ea5e9','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316','#6366f1'];
  div.innerHTML = '';
  CATEGORIAS.forEach((c, idx) => {
    const n = totalesCat[c.cod] || 0;
    if (n === 0 && totalAnimales > 1) return; // Ocultar vacíos salvo que todo sea 0
    const pct = totalAnimales > 0 ? ((n / totalAnimales) * 100).toFixed(1) : 0;
    const col = colors[idx % colors.length];
    div.innerHTML += `
      <div class="cat-row">
        <span class="cat-code" style="color:${col};">${c.cod}</span>
        <span class="cat-name">${c.nombre}</span>
        <span class="cat-count">${n}</span>
        <div style="flex:1;margin:0 0.75rem;background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden;">
          <div style="width:${pct}%;background:${col};height:100%;border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:40px;text-align:right;">${pct}%</span>
      </div>`;
  });
  if (!div.innerHTML) div.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:2rem;">Sin datos registrados aún.</p>';
}

function renderDashSalCategorias(salPorCat) {
  const div = document.getElementById('dash-sal-categorias');
  if (!div) return;
  let totalSalGr = 0;
  CATEGORIAS.forEach(c => {
    totalSalGr += (salPorCat[c.cod] || 0);
  });

  const colors = ['#a78bfa','#60a5fa','#f59e0b','#ef4444','#10b981','#ec4899','#14b8a6','#f97316','#6366f1'];
  div.innerHTML = '';
  CATEGORIAS.forEach((c, idx) => {
    const gr  = salPorCat[c.cod];
    if (gr === 0) return;
    const pct = totalSalGr > 0 ? ((gr / totalSalGr) * 100).toFixed(1) : 0;
    const col = colors[idx % colors.length];
    div.innerHTML += `
      <div class="cat-row">
        <span class="cat-code" style="color:${col};">${c.cod}</span>
        <span class="cat-name">${c.nombre}</span>
        <span class="cat-sal" style="color:${col};min-width:80px;">${gr.toLocaleString('es-CO')} gr</span>
        <div style="flex:1;margin:0 0.5rem;background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden;">
          <div style="width:${pct}%;background:${col};height:100%;border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted);min-width:40px;text-align:right;">${pct}%</span>
      </div>`;
  });
  if (!div.innerHTML) div.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:2rem;">Sin datos de consumo aún.</p>';
}

// ─── HISTÓRICO ───────────────────────────────────────────
window.cargarHistorico = function() {
  if (!state.currentUser) return;
  const lista = document.getElementById('historico-lista');
  lista.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Cargando...</div>';

  const isAdmin = state.currentUser.email === ADMIN_EMAIL;
  let query = db.collection(COLLECTION);
  
  if (!isAdmin) {
    query = query.where('uid', '==', state.currentUser.uid);
  } else {
    query = query.orderBy('createdAt', 'desc').limit(100);
  }

  query.get().then(snap => {
    state.historico = [];
    snap.forEach(doc => state.historico.push({ id: doc.id, ...doc.data() }));
    // Ordenar localmente por la fecha que registró el usuario (r.fecha)
    state.historico.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    renderHistorico(state.historico);
  }).catch(err => {
    console.error(err);
    lista.innerHTML = '<div style="text-align:center;padding:2rem;color:#ef4444;">Error cargando registros. Verifica conexión.</div>';
  });
};

function renderHistorico(registros) {
  const lista = document.getElementById('historico-lista');
  if (!lista) return;
  if (!registros.length) {
    lista.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);"><i data-lucide="inbox" style="width:40px;height:40px;opacity:0.3;margin-bottom:1rem;display:block;margin-left:auto;margin-right:auto;"></i><p>No hay registros guardados aún.</p></div>';
    lucide.createIcons();
    return;
  }

  lista.innerHTML = registros.map((r, idx) => {
    const fecha = r.fecha || '—';
    const finca = r.fincaNombre || '—';
    const resp  = r.responsable  || '';
    const anim  = r.totalAnimales  || 0;
    const kgMes = r.totalKgMes ? r.totalKgMes.toFixed(1) : '0.0';
    const bultos= r.bultosAl    ? r.bultosAl.toFixed(1) : '0.0';
    return `
      <div class="historico-card" onclick="abrirDetalleHistorico(${idx})">
        <div class="hc-date">${fecha}</div>
        <div class="hc-finca">${finca}</div>
        ${resp ? `<div style="font-size:0.78rem;color:var(--text-muted);">Responsable: ${resp}</div>` : ''}
        <div class="hc-meta">
          <span>🐄 <strong>${anim}</strong> animales</span>
          <span>⚖️ <strong>${kgMes}</strong> kg/mes</span>
          <span>📦 <strong>${bultos}</strong> bultos</span>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid rgba(255,255,255,0.05);padding-top:0.75rem;">
          <button class="btn-outline-action btn-cargar" onclick="accionDirecta(event, ${idx}, 'cargar')">
            <i data-lucide="eye" style="width:14px;height:14px;"></i> CARGAR
          </button>
          <button class="btn-outline-action btn-excel" onclick="accionDirecta(event, ${idx}, 'excel')">
            <i data-lucide="file-spreadsheet" style="width:14px;height:14px;"></i> EXCEL
          </button>
          <button class="btn-outline-action btn-eliminar" onclick="accionDirecta(event, ${idx}, 'eliminar')">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i> ELIMINAR
          </button>
        </div>
      </div>`;
  }).join('');
  
  // Renderizar los iconos de lucide añadidos dinámicamente
  setTimeout(() => {
    if (window.lucide) lucide.createIcons();
  }, 10);
}

window.accionDirecta = function(event, idx, tipo) {
  event.stopPropagation();
  state.selectedRecord = state.historico[idx];
  if (tipo === 'cargar') cargarRegistroEnFormulario();
  if (tipo === 'excel') exportarExcelModal();
  if (tipo === 'eliminar') eliminarRegistro();
};

window.filtrarHistorico = function() {
  const normalizar = (txt) => (txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  const q     = normalizar(document.getElementById('hist-buscar-finca')?.value);
  const fecha = document.getElementById('hist-fecha')?.value || '';
  
  let filtrado = state.historico.filter(r => {
    const terminos = normalizar([
      r.fincaNombre || '',
      r.responsable || '',
      r.userNit || '',
      r.userName || ''
    ].join(' '));

    const okFinca = !q || terminos.includes(q);
    const okFecha = !fecha || r.fecha === fecha;
    return okFinca && okFecha;
  });
  renderHistorico(filtrado);
};

window.limpiarFiltrosHistorico = function() {
  const f = document.getElementById('hist-buscar-finca');
  const d = document.getElementById('hist-fecha');
  if (f) f.value = '';
  if (d) d.value = '';
  renderHistorico(state.historico);
};

window.abrirDetalleHistorico = function(idx) {
  state.selectedRecord = state.historico[idx];
  const r = state.selectedRecord;
  const modal = document.getElementById('modal-historico');
  const content = document.getElementById('modal-historico-content');

  const t = r.totalesCat || {};
  const cats = CATEGORIAS.map(c => `<span style="margin-right:0.75rem;font-size:0.82rem;"><strong style="color:var(--accent);">${c.cod}:</strong> ${t[c.cod] || 0}</span>`).join('');

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;">
      <div><div style="font-size:0.72rem;color:var(--text-muted);">FINCA</div><div style="font-weight:700;">${r.fincaNombre || '—'}</div></div>
      <div><div style="font-size:0.72rem;color:var(--text-muted);">FECHA</div><div style="font-weight:700;">${r.fecha || '—'}</div></div>
      <div><div style="font-size:0.72rem;color:var(--text-muted);">SAL</div><div style="font-weight:700;color:var(--salt-color);">${r.salNombre || '—'}</div></div>
      <div><div style="font-size:0.72rem;color:var(--text-muted);">RESPONSABLE</div><div style="font-weight:700;">${r.responsable || '—'}</div></div>
      <div style="grid-column: span 2;"><div style="font-size:0.72rem;color:var(--text-muted);">LOTES ACTIVOS</div><div style="font-weight:700;">${r.lotesActivos || 0}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:1.25rem;">
      <div class="resumen-card" style="border-top:3px solid var(--accent);padding:0.75rem;">
        <span class="rc-label" style="font-size:0.65rem;">Total Animales</span>
        <div class="rc-value text-accent" style="font-size:1.2rem;">${r.totalAnimales || 0}</div>
      </div>
      <div class="resumen-card" style="border-top:3px solid var(--salt-color);padding:0.75rem;">
        <span class="rc-label" style="font-size:0.65rem;">Kg Sal/Mes</span>
        <div class="rc-value" style="font-size:1.2rem;color:var(--salt-color);">${(r.totalKgMes||0).toFixed(1)}</div>
      </div>
      <div class="resumen-card" style="border-top:3px solid #ef4444;padding:0.75rem;">
        <span class="rc-label" style="font-size:0.65rem;">Bultos/Mes</span>
        <div class="rc-value" style="font-size:1.2rem;color:#ef4444;">${(r.bultosAl||0).toFixed(1)}</div>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:0.75rem;font-size:0.82rem;">
      <div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:0.5rem;font-weight:700;">INVENTARIO POR CATEGORÍA</div>
      ${cats}
    </div>`;

  modal.classList.add('open');
  lucide.createIcons();
};

window.cerrarModalHistorico = function() {
  document.getElementById('modal-historico').classList.remove('open');
};

window.cargarRegistroEnFormulario = function() {
  const r = state.selectedRecord;
  if (!r) return;
  if (Array.isArray(r.lotes)) {
    state.lotes = JSON.parse(JSON.stringify(r.lotes));
    if (r.consumoGr) Object.assign(state.consumoGr, r.consumoGr);
    if (r.pesoBulto) {
      state.pesoBulto = r.pesoBulto;
      const el = document.getElementById('config-peso-bulto');
      if (el) el.value = r.pesoBulto;
      actualizarLabelBulto();
    }

    // Cargar encabezado
    if (r.fecha && document.getElementById('reg-fecha'))       document.getElementById('reg-fecha').value = r.fecha;
    if (r.fincaNombre && document.getElementById('reg-finca-reg')) document.getElementById('reg-finca-reg').value = r.fincaNombre;
    if (r.salNombre && null)  null.value = r.salNombre;
    if (r.responsable && document.getElementById('reg-responsable')) document.getElementById('reg-responsable').value = r.responsable;

    renderTablalotes();
    cerrarModalHistorico();
    showSection('registro-lotes', document.getElementById('nav-registro'));
    showToast('Registro cargado en el formulario.', 'success');
  }
};

window.eliminarRegistro = function() {
  const r = state.selectedRecord;
  if (!r) return;
  if (!confirm('¿Eliminar este registro permanentemente?')) return;
  db.collection(COLLECTION).doc(r.id).delete()
    .then(() => {
      showToast('Registro eliminado.', 'info');
      cerrarModalHistorico();
      cargarHistorico();
    }).catch(err => {
      console.error(err);
      showToast('Error al eliminar.', 'error');
    });
};

// ─── CONFIGURACIÓN ────────────────────────────────────────
window.guardarConfig = function() {
  const pb = parseInt(document.getElementById('config-peso-bulto')?.value) || 40;
  state.pesoBulto = pb;
  
  const cbEl = document.getElementById('config-costo-bulto');
  const cbStr = cbEl ? String(cbEl.value).replace(/\D/g, '') : '';
  const cb = parseInt(cbStr) || 0;
  state.costoBulto = cb;

  actualizarLabelBulto();
  calcularTotales();
  if (typeof calcularCostoSal === 'function') calcularCostoSal();

  const salVal   = document.getElementById('config-sal-nombre')?.value || '';
  const fincaVal = document.getElementById('config-finca-default')?.value  || '';
  const respVal  = document.getElementById('config-responsable-default')?.value || '';

  // Sincronizar instantáneamente con los campos de la pantalla principal
  if (null)  null.value = salVal;
  if (document.getElementById('reg-finca-reg'))   document.getElementById('reg-finca-reg').value  = fincaVal;
  if (document.getElementById('reg-responsable')) document.getElementById('reg-responsable').value = respVal;

  if (!state.currentUser) return;
  const cfg = {
    pesoBulto:   pb,
    costoBulto:  cb,
    consumoGr:   state.consumoGr,
    configSal:   salVal,
    configFinca: fincaVal,
    configResp:  respVal,
  };
  db.collection(USER_COLL).doc(state.currentUser.uid).set(cfg, { merge: true }).catch(console.error);
};

window.calcularCostoSal = function() {
  const elCosto = document.getElementById('config-costo-bulto');
  if (!elCosto) return;
  const costoStr = String(elCosto.value).replace(/\D/g, '');
  const costo = parseInt(costoStr) || 0;
  state.costoBulto = costo;
  
  const peso = state.pesoBulto || 40;
  let costoKilo = 0;
  let costoGramo = 0;
  
  if (peso > 0) {
    costoKilo = costo / peso;
    costoGramo = costoKilo / 1000;
  }
  
  const lblKilo = document.getElementById('lbl-costo-kilo');
  const lblGramo = document.getElementById('lbl-costo-gramo');
  
  if (lblKilo) lblKilo.textContent = '$ ' + costoKilo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (lblGramo) lblGramo.textContent = '$ ' + costoGramo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

window.spinConfig = function(id, delta, minVal = 1, defaultVal = 40) {
  const el = document.getElementById(id);
  if (!el) return;
  let valorStr = String(el.value).replace(/\D/g, '');
  let nuevoValor = Math.max(minVal, (parseInt(valorStr) || defaultVal) + delta);
  if (id === 'config-costo-bulto') {
    el.value = nuevoValor.toLocaleString('es-CO');
    calcularCostoSal();
  } else {
    el.value = nuevoValor;
  }
  guardarConfig();
};

window.formatoMoneda = function(input) {
  let originalLength = input.value.length;
  let cursorPosition = input.selectionStart;
  
  let valorStr = input.value.replace(/\D/g, '');
  if (!valorStr) {
    input.value = '';
    calcularCostoSal();
    return;
  }
  
  let valorNum = parseInt(valorStr, 10);
  input.value = valorNum.toLocaleString('es-CO');
  
  let newLength = input.value.length;
  cursorPosition = cursorPosition + (newLength - originalLength);
  input.setSelectionRange(cursorPosition, cursorPosition);
  
  calcularCostoSal();
};

function actualizarLabelBulto() {
  const labels = document.querySelectorAll('#lbl-peso-bulto, #r-bultos-unit, #dash-bultos-unit');
  labels.forEach(el => {
    if (el.id === 'lbl-peso-bulto') el.textContent = '';
    else el.textContent = 'Bultos totales';
  });
}

window.aplicarDefaults = function() {
  const sal   = document.getElementById('config-sal-nombre')?.value     || '';
  const finca = document.getElementById('config-finca-default')?.value  || '';
  const resp  = document.getElementById('config-responsable-default')?.value || '';
  if (sal   && null)    null.value  = sal;
  if (finca && document.getElementById('reg-finca-reg'))     document.getElementById('reg-finca-reg').value   = finca;
  if (resp  && document.getElementById('reg-responsable'))   document.getElementById('reg-responsable').value = resp;
  guardarConfig();
  showToast('Valores por defecto aplicados.', 'success');
};

// ─── TABLA REFERENCIA (sección Registro) ─────────────────
function renderRefTabla() {
  const tbody = document.getElementById('ref-tbody');
  if (!tbody) return;
  tbody.innerHTML = CATEGORIAS.map(c => `
    <tr>
      <td>${c.nombre}</td>
      <td style="font-weight:700;color:var(--accent);">${c.cod}</td>
      <td style="font-weight:800;color:var(--salt-color);">${state.consumoGr[c.cod] || c.gr} gr</td>
    </tr>`).join('');
}

// ─── TABLA CONFIGURACIÓN SAL ──────────────────────────────
function renderConfigSal() {
  const tbody = document.getElementById('config-sal-tbody');
  if (!tbody) return;
  tbody.innerHTML = CATEGORIAS.map(c => `
    <tr>
      <td>${c.nombre}</td>
      <td style="font-weight:700;color:var(--accent);">${c.cod}</td>
      <td>
        <div class="spinner-wrap" style="display:inline-flex;border-radius:8px;border-color:rgba(167,139,250,0.3);">
          <button class="spin-btn minus" onpointerdown="startSpin(event, () => spinGr('${c.cod}',-1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="color:var(--salt-color);">&#8722;</button>
          <input type="number" autocomplete="off" class="ref-gr-input cell-input" id="cfg_${c.cod}" value="${state.consumoGr[c.cod] || c.gr}" min="1" style="width:64px;color:var(--salt-color);font-weight:800;" onchange="onConfigSalChange('${c.cod}',this.value)">
          <button class="spin-btn plus" onpointerdown="startSpin(event, () => spinGr('${c.cod}',1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="color:var(--salt-color);">&#43;</button>
        </div>
      </td>
    </tr>`).join('');
}

window.spinGr = function(cod, delta) {
  const el = document.getElementById(`cfg_${cod}`);
  if (!el) return;
  const newVal = Math.max(1, (parseInt(el.value) || 1) + delta);
  el.value = newVal;
  onConfigSalChange(cod, newVal);
};

window.onConfigSalChange = function(cod, val) {
  state.consumoGr[cod] = parseInt(val) || 1;
  calcularTotales();
};

window.guardarTablaConsumo = function() {
  localStorage.setItem('bovisal_consumo_gr', JSON.stringify(state.consumoGr));
  guardarConfig();
  renderRefTabla();
  showToast('Tabla de consumo guardada.', 'success');
};

window.restaurarTablaConsumo = function() {
  if (!confirm('¿Restaurar los valores por defecto de consumo de sal?')) return;
  CATEGORIAS.forEach(c => { state.consumoGr[c.cod] = c.gr; });
  renderConfigSal();
  calcularTotales();
  renderRefTabla();
  showToast('Valores restaurados.', 'info');
};

// ─── EXPORTAR EXCEL ───────────────────────────────────────
window.exportarExcel = function(registroData) {
    try {
      const r = registroData || null;
      const fecha   = r ? r.fecha        : (document.getElementById('reg-fecha')?.value       || 'sin-fecha');
      const finca   = r ? r.fincaNombre  : (document.getElementById('reg-finca-reg')?.value   || 'Finca');
      const resp    = r ? r.responsable  : (document.getElementById('reg-responsable')?.value || '');
      const lotes   = r ? (r.lotes || []) : state.lotes;
      const productos = r ? (r.productos || state.productos) : state.productos;
      const bultosAl = r ? (r.bultosAl || 0) : (state.cachedTotales?.bultosAl || 0);
  
      const XLSX = window.XLSX;
      let data = [];
      
      const logoText = "BOVISAL CONTROL PRO";
      
      const numCols = 5 + CATEGORIAS.length;
      const headerBlanks = Array(numCols - 1).fill('');
      
      data.push([logoText, "REPORTE DE INVENTARIO Y CONSUMO - BOVISAL CONTROL PRO", ...headerBlanks.slice(1)]);
      
      let fechaF = fecha;
      if (fecha && fecha.includes('-')) {
        const parts = fecha.split('-');
        if (parts.length === 3) fechaF = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      
      data.push(["Fecha de Registro:", fechaF, "Responsable:", resp, ...Array(numCols - 4).fill('')]);
      data.push(["Finca:", finca, "", "", ...Array(numCols - 4).fill('')]);
      data.push([]);
      
      data.push(["RESUMEN DE CONSUMO (DASHBOARD)", ...headerBlanks]);
      data.push(["Bultos/Mes Proyectados:", bultosAl.toFixed(1) + ' bultos', ...Array(numCols - 2).fill('')]);
      data.push([]);
      
      data.push(["DETALLE POR LOTE Y CATEGORÍA", ...headerBlanks]);
      data.push(["LOTE", "PRODUCTO", ...CATEGORIAS.map(c => c.cod.toUpperCase()), "TOTAL ANIMALES", "GR SAL/DÍA", "KG SAL/MES"]);
      
      let totalAnim = 0; let totalGr = 0;
      const totCat = {};
      CATEGORIAS.forEach(c => { totCat[c.cod] = 0; });
  
      for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i];
        let loteAnim = 0; let loteGr = 0;
        let prod = productos.find(p => p.id === lote.productoId) || productos[0] || {consumoGr:{}};
        
        const rowData = [lote.nombre || `LOTE ${i+1}`, prod.nombre || ''];
        CATEGORIAS.forEach(c => {
          const v = parseInt(lote[c.cod]) || 0;
          rowData.push(v);
          loteAnim += v;
          loteGr   += v * (prod.consumoGr[c.cod] !== undefined ? prod.consumoGr[c.cod] : c.gr);
          totCat[c.cod] += v;
        });
        rowData.push(loteAnim, loteGr, Number(((loteGr/1000)*30).toFixed(1)));
        data.push(rowData);
        totalAnim += loteAnim;
        totalGr   += loteGr;
      }
  
      const kgMes = Number((totalGr/1000*30).toFixed(1));
      data.push(['TOTALES', '', ...CATEGORIAS.map(c => totCat[c.cod]), totalAnim, totalGr, kgMes]);
  
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: {r:0, c:1}, e: {r:0, c:numCols - 1} });
      
      let cols = [{wch: 22}, {wch: 28}];
      CATEGORIAS.forEach(() => cols.push({wch: 10}));
      cols.push({wch: 16}, {wch: 14}, {wch: 14});
      ws['!cols'] = cols;
      
      ws['!rows'] = [];
      ws['!rows'][0] = { hpt: 60 };
      
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({c:C, r:R});
          if (!ws[cellRef]) continue;
          const val = ws[cellRef].v;
          
          let style = {
            font: { name: "Arial", sz: 10, color: { rgb: "333333" } },
            alignment: { vertical: "center", wrapText: true },
            border: { top: {style: "thin", color: {rgb: "E2E8F0"}}, bottom: {style: "thin", color: {rgb: "E2E8F0"}}, left: {style: "thin", color: {rgb: "E2E8F0"}}, right: {style: "thin", color: {rgb: "E2E8F0"}} }
          };
          
          if (R === 0) {
            style.fill = { fgColor: { rgb: "0F4C81" } };
            style.alignment = { horizontal: "center", vertical: "center" };
            style.font = C === 0 ? { name: "Arial", sz: 16, bold: true, color: { rgb: "F59E0B" } } : { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } };
          } else if (R === 1 || R === 2) {
            style.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "0F4C81" } };
            style.fill = { fgColor: { rgb: "F1F5F9" } };
          } else if (typeof val === 'string') {
            const v = val.toUpperCase().trim();
            if (v.includes("RESUMEN DE CONSUMO") || v.includes("DETALLE POR LOTE")) {
              style.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
              style.fill = { fgColor: { rgb: "10B981" } };
              if(!ws['!merges']) ws['!merges'] = [];
              ws['!merges'].push({ s: {r:R, c:0}, e: {r:R, c:numCols - 1} });
            } else if (v === "LOTE" || v === "PRODUCTO" || v === "TOTAL ANIMALES" || v === "GR SAL/DÍA" || v === "KG SAL/MES" || CATEGORIAS.map(c=>c.cod.toUpperCase()).includes(v)) {
              style.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
              style.fill = { fgColor: { rgb: "475569" } };
              style.alignment = { horizontal: "center", vertical: "center" };
            } else if (v === "TOTALES" || v.includes("BULTOS/MES PROYECTADOS")) {
              style.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "0F4C81" } };
              style.fill = { fgColor: { rgb: "DBEAFE" } };
            }
          }
          if (typeof val === 'number') {
            style.alignment = { horizontal: "center", vertical: "center" };
            if (C === numCols - 1) style.numFmt = '#,##0.0';
          }
          ws[cellRef].s = style;
        }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, 'REPORTE-BOVISAL');
      XLSX.writeFile(wb, `BoviSal_${finca}_${fecha}.xlsx`);
      showToast('Excel exportado correctamente.', 'success');
    } catch (e) {
    console.error(e);
    showToast('Error al exportar Excel.', 'error');
  }
};

window.exportarExcelModal = function() {
  if (state.selectedRecord) exportarExcel(state.selectedRecord);
};

// ─── COMPARTIR WHATSAPP ───────────────────────────────────
window.compartirWhatsApp = function() {
  const fecha   = document.getElementById('reg-fecha')?.value       || 'sin fecha';
  const finca   = document.getElementById('reg-finca-reg')?.value   || 'Finca';
  const sal     = null?.value  || '';
  const resp    = document.getElementById('reg-responsable')?.value || '';
  const t       = state.cachedTotales || {};
  const anim    = t.totalAnimalesFinca || 0;
  const kgMes   = t.totalKgMes ? t.totalKgMes.toFixed(1) : '0';
  const bultos  = t.bultosAl   ? t.bultosAl.toFixed(1)   : '0';
  const lActivos= t.lotesActivos || 0;

  let msg = `🐄 *BoviSal Control Pro — Solugan SG*\n\n`;
  msg += `📅 Fecha: ${fecha}\n`;
  msg += `🌿 Finca: ${finca}\n`;
  if (sal) msg += `🧂 Sal utilizada: ${sal}\n`;
  if (resp) msg += `👤 Responsable: ${resp}\n`;
  msg += `\n📊 *RESUMEN GENERAL*\n`;
  msg += `• Total animales: *${anim}*\n`;
  msg += `• Lotes activos: *${lActivos}* de 20\n`;
  msg += `• Sal Gr/Día: *${t.totalGrDia ? t.totalGrDia.toLocaleString('es-CO') : 0}* gr\n`;
  msg += `• Sal Kg/Mes: *${kgMes}* kg\n`;
  msg += `• Bultos/Mes: *${bultos}* bultos (÷${state.pesoBulto}kg)\n`;

  msg += `\n🏷️ *INVENTARIO POR CATEGORÍA*\n`;
  CATEGORIAS.forEach(c => {
    const v = t.totalesCat ? (t.totalesCat[c.cod] || 0) : 0;
    if (v > 0) msg += `• ${c.cod} - ${c.nombre}: *${v}* animales\n`;
  });

  msg += `\n_BoviSal Control Pro by Solugan SG_`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
};

// ─── CONTACTO WHATSAPP ────────────────────────────────────
window.contactarWhatsApp = function() {
  const msg = `Hola! Me comunico desde BoviSal Control Pro. Necesito información sobre Solugan SG.`;
  window.open(`https://wa.me/573147084328?text=${encodeURIComponent(msg)}`, '_blank');
};

// ─── ADMIN USUARIOS ───────────────────────────────────────
window.cargarUsuariosAdmin = function() {
  if (!state.currentUser || state.currentUser.email !== ADMIN_EMAIL) return;
  const tbody = document.getElementById('admin-users-tbody');
  const totalEl = document.getElementById('admin-total-usuarios');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Cargando...</td></tr>';

  db.collection(USER_COLL).orderBy('createdAt', 'desc').get().then(snap => {
    const users = [];
    snap.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    if (totalEl) totalEl.textContent = `Total: ${users.length} usuario(s) registrado(s)`;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td style="text-align:left;font-weight:600;">${u.name || u.nombre || '—'}</td>
        <td style="text-align:left;font-size:0.78rem;">${u.email || '—'}</td>
        <td style="color:var(--accent);">${u.nit || '—'}</td>
        <td style="text-align:left;">${u.finca || '—'}</td>
        <td>${u.pais || '—'}</td>
        <td>${u.phone || '—'}</td>
        <td style="color:var(--warning);font-weight:700;">${u.accessCount || 0}</td>
        <td style="font-size:0.75rem;color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt.toDate()).toLocaleDateString('es-CO') : '—'}</td>
      </tr>`).join('');
  }).catch(err => {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:1.5rem;">Error al cargar usuarios.</td></tr>';
  });
};

// ─── IDIOMA (stub) ────────────────────────────────────────
window.changeLanguage = function(lang) {
  // Futuro: traducciones
  showToast(`Idioma: ${lang.toUpperCase()} (próximamente)`, 'info');
};

// ─── TOAST NOTIFICATIONS ──────────────────────────────────
window.showToast = function(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initConsumoGr();
  initLotes();

  // Fecha de hoy por defecto
  const fechaEl = document.getElementById('reg-fecha');
  if (fechaEl && !fechaEl.value) {
    fechaEl.value = new Date().toISOString().split('T')[0];
  }

  renderTablalotes();
  lucide.createIcons();

  // Registrar Service Worker con auto-actualización
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js?v=260701.14')
      .then(reg => {
        console.log('[BoviSal SW] Registrado.');
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[BoviSal SW] Nueva versión disponible. Actualizando...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => console.warn('[BoviSal SW] Error:', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
});

window.onLoteProductoChange = function(loteIdx, val) {
  state.lotes[loteIdx].productoId = val;
  calcularTotales();
  autoGuardarLocal();
};




window.renderConfigProductos = function() {
  const container = document.getElementById('config-productos-container');
  if (!container) return;
  
  if (!state.productos || state.productos.length === 0) {
    initProductos();
  }

  container.innerHTML = state.productos.map((prod, idx) => {
    let costo = prod.costoBulto !== '' && prod.costoBulto !== undefined ? parseInt(String(prod.costoBulto).replace(/\D/g, '')) : '';
    let peso = prod.pesoBulto !== '' && prod.pesoBulto !== undefined ? parseInt(prod.pesoBulto) : '';
    let costoKilo = (peso !== '' && peso > 0 && costo !== '') ? (costo / peso) : 0;
    let costoGramo = costoKilo / 1000;
    let costoFormatted = costo !== '' ? costo.toLocaleString('es-CO') : '';
    
    return `
    <div class="glass-panel p-2 mb-2" style="border-left: 4px solid var(--accent);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h2 class="form-title text-accent" style="margin:0;"><i data-lucide="package"></i> Configuración Producto ${idx+1}</h2>
        ${idx > 0 ? `<button class="btn btn-danger" onclick="eliminarProductoConfig('${prod.id}')" style="padding:0.4rem;font-size:0.75rem;"><i data-lucide="trash-2"></i> Eliminar</button>` : ''}
      </div>
      
      <div style="display:flex; flex-wrap:wrap; gap:1rem; align-items:flex-start;">
        <div class="input-group" style="flex: 1 1 200px; min-width: 0;">
          <label style="color:var(--accent);font-weight:800;">Nombre del Producto</label>
          <input type="text" autocomplete="off" value="${prod.nombre}" oninput="updateProdInfo('${prod.id}', 'nombre', this.value)">
        </div>
        <div class="input-group" style="flex: 1 1 200px; min-width: 0;">
          <label style="color:var(--accent);font-weight:800;">Peso del Bulto (kg)</label>
          <div>
            <div class="spinner-wrap" style="display:inline-flex;border-radius:10px;">
              <button class="spin-btn minus" onpointerdown="startSpin(event, () => spinProdPeso('${prod.id}', -1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()">&#8722;</button>
              <input type="number" autocomplete="off" id="cfg_peso_${prod.id}" value="${peso}" min="0" class="cell-input" style="width:100px;font-size:1.3rem;font-weight:800;color:var(--accent);" oninput="updateProdInfo('${prod.id}', 'pesoBulto', this.value)">
              <button class="spin-btn plus" onpointerdown="startSpin(event, () => spinProdPeso('${prod.id}', 1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()">&#43;</button>
            </div>
          </div>
        </div>
        <div class="input-group" style="flex: 1 1 100%;">
          <label style="color:var(--accent);font-weight:800;">Costo del Bulto ($)</label>
          <div>
            <div class="spinner-wrap" style="display:inline-flex;border-radius:10px;">
              <button class="spin-btn minus" onpointerdown="startSpin(event, () => spinProdCosto('${prod.id}', -500))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()">&#8722;</button>
              <input type="text" autocomplete="off" inputmode="numeric" id="cfg_costo_${prod.id}" value="${costoFormatted}" class="cell-input" style="width:140px;font-size:1.3rem;font-weight:800;color:var(--accent);" oninput="updateProdCosto('${prod.id}', this)">
              <button class="spin-btn plus" onpointerdown="startSpin(event, () => spinProdCosto('${prod.id}', 500))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()">&#43;</button>
            </div>
          </div>
          
          <div style="margin-top:1rem;padding:0.75rem;background:rgba(16,185,129,0.05);border-radius:8px;border:1px solid rgba(16,185,129,0.2);display:flex;flex-wrap:wrap;justify-content:space-around;gap:0.5rem;text-align:center;">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Costo por Kilo</div>
              <div id="lbl-kilo-${prod.id}" style="font-size:1.1rem;font-weight:800;color:var(--success);margin-top:0.25rem;">$ ${costoKilo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">Costo por Gramo</div>
              <div id="lbl-gramo-${prod.id}" style="font-size:1.1rem;font-weight:800;color:var(--warning);margin-top:0.25rem;">$ ${costoGramo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</div>
            </div>
          </div>
        </div>
      </div>
      
      <h3 style="font-size:0.9rem;color:var(--salt-color);margin:1rem 0 0.5rem 0;">Consumo (Gr/Día) por Animal</h2>
      <div class="table-responsive">
        <table class="ref-table">
          <thead>
            <tr><th>Categoría</th><th>Cód.</th><th>Gr/Día</th></tr>
          </thead>
          <tbody>
            ${CATEGORIAS.map(c => `
              <tr>
                <td>${c.nombre}</td>
                <td>${c.cod}</td>
                <td>
                  <div class="spinner-wrap" style="display:inline-flex;border-radius:8px;border-color:rgba(167,139,250,0.3);">
                    <button class="spin-btn minus" onpointerdown="startSpin(event, () => spinProdGr('${prod.id}', '${c.cod}', -1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="color:var(--salt-color);">&#8722;</button>
                    <input type="number" autocomplete="off" class="ref-gr-input cell-input" id="cfg_${prod.id}_${c.cod}" value="${prod.consumoGr[c.cod] !== undefined ? prod.consumoGr[c.cod] : c.gr}" min="1" style="width:64px;color:var(--salt-color);font-weight:800;" onchange="updateProdConsumo('${prod.id}', '${c.cod}', this.value)">
                    <button class="spin-btn plus" onpointerdown="startSpin(event, () => spinProdGr('${prod.id}', '${c.cod}', 1))" onpointerup="stopSpin()" onpointerleave="stopSpin()" oncontextmenu="event.preventDefault()" style="color:var(--salt-color);">&#43;</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    `;
  }).join('');
  lucide.createIcons();
  renderFormularioLoteInputs();
  renderTablalotes();
};

window.recalcularCostoUI = function(id) {
  let prod = state.productos.find(p => p.id === id);
  if (!prod) return;
  let costo = parseInt(String(prod.costoBulto).replace(/\D/g, '')) || 0;
  let peso = parseInt(prod.pesoBulto) || 0;
  let costoKilo = peso > 0 ? (costo / peso) : 0;
  let costoGramo = costoKilo / 1000;
  
  const lblKilo = document.getElementById(`lbl-kilo-${id}`);
  const lblGramo = document.getElementById(`lbl-gramo-${id}`);
  
  if (lblKilo) lblKilo.textContent = '$ ' + costoKilo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (lblGramo) lblGramo.textContent = '$ ' + costoGramo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

window.spinProdPeso = function(id, delta) {
  const el = document.getElementById(`cfg_peso_${id}`);
  if (!el) return;
  const newVal = Math.max(0, (parseInt(el.value) || 0) + delta);
  el.value = newVal;
  updateProdInfo(id, 'pesoBulto', newVal);
};

window.spinProdCosto = function(id, delta) {
  const el = document.getElementById(`cfg_costo_${id}`);
  if (!el) return;
  let valStr = String(el.value).replace(/\D/g, '');
  const newVal = Math.max(0, (parseInt(valStr) || 0) + delta);
  el.value = newVal.toLocaleString('es-CO');
  let prod = state.productos.find(p => p.id === id);
  if (prod) {
    prod.costoBulto = newVal;
    guardarProductosLocal();
    recalcularCostoUI(id);
  }
};

window.spinProdGr = function(id, cod, delta) {
  const el = document.getElementById(`cfg_${id}_${cod}`);
  if (!el) return;
  const newVal = Math.max(1, (parseInt(el.value) || 1) + delta);
  el.value = newVal;
  updateProdConsumo(id, cod, newVal);
};

window.updateProdInfo = function(id, field, value) {
  let prod = state.productos.find(p => p.id === id);
  if (prod) {
    if (field === 'pesoBulto') {
      let parsed = parseInt(value);
      prod[field] = isNaN(parsed) ? '' : parsed;
      recalcularCostoUI(id);
    } else {
      prod[field] = value;
    }
    guardarProductosLocal();
  }
};

window.updateProdCosto = function(id, input) {
  // Preserve cursor position
  let originalLength = input.value.length;
  let cursorPosition = input.selectionStart;
  
  let valStr = String(input.value).replace(/\D/g, '');
  if (!valStr) {
    input.value = '';
    let prod = state.productos.find(p => p.id === id);
    if(prod) { prod.costoBulto = 0; guardarProductosLocal(); recalcularCostoUI(id); }
    return;
  }
  
  let valNum = parseInt(valStr) || 0;
  input.value = valNum.toLocaleString('es-CO');
  
  let newLength = input.value.length;
  cursorPosition = cursorPosition + (newLength - originalLength);
  input.setSelectionRange(cursorPosition, cursorPosition);
  
  let prod = state.productos.find(p => p.id === id);
  if (prod) {
    prod.costoBulto = valNum;
    guardarProductosLocal();
    recalcularCostoUI(id);
  }
};

window.updateProdConsumo = function(id, catCod, value) {
  let prod = state.productos.find(p => p.id === id);
  if (prod) {
    prod.consumoGr[catCod] = parseInt(value) || 1;
    guardarProductosLocal();
    calcularTotales();
  }
};

window.agregarNuevoProductoConfig = function() {
  state.productos.push({
    id: Date.now().toString(),
    nombre: '',
    pesoBulto: '',
    costoBulto: '',
    consumoGr: {}
  });
  guardarProductosLocal();
  renderConfigProductos();
  renderFormularioLoteInputs();
};

window.eliminarProductoConfig = function(id) {
  if (confirm('¿Eliminar este producto? Los lotes que lo usen quedarán sin producto asignado o tomarán el primero.')) {
    state.productos = state.productos.filter(p => p.id !== id);
    guardarProductosLocal();
    renderConfigProductos();
    renderFormularioLoteInputs();
    calcularTotales();
  }
};

window.guardarProductosLocal = function() {
  localStorage.setItem('bovisal_productos', JSON.stringify(state.productos));
  if (state.currentUser) {
    db.collection(USER_COLL).doc(state.currentUser.uid).set({ productos: state.productos }, { merge: true }).catch(console.error);
  }
};

// Auto-call
setTimeout(renderConfigProductos, 1500);

function renderDashProductos(totalesPorProducto) {
  const container = document.getElementById('dashboard-productos-container');
  if (!container) return;
  
  const ids = Object.keys(totalesPorProducto);
  if (ids.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<h3 style="color:var(--text-main); margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;"><i data-lucide="layers" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;"></i> Detalle por Producto</h3>';
  
  ids.forEach(id => {
    const prod = totalesPorProducto[id];
    const kgDia = prod.totalGrDia / 1000;
    const kgMes = kgDia * 30;
    const bultosMes = prod.pesoBulto > 0 ? (kgMes / prod.pesoBulto) : 0;
    const costoMes = bultosMes * prod.costoBulto;
    
    html += `
      <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(16,185,129,0.15); border-radius:10px; padding: 1rem; margin-bottom: 1.5rem;">
        <h4 style="color:var(--accent); margin-bottom: 0.75rem; font-size: 1.1rem;">${prod.nombre}</h4>
        <div class="resumen-grid">
          <div class="resumen-card" style="border-top:2px solid var(--salt-color); padding: 0.8rem;">
            <span class="rc-label">Consumo Diario</span>
            <div class="rc-value" style="color:var(--salt-color); font-size: 1.2rem;">${prod.totalGrDia.toLocaleString('es-CO')}</div>
            <div class="rc-unit">Gr/da</div>
          </div>
          <div class="resumen-card" style="border-top:2px solid #f97316; padding: 0.8rem;">
            <span class="rc-label">Consumo Mes</span>
            <div class="rc-value" style="color:#f97316; font-size: 1.2rem;">${kgMes.toFixed(1)}</div>
            <div class="rc-unit">Kg/mes</div>
          </div>
          <div class="resumen-card" style="border-top:2px solid #ef4444; padding: 0.8rem;">
            <span class="rc-label">Bultos/Mes</span>
            <div class="rc-value" style="color:#ef4444; font-size: 1.2rem;">${bultosMes.toFixed(1)}</div>
            <div class="rc-unit">x ${prod.pesoBulto}kg</div>
          </div>
          <div class="resumen-card" style="border-top:2px solid #8b5cf6; padding: 0.8rem;">
            <span class="rc-label">Costo Mensual</span>
            <div class="rc-value" style="color:#8b5cf6; font-size: 1.2rem;">$${Math.round(costoMes).toLocaleString('es-CO')}</div>
            <div class="rc-unit">Estimado</div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  if(window.lucide) lucide.createIcons();
}
