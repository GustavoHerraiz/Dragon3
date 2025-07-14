/**
 * scripts/mi-espacio.js
 * Dragon3 - Panel multirol, FAANG/KISS, solo depende de CSS reales.
 * Todos los botones funcionales, clases compatibles, responsive.
 */
document.addEventListener('DOMContentLoaded', async function() {
  // ======= UTILIDADES =======
  const $ = (id) => document.getElementById(id);

  // ======= NAVEGACIÓN GLOBAL =======
  $('btnHome').onclick = () => { window.location.href = 'index.html'; };
  $('btnLogout').onclick = function() {
    localStorage.removeItem('token');
    window.location.href = "login.html";
  };

  // ======= PERFIL Y ROL =======
  let usuario = null, rol = null, tipoCuenta = null;

  try {
    const perfilRes = await fetch('/auth/perfil', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
    });
    if (!perfilRes.ok) throw new Error("No autenticado");
    usuario = await perfilRes.json();

    $('nombreUsuario').textContent = usuario.nombre || usuario.usuario || 'Usuario';
    $('tipoUsuario').textContent = usuario.rol || 'normal';
    $('emailUsuario').textContent = usuario.email || '';
    rol = usuario.rol || 'normal';
    tipoCuenta = usuario.tipo || 'normal';

    cargarPerfil(usuario);

    if (rol === 'premium' || tipoCuenta === 'premium') {
      $('premiumPanel').classList.remove('oculto');
      cargarPanelPremium();
    }
    if (rol === 'enterprise' || tipoCuenta === 'enterprise') {
      $('enterprisePanel').classList.remove('oculto');
      cargarPanelEnterprise();
    }
    if (rol === 'admin') {
      $('adminPanel').classList.remove('oculto');
      cargarPanelAdmin();
    }

    cargarHistorial();
    cargarEstadisticas();

  } catch(e) {
    $('alertas').textContent = "No se pudo cargar el perfil. ¿Sesión caducada?";
    $('alertas').classList.remove('oculto');
    setTimeout(() => { window.location.href = "login.html"; }, 2000);
    return;
  }

  // ======= PERFIL Y CONTRASEÑA =======
  function cargarPerfil(user) {
    $('datosPerfil').innerHTML = `
      <ul>
        <li><b>Usuario:</b> ${user.usuario}</li>
        <li><b>Email:</b> ${user.email}</li>
        <li><b>Tipo:</b> ${user.rol || 'normal'}</li>
        <li><b>Fecha alta:</b> ${user.fechaAlta || "—"}</li>
      </ul>
    `;
  }

  $('btnEditarPerfil').onclick = function() {
    $('formEditarPerfil').classList.toggle('oculto');
    $('formEditarPerfil').innerHTML = `
      <form id="formEditarDatos" class="input-field">
        <label>Email: <input type="email" class="input" name="email" value="${usuario.email}" required maxlength="128"></label>
        <button type="submit" class="button">Guardar cambios</button>
        <button type="button" id="cancelEditar" class="button" style="margin-left:8px;">Cancelar</button>
      </form>
    `;
    document.getElementById('cancelEditar').onclick = () => $('formEditarPerfil').classList.add('oculto');
    $('formEditarDatos').onsubmit = async function(ev) {
      ev.preventDefault();
      const email = this.email.value.trim();
      try {
        const res = await fetch('/auth/editar-perfil', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.token || '')
          },
          body: JSON.stringify({ email })
        });
        if (!res.ok) throw new Error("Error al actualizar perfil");
        usuario.email = email;
        cargarPerfil(usuario);
        $('formEditarPerfil').classList.add('oculto');
      } catch(e) {
        alert("No se pudo actualizar el perfil.");
      }
    };
  };

  $('btnCambiarPassword').onclick = function() {
    $('formCambiarPassword').classList.toggle('oculto');
    $('formCambiarPassword').innerHTML = `
      <form id="formPass" class="input-field">
        <label>Contraseña actual: <input type="password" class="input" name="actual" required></label>
        <label>Nueva contraseña: <input type="password" class="input" name="nueva" required minlength="8"></label>
        <button type="submit" class="button">Cambiar contraseña</button>
        <button type="button" id="cancelPass" class="button" style="margin-left:8px;">Cancelar</button>
      </form>
    `;
    document.getElementById('cancelPass').onclick = () => $('formCambiarPassword').classList.add('oculto');
    $('formPass').onsubmit = async function(ev) {
      ev.preventDefault();
      const actual = this.actual.value;
      const nueva = this.nueva.value;
      try {
        const res = await fetch('/auth/cambiar-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.token || '')
          },
          body: JSON.stringify({ actual, nueva })
        });
        if (!res.ok) throw new Error("Error al cambiar contraseña");
        $('formCambiarPassword').classList.add('oculto');
        alert("Contraseña cambiada correctamente.");
      } catch(e) {
        alert("No se pudo cambiar la contraseña.");
      }
    };
  };

  // ======= ANÁLISIS DE ARCHIVOS =======
  $('formAnalizarArchivo').onsubmit = async function(ev) {
    ev.preventDefault();
    const archivo = $('inputArchivo').files[0];
    if (!archivo) return alert("Selecciona un archivo.");
    const formData = new FormData();
    formData.append("archivo", archivo);
    try {
      const res = await fetch('/analizar-imagen', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + (localStorage.token || '')
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar archivo");
      $('resultadoAnalisis').innerHTML = `
        <div class="panel">
          <b>Resultado:</b> ${JSON.stringify(data.resultado)}
        </div>
      `;
      cargarHistorial();
      cargarEstadisticas();
    } catch(e) {
      $('resultadoAnalisis').innerHTML = `<div class="prx">Error: ${e.message}</div>`;
    }
  };

  // ======= HISTORIAL DE ANÁLISIS =======
  async function cargarHistorial() {
    $('listaHistorial').innerHTML = "Cargando...";
    try {
      const res = await fetch('/archivos/historial', {
        headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.analisis)) throw new Error(data.error || "No se pudo cargar historial.");
      if (data.analisis.length === 0) {
        $('listaHistorial').innerHTML = "No hay análisis realizados.";
        return;
      }
      $('listaHistorial').innerHTML = data.analisis.map(a => `
        <div class="panel">
          <b>Fecha:</b> ${a.timestamp || a.fecha || "—"}
          <br><b>Tipo:</b> ${a.tipo}
          <br><b>Resultado:</b> ${JSON.stringify(a.resultado.basico || a.resultado)}
          <br><button class="button" onclick="borrarAnalisis('${a._id}')">Borrar</button>
        </div>
      `).join('');
    } catch(e) {
      $('listaHistorial').innerHTML = `<div class="prx">Error: ${e.message}</div>`;
    }
  }

  // Borrar análisis (solo si backend lo permite)
  window.borrarAnalisis = async function(id) {
    if (!confirm("¿Seguro que quieres borrar este análisis?")) return;
    try {
      const res = await fetch('/archivos/borrar/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
      });
      if (!res.ok) throw new Error("No se pudo borrar.");
      cargarHistorial();
      cargarEstadisticas();
    } catch(e) {
      alert("Error: " + e.message);
    }
  };

  // ======= ESTADÍSTICAS =======
  async function cargarEstadisticas() {
    $('estadisticasUsuario').innerHTML = "Cargando...";
    try {
      const res = await fetch('/archivos/estadisticas', {
        headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar estadísticas.");
      $('estadisticasUsuario').innerHTML = `
        <ul>
          <li><b>Total análisis:</b> ${data.total}</li>
          <li><b>Último análisis:</b> ${data.ultimo || "—"}</li>
          <li><b>Límite actual:</b> ${data.limite || "—"}</li>
        </ul>
      `;
    } catch(e) {
      $('estadisticasUsuario').innerHTML = `<div class="prx">Error: ${e.message}</div>`;
    }
  }

  // ======= PREMIUM =======
  function cargarPanelPremium() {
    fetch('/archivos/limite', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
    }).then(res => res.json())
      .then(data => { $('limitePremium').textContent = data.limite || "—"; })
      .catch(() => { $('limitePremium').textContent = "—"; });

    fetch('/archivos/descargas', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
    }).then(res => res.json())
      .then(data => {
        if (!Array.isArray(data.informes) || data.informes.length === 0) {
          $('descargasPremium').textContent = "No hay informes disponibles.";
          return;
        }
        $('descargasPremium').innerHTML = data.informes.map(inf =>
          `<a href="${inf.url}" class="button" download>${inf.nombre}</a>`
        ).join('<br>');
      }).catch(() => { $('descargasPremium').textContent = "—"; });
  }

  // ======= ENTERPRISE =======
  function cargarPanelEnterprise() {
    fetch('/archivos/usuarios-org', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
    }).then(res => res.json())
      .then(data => {
        if (!Array.isArray(data.usuarios) || data.usuarios.length === 0) {
          $('gestionUsuariosOrg').textContent = "No hay usuarios en la organización.";
          return;
        }
        $('gestionUsuariosOrg').innerHTML = data.usuarios.map(u =>
          `<div>${u.nombre || u.usuario} (${u.email}) - ${u.rol}</div>`
        ).join('');
      }).catch(() => { $('gestionUsuariosOrg').textContent = "—"; });
  }

  // ======= ADMIN =======
  function cargarPanelAdmin() {
    fetch('/health').then(res => res.json())
      .then(data => {
        $('healthCheckAdmin').innerHTML = `
          <ul>
            <li><b>MongoDB:</b> ${data.services.mongodb}</li>
            <li><b>Redis:</b> ${data.services.redis}</li>
            <li><b>Servidor Central:</b> ${data.services.servidorCentral}</li>
            <li><b>Red Superior:</b> ${data.services.redSuperior}</li>
            <li><b>Status global:</b> ${data.status}</li>
          </ul>
        `;
      }).catch(() => { $('healthCheckAdmin').textContent = "—"; });

    fetch('/archivos/todos', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.token || '') }
    }).then(res => res.json())
      .then(data => {
        if (!Array.isArray(data.usuarios) || data.usuarios.length === 0) {
          $('gestionGlobalAdmin').textContent = "No hay usuarios globales.";
          return;
        }
        $('gestionGlobalAdmin').innerHTML = data.usuarios.map(u =>
          `<div>${u.nombre || u.usuario} (${u.email}) - ${u.rol}</div>`
        ).join('');
      }).catch(() => { $('gestionGlobalAdmin').textContent = "—"; });
  }
});
