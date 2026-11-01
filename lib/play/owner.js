/**
 * Whose settings these are. The games keep one set of grown-ups' choices for
 * the whole app, so the owner is one fixed name chosen here on the server. A
 * request never chooses an owner. Who may change that set is `./roles.js`.
 *
 * @returns {string}
 */
export function currentOwner() {
  return 'local-owner';
}
