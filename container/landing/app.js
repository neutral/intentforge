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
    document.getElementById('connection').textContent = names.every(name => data.services[name].status === 'ready') ? 'All three services are ready. Agent authentication has not been checked.' : 'Waiting for services. Startup details are retained in the environment’s private service logs.';
  } catch {
    document.getElementById('connection').textContent = 'Cannot reach this environment. Check its status with the IntentForge launcher.';
    for (const name of names) { const link = document.getElementById(`${name}-link`); link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
  }
}
void refresh();
setInterval(() => { void refresh(); }, 4000);
