import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

/**
 * The CSRF token, for the rare form the browser submits itself.
 *
 * Only the backup file input needs this: a file upload has to be a real form
 * post rather than an Inertia request. Everything else goes through Inertia,
 * which reads the XSRF-TOKEN cookie itself and would never call this.
 *
 * Kept as a named accessor rather than an inline querySelector so the tag's
 * name appears in exactly one place.
 */
window.csrfToken = () =>
    document.querySelector('meta[name="csrf-token"]')?.content ?? '';
