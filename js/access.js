/*
 * Who may play what. Every puzzle goes through canAccess before it opens.
 *
 * During the growth phase everything is free and nothing needs an account,
 * so this always allows. If access rules are ever introduced (only with the
 * owner's approval), they belong here and nowhere else. tests/access.test.js
 * checks that every puzzle stays open while that's the policy.
 */
function canAccess(puzzle) {
  return { allowed: true };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { canAccess };
