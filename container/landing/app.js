'use strict';
const names = ['forge', 'intent', 'atlas'];
const labels = { starting: 'Starting service…', ready: 'Service ready', unavailable: 'Service unavailable', failed: 'Service failed', stopping: 'Stopping service…', stopped: 'Service stopped' };
async function refresh() {
  try {
    const response = await fetch('/api/services', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('The saved environment is unavailable.');
    const data = await response.json();
    for (const name of names) {
      const service = data.services[name];
      const status = document.getElementById(`${name}-status`);
      status.textContent = service.error ?? labels[service.status] ?? 'Unknown service state';
      status.dataset.status = service.status;
      const link = document.getElementById(`${name}-link`);
      const ready = service.status === 'ready' && service.url;
      link.setAttribute('aria-disabled', ready ? 'false' : 'true');
      if (ready) link.href = service.url;
      else link.removeAttribute('href');
    }
    const connection = document.getElementById('connection');
    const ready = names.every(name => data.services[name].status === 'ready');
    connection.textContent = ready ? 'Application services are ready.' : 'Waiting for services. Check private service logs for startup details.';
    connection.dataset.status = ready ? 'ready' : 'starting';
  } catch {
    const connection = document.getElementById('connection');
    connection.textContent = 'Cannot reach this environment. Check its status with the IntentForge launcher.';
    connection.dataset.status = 'unavailable';
    for (const name of names) { const link = document.getElementById(`${name}-link`); link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
  }
}
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const request = document.getElementById(button.dataset.copy);
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(request.textContent);
      status.textContent = 'Request copied. Paste it into your Worker’s instructions in Work.';
    } catch {
      status.textContent = 'Select the example request and copy it into your Worker’s instructions in Work.';
    }
  });
}
void refresh();
setInterval(() => { void refresh(); }, 4000);
