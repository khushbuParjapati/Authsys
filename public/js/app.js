/* Frontend: only collects form input, calls the API and shows the result.
 * All validation, hashing, tokens, sessions and redirects-by-permission happen on the server. */
(() => {
  'use strict';

  const page = document.body.dataset.page;
  const $ = (sel) => document.querySelector(sel);

  function showMessage(type, text) {
    const el = $('#message');
    if (!el) return;
    el.className = `alert ${type}`;
    el.textContent = text;
    el.hidden = false;
  }

  async function api(path, body) {
    const res = await fetch(`/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON response */ }
    if (!res.ok) {
      const err = new Error(data.message || 'Something went wrong.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Wires a form: runs `action`, shows errors, disables the button while waiting.
  function handleForm(action) {
    const form = $('#form');
    const btn = $('#submit');
    const label = btn.textContent;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#message').hidden = true;
      btn.disabled = true;
      btn.textContent = 'Please wait…';
      try {
        await action(form);
      } catch (err) {
        showMessage('error', err.message);
      }
      btn.disabled = false;
      btn.textContent = label;
    });
  }

  const val = (id) => $(`#${id}`).value;

  // Show / hide password
  document.querySelectorAll('.toggle-pw').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
    });
  });

  const pages = {
    register() {
      handleForm(async () => {
        await api('/register', {
          name: val('name'), username: val('username'), email: val('email'),
          password: val('password'), confirmPassword: val('confirmPassword'),
        });
        location.href = '/login?registered=1';
      });
    },

    login() {
      const q = new URLSearchParams(location.search);
      if (q.has('registered')) showMessage('success', 'Account created! You can log in now.');
      if (q.has('reset')) showMessage('success', 'Password updated. Log in with your new password.');
      if (q.has('loggedout')) showMessage('info', 'You have been logged out.');
      if (q.has('expired')) showMessage('info', 'Please log in to continue.');

      handleForm(async () => {
        await api('/login', { identifier: val('identifier'), password: val('password'), remember: $('#remember').checked });
        location.href = '/dashboard';
      });
    },

    forgot() {
      handleForm(async (form) => {
        const { message } = await api('/forgot', { identifier: val('identifier') });
        showMessage('success', message);
        form.reset();
      });
    },

    reset() {
      const token = new URLSearchParams(location.search).get('token') || '';
      if (!token) {
        showMessage('error', 'Reset link is missing or invalid. Request a new one.');
        $('#form').hidden = true;
        return;
      }
      handleForm(async () => {
        await api('/reset', { token, password: val('password'), confirmPassword: val('confirmPassword') });
        location.href = '/login?reset=1';
      });
    },

    async dashboard() {
      try {
        const { user } = await api('/me');
        $('#welcome').textContent = `Welcome, ${user.name.split(' ')[0]}!`;
        $('#p-name').textContent = user.name;
        $('#p-username').textContent = `@${user.username}`;
        $('#p-email').textContent = user.email;
        $('#p-joined').textContent = new Date(user.createdAt).toLocaleDateString();
        $('#dash').hidden = false;
      } catch {
        return location.replace('/login?expired=1');
      }
      $('#logout').addEventListener('click', async () => {
        try { await api('/logout', {}); } catch { /* cookie may already be invalid */ }
        location.replace('/login?loggedout=1');
      });
    },
  };

  if (pages[page]) pages[page]();
})();
