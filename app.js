/**
 * SOSIBÉ Boutique — utilidades compartidas por todas las páginas.
 * Centraliza: la URL de la API, el nombre/logo por defecto, las llamadas
 * a Google Apps Script, el manejo de sesión y la carga del logo/nombre
 * de la tienda en el topbar. Así el logo y el nombre se comportan
 * exactamente igual en Panel, Inventario, Ventas, Separados, Pedidos
 * Online, Clientes, Compras, Proveedores, Caja y Reportes.
 *
 * ⚠️ Reemplaza esta URL por la de tu propia implementación de Apps Script
 * (debe terminar en /exec). Se usa para TODAS las páginas.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbwF0T4dFM_SbfCxq6dBBSdQBL_xP2R64RZFJW-ly0AGiEWuRvVrIHXV7AQ2WrchaT_W/exec';

// Logo y nombre que se muestran mientras carga la configuración real, o si
// getConfigPublica no devuelve un logo propio todavía. Es un archivo real
// (no un pixel transparente) para que nunca se vea un ícono roto.
const LOGO_POR_DEFECTO = 'assets/logo-sosibe.jpg';
const NOMBRE_POR_DEFECTO = 'SOSIBÉ Boutique';

async function api(accion, params = {}, metodo = 'POST') {
  const url = metodo === 'GET' ? `${API_URL}?action=${accion}&${new URLSearchParams(params)}` : API_URL;
  const config = {
    method: metodo,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: metodo === 'GET' ? undefined : JSON.stringify({ action: accion, ...params })
  };
  const res = await fetch(url, config);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

function cerrarSesion() {
  const token = localStorage.getItem('pos_token');
  if (token) api('logoutSesion', { token }).catch(() => {});
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_usuario');
  window.location.href = 'index.html';
}

// Solo se considera "sesión vencida" cuando el backend lo dice explícitamente.
// Cualquier otro error (red, timeout de Apps Script, límite de ejecuciones
// concurrentes, etc.) es transitorio: NO debe sacar al usuario del sistema.
function esSesionExpirada_(e) {
  return /expirada|token requerido/i.test((e && e.message) || '');
}

async function requerirSesion(intento = 0) {
  const token = localStorage.getItem('pos_token');
  if (!token) { window.location.href = 'index.html'; return null; }
  try {
    const sesion = await api('validarSesion', { token }, 'GET');
    const elUser = document.getElementById('appUser');
    if (elUser) elUser.innerText = `${sesion.nombre} (${sesion.rol})`;
    return sesion;
  } catch (e) {
    if (esSesionExpirada_(e)) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_usuario');
      window.location.href = 'index.html';
      return null;
    }
    console.warn('Error temporal validando sesión, reintentando...', e);
    if (intento >= 8) {
      console.error('No se pudo validar la sesión tras varios intentos. Se mantiene la sesión activa; recarga la página si el problema persiste.');
      return null;
    }
    await new Promise(r => setTimeout(r, 1500));
    return requerirSesion(intento + 1);
  }
}

// Carga el nombre de la tienda y el logo en el topbar (elementos con id
// "appTienda" y "logoImg"). Si logoImg no existe en la página, no falla:
// simplemente actualiza el nombre. Si la imagen configurada no carga
// (link roto, sin permisos, etc.) cae automáticamente al logo por defecto
// en vez de mostrarse rota.
async function cargarConfig() {
  const elNombre = document.getElementById('appTienda');
  const elLogo = document.getElementById('logoImg');
  if (elLogo) {
    elLogo.alt = NOMBRE_POR_DEFECTO;
    elLogo.onerror = () => { elLogo.onerror = null; elLogo.src = LOGO_POR_DEFECTO; };
    if (!elLogo.src) elLogo.src = LOGO_POR_DEFECTO;
  }
  try {
    const config = await api('getConfigPublica', {}, 'GET');
    if (elNombre) elNombre.innerText = config.nombreEmpresa || NOMBRE_POR_DEFECTO;
    if (elLogo) elLogo.src = config.logoUrl || LOGO_POR_DEFECTO;
    return config;
  } catch (e) {
    console.error('Error cargando configuración:', e);
    if (elNombre) elNombre.innerText = NOMBRE_POR_DEFECTO;
    if (elLogo) elLogo.src = LOGO_POR_DEFECTO;
    return null;
  }
}

// Muestra en la pestaña "Pedidos Online" del menú cuántos pedidos están
// pendientes de revisión, para que se note desde cualquier página (no
// solo desde el Panel). Si el elemento del badge no existe en la página
// simplemente no hace nada.
async function cargarBadgePedidosNav() {
  const navBadge = document.getElementById('navBadgePedidos');
  if (!navBadge) return;
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return;
    const pedidos = await api('getPedidosOnline', { token }, 'GET');
    const pendientes = pedidos.filter(p => p.estadoPedido === 'Pendiente').length;
    if (pendientes > 0) {
      navBadge.textContent = pendientes;
      navBadge.style.display = 'flex';
    }
  } catch (e) {
    console.error('Error cargando badge de pedidos online:', e);
  }
}
