/**
 * scripts/login.js
 * Dragon3 - Login seguro, FAANG/KISS, usa CSS real y navega correctamente.
 */
document.addEventListener('DOMContentLoaded', function() {
  const $ = (id) => document.getElementById(id);

  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');

  form.onsubmit = async function(ev) {
    ev.preventDefault();
    errorDiv.classList.add('oculto');
    const usuario = this.usuario.value.trim();
    const password = this.password.value;
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || 'Login incorrecto');
      localStorage.setItem('token', data.token);
      window.location.href = 'mi_espacio.html';
    } catch(e) {
      errorDiv.textContent = e.message;
      errorDiv.classList.remove('oculto');
    }
  };

  // Botón de registro (lleva a registro)
  document.getElementById('btnGoRegister').onclick = () => {
    window.location.href = 'registro.html';
  };
});
