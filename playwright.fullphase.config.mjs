// Temporary full-suite phase 1 config: excludes the completion audit specs,
// which require OKIM_DISABLE_EMAILS=1 on the server (phase 2 runs them separately).
import base from './playwright.config.mjs'
const extraIgnore = ['completion-critical.spec.mjs', 'completion-points.spec.mjs']
export default {
  ...base,
  projects: base.projects.map(p => ({
    ...p,
    testIgnore: [...(p.testIgnore ?? []), ...extraIgnore],
    testMatch: p.testMatch ? p.testMatch.filter(m => !extraIgnore.includes(m)) : p.testMatch,
  })),
}