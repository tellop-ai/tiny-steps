/**
 * Who may save the grown-ups' choices (`AGENTS.md` rule 1).
 *
 * The app keeps one set of choices for everyone who plays: sound effects,
 * speaking, the language, the challenge, and each game's level and favourite
 * star. Every save changes a row the person did not add, so online the host
 * refuses a Viewer's every save and a Member's change to it. Only the owner and
 * a Helper save.
 *
 * Everyone plays every game. For a role that cannot save, a choice still
 * changes for that visit; nothing is sent, and the grown-ups window says so.
 * A role this file does not know saves nothing.
 */

const SAVING_ROLES = Object.freeze(['owner', 'helper']);

/**
 * @param {unknown} role
 * @returns {boolean}
 */
export function canChange(role) {
  return typeof role === 'string' && SAVING_ROLES.includes(role);
}
