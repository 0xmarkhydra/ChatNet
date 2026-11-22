import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)))

/** Examine only lines added by this PR, not pre-existing legacy CSS. */
export function addedCssDeclarations(diff) {
  const findings = []
  let path = ''
  let newLine = 0
  let insideComment = false
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      path = ''
      insideComment = false
    } else if (line.startsWith('+++ b/')) {
      const candidate = line.slice(6)
      path = /^frontend\/.+\.css$/i.test(candidate) ? candidate : ''
    } else if (line.startsWith('@@')) {
      const match = /\+(\d+)/.exec(line)
      if (match) newLine = Number(match[1]) - 1
    } else if (path && line.startsWith('+') && !line.startsWith('+++')) {
      newLine++
      let text = line.slice(1)
      // Comment-only additions are permitted; active selectors/declarations are not.
      let active = ''
      while (text.length) {
        if (insideComment) {
          const end = text.indexOf('*/')
          if (end < 0) { text = ''; break }
          insideComment = false
          text = text.slice(end + 2)
        } else {
          const begin = text.indexOf('/*')
          if (begin < 0) { active += text; break }
          active += text.slice(0, begin)
          insideComment = true
          text = text.slice(begin + 2)
        }
      }
      if (active.trim()) findings.push({ path, line: newLine, snippet: active.trim().slice(0, 120) })
    } else if (path && line.startsWith(' ')) {
      // Context can contain comment boundaries when a patch requests context.
      // CI runs with --unified=0, so this branch is normally not reached.
    }
  }
  return findings
}

export function hasCurrentOwnerApproval(reviews, approvedLogin, headSha) {
  if (!approvedLogin || !headSha) return false
  const own = reviews.filter(review =>
    review.user?.login?.toLowerCase() === approvedLogin.toLowerCase() &&
    review.commit_id === headSha
  )
  // Latest review on this exact head must approve, not dismiss or request changes.
  return own.length > 0 && own.at(-1)?.state === 'APPROVED'
}

async function readApprovalFromGitHub(env) {
  const login = env.CSS_APPROVER_LOGIN?.trim()
  const token = env.GITHUB_TOKEN
  const repository = env.GITHUB_REPOSITORY
  const number = Number(env.PR_NUMBER)
  const headSha = env.PR_HEAD_SHA
  if (!login || !token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') ||
      !Number.isSafeInteger(number) || number < 1 || !/^[a-f0-9]{40}$/i.test(headSha ?? '')) return false

  // GitHub reviews are repository-controlled metadata; never use a marker from PR files.
  const reviews = []
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/pulls/${number}/reviews?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) throw new Error(`GitHub PR review lookup failed (HTTP ${response.status})`)
    const batch = await response.json()
    if (!Array.isArray(batch)) throw new Error('Unexpected GitHub review response')
    reviews.push(...batch)
    if (batch.length < 100) break
    if (page === 10) throw new Error('Too many GitHub reviews; cannot reliably verify approval')
  }
  return hasCurrentOwnerApproval(reviews, login, headSha)
}

export async function runCssGuard(baseRef, env = process.env, command = execFileSync) {
  if (!baseRef || baseRef.startsWith('-') || /[\s\0]/.test(baseRef)) {
    throw new Error('Pass a trusted base ref, e.g. origin/main')
  }
  const diff = command('git', [
    'diff', '--no-ext-diff', '--no-color', '--unified=0', '--diff-filter=ACMR',
    `${baseRef}...HEAD`, '--', 'frontend',
  ], { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 })
  const findings = addedCssDeclarations(diff)
  if (!findings.length) {
    console.log('PASS: no new handwritten CSS in this change')
    return true
  }

  const approved = await readApprovalFromGitHub(env)
  if (approved) {
    console.log(`PASS: ${findings.length} CSS additions explicitly approved by ${env.CSS_APPROVER_LOGIN} on this PR head`)
    return true
  }
  console.error(`FAIL: ${findings.length} new CSS line(s) found. Use Tailwind utilities and SocCO tokens.`)
  for (const finding of findings.slice(0, 35)) {
    console.error(` - ${finding.path}:${finding.line}: ${finding.snippet}`)
  }
  if (findings.length > 35) console.error(` - ...and ${findings.length - 35} more`)
  console.error('Exceptions require a current-commit APPROVED GitHub review by the configured CSS_APPROVER_LOGIN.')
  console.error('Without an approved reviewer configured, no exception is permitted.')
  return false
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!(await runCssGuard(process.argv[2]))) process.exitCode = 1
  } catch (error) {
    console.error(`FAIL: CSS policy check could not finish: ${error.message}`)
    process.exitCode = 1
  }
}
