/**
 * scripts/registro.js
 * Dragon3 - Registro seguro, FAANG/KISS, usa CSS real y navega correctamente.
 */
document.addEventListener('DOMContentLoaded', function() {
  const $ = (id) => document.getElementById(id);

  const form = document.getElementById('registerForm');
  const errorDiv = document.getElementById('registerError');

  form.onsubmit = async function(ev) {
    ev.preventDefault();
    errorDiv.classList.add('oculto');
    const usuario = this.usuario.value.trim();
    const email = this.email.value.trim();
    const password = this.password.value;
    const password2 = this.password2.value;
    if (password !== password2) {
      errorDiv.textContent = 'Las contraseñas no coinciden';
      errorDiv.classList.remove('oculto');
      return;
    }
    try {
      const res = await fetch('/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || 'Registro incorrecto');
      localStorage.setItem('token', data.token);
      window.location.href = 'mi_espacio.html';
    } catch(e) {
      errorDiv.textContent = e.message;
      errorDiv.classList.remove('oculto');
    }
  };

  // Botón de login (lleva a login)
  document.getElementById('btnGoLogin').onclick = () => {
    window.location.href = 'login.html';
  };
});
