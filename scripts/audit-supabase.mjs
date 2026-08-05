import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios')

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const tableNames = [
  'users',
  'profile',
  'job',
  'job_match',
  'saved_job',
  'source_run',
  'profile_analysis_job',
  'profile_analysis',
  'profile_analysis_event',
  'ai_usage_event',
  'checkout_credit_grant',
]

async function allRows(table) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(offset, offset + 999)
    if (error) {
      if (error.code === 'PGRST205') return { missing: true, rows: [] }
      throw new Error(`${table}: ${error.message}`)
    }
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return { missing: false, rows }
  }
}

function duplicates(rows, key) {
  const seen = new Set()
  const repeated = new Set()
  for (const row of rows) {
    const value = key(row)
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

function countBy(rows, key) {
  const result = {}
  for (const row of rows) {
    const value = String(row[key] ?? 'null')
    result[value] = (result[value] ?? 0) + 1
  }
  return result
}

async function storageObjects(bucket) {
  if (!bucket) return []
  const objects = []
  const folders = ['']
  while (folders.length > 0) {
    const folder = folders.shift()
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 })
    if (error) throw new Error(`storage.objects: ${error.message}`)
    for (const item of data ?? []) {
      const itemPath = folder ? `${folder}/${item.name}` : item.name
      if (item.id) objects.push(itemPath)
      else folders.push(itemPath)
    }
  }
  return objects
}

function jwtPayload(candidate) {
  try {
    return JSON.parse(Buffer.from(candidate.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function discoverPublicKey(frontendUrl, projectRef) {
  if (!frontendUrl) return null
  const page = await fetch(frontendUrl)
  if (!page.ok) throw new Error(`frontend publico: HTTP ${page.status}`)
  const html = await page.text()
  const assets = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)]
    .map((match) => new URL(match[1], frontendUrl).toString())
  for (const asset of assets) {
    const response = await fetch(asset)
    if (!response.ok) continue
    const source = await response.text()
    const publishable = source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
    if (publishable) return publishable
    for (const candidate of source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      const payload = jwtPayload(candidate)
      if (payload?.role === 'anon' && payload?.ref === projectRef) return candidate
    }
  }
  return null
}

async function anonymousRlsAudit(frontendUrl, projectRef) {
  const publicKey = await discoverPublicKey(frontendUrl, projectRef)
  if (!publicKey) return { checked: false, reason: 'public_key_not_found' }
  const privateTables = [
    'users',
    'profile',
    'job_match',
    'saved_job',
    'profile_analysis_job',
    'profile_analysis',
    'profile_analysis_event',
    'ai_usage_event',
    'checkout_credit_grant',
  ]
  const results = {}
  for (const table of privateTables) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
    })
    const payload = await response.json().catch(() => null)
    results[table] = {
      exposedRows: Array.isArray(payload) ? payload.length : 0,
      status: response.status,
    }
  }
  return { checked: true, results }
}

const inventory = Object.fromEntries(await Promise.all(
  tableNames.map(async (table) => [table, await allRows(table)]),
))
const rows = (table) => inventory[table].rows
const userIds = new Set(rows('users').map((row) => row.id))
const userById = new Map(rows('users').map((row) => [row.id, row]))
const jobIds = new Set(rows('job').map((row) => row.id))
const jobById = new Map(rows('job').map((row) => [row.id, row]))
const analysisJobById = new Map(rows('profile_analysis_job').map((row) => [row.id, row]))
const analysisById = new Map(rows('profile_analysis').map((row) => [row.id, row]))
const now = Date.now()

const { data: authPage, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (authError) throw new Error(`auth.users: ${authError.message}`)
const authIds = new Set(authPage.users.map((user) => user.id))

const ownershipIssues = []
for (const analysis of rows('profile_analysis')) {
  const job = analysisJobById.get(analysis.job_id)
  if (!job || job.user_id !== analysis.user_id || job.model_id !== analysis.model_id) {
    ownershipIssues.push(`profile_analysis:${analysis.id}`)
  }
}
for (const event of rows('profile_analysis_event')) {
  const job = analysisJobById.get(event.job_id)
  if (!job || job.user_id !== event.user_id) ownershipIssues.push(`profile_analysis_event:${event.id}`)
}
for (const usage of rows('ai_usage_event')) {
  const job = usage.job_id ? analysisJobById.get(usage.job_id) : null
  const analysis = usage.analysis_id ? analysisById.get(usage.analysis_id) : null
  if (!job
    || job.user_id !== usage.user_id
    || job.model_id !== usage.requested_model
    || (usage.analysis_id && (!analysis || analysis.job_id !== usage.job_id || analysis.user_id !== usage.user_id))) {
    ownershipIssues.push(`ai_usage_event:${usage.id}`)
  }
}

const activeJobs = rows('profile_analysis_job').filter((row) => ['queued', 'running', 'cancel_requested'].includes(row.status))
const staleRunning = activeJobs.filter((row) => row.status !== 'queued' && row.lease_expires_at && Date.parse(row.lease_expires_at) < now)
function validDocumentPath(row) {
  if (typeof row.document_path !== 'string' || !row.document_path.startsWith(`${row.user_id}/`)) return false
  const documentJobId = row.document_path.split('/')[1]
  let cursor = row
  const visited = new Set()
  while (cursor && !visited.has(cursor.id)) {
    if (cursor.id === documentJobId) return true
    visited.add(cursor.id)
    cursor = cursor.retry_of_job_id ? analysisJobById.get(cursor.retry_of_job_id) : null
  }
  return false
}
const malformedDocumentPaths = rows('profile_analysis_job').filter((row) => !validDocumentPath(row))
const terminalWithoutFinishedAt = rows('profile_analysis_job').filter(
  (row) => ['cancelled', 'succeeded', 'failed'].includes(row.status) && !row.finished_at,
)

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
if (bucketError) throw new Error(`storage.buckets: ${bucketError.message}`)
const profileBucket = buckets.find((bucket) => bucket.name === 'profile-documents')
const profileObjects = await storageObjects(profileBucket?.name)
const referencedDocuments = new Set(rows('profile_analysis_job').map((row) => row.document_path))

const desiredSkills = rows('profile').flatMap((row) => (
  Array.isArray(row.document?.skills_desired) ? row.document.skills_desired : []
)).map((skill) => String(skill?.name ?? '').toLowerCase())
const supportTerms = ['anydesk', 'helpdesk', 'office 365', 'service desk', 'technical support']
const contaminatedDesiredSkills = desiredSkills.filter((skill) => supportTerms.some((term) => skill.includes(term)))
const invalidProfiles = rows('profile').filter((row) => {
  const document = row.document
  const known = document?.skills_known
  const facts = document?.matching_facts
  return !document?.identity
    || !document?.work_preferences
    || !Array.isArray(document?.skills_desired)
    || !known
    || !Array.isArray(known.desired_and_evidenced)
    || !Array.isArray(known.secondary_or_limited_evidence)
    || !Array.isArray(known.known_but_not_desired_for_matching)
    || typeof facts?.professional_development_years_approx !== 'number'
})

const openApiResponse = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
})
if (!openApiResponse.ok) throw new Error(`OpenAPI: HTTP ${openApiResponse.status}`)
const openApi = await openApiResponse.json()
const projectRef = new URL(url).hostname.split('.')[0]
const anonymousAccess = await anonymousRlsAudit(process.env.PUBLIC_FRONTEND_URL?.trim(), projectRef)
const auditUserId = rows('users')[0]?.id
let jobListSmoke = { checked: false, reason: 'no_user' }
if (auditUserId) {
  const { data, error } = await supabase.rpc('list_jobs_for_user', {
    p_limit: 5,
    p_offset: 0,
    p_user_id: auditUserId,
  })
  if (error) throw new Error(`list_jobs_for_user: ${error.message}`)
  const jobs = Array.isArray(data?.jobs) ? data.jobs : []
  jobListSmoke = {
    checked: true,
    returnedJobs: jobs.length,
    total: Number(data?.total ?? 0),
    ranks: jobs.map((job) => job.rank),
  }
}

const report = {
  projectRef,
  counts: Object.fromEntries(tableNames.map((table) => [table, inventory[table].missing ? 'missing' : rows(table).length])),
  auth: {
    authUsers: authIds.size,
    publicUsers: userIds.size,
    missingInPublicUsers: [...authIds].filter((id) => !userIds.has(id)).length,
    missingInAuth: [...userIds].filter((id) => !authIds.has(id)).length,
  },
  profiles: {
    contaminatedDesiredSkills: contaminatedDesiredSkills.length,
    invalidCanonicalDocuments: invalidProfiles.length,
  },
  catalog: {
    activeJobs: rows('job').filter((row) => row.is_active).length,
    inactiveJobs: rows('job').filter((row) => !row.is_active).length,
    market: countBy(rows('job'), 'market'),
    missingCoreFields: rows('job').filter((row) => !row.title || !row.company || !row.source_url || !row.location).length,
    source: countBy(rows('job'), 'source'),
    workplaceType: countBy(rows('job'), 'workplace_type'),
    employmentType: countBy(rows('job'), 'employment_type'),
    invalidTaxonomy: rows('job').filter((row) => (
      !['remote', 'hybrid', 'onsite', 'unknown'].includes(row.workplace_type)
      || (row.employment_type !== null && !['full_time', 'part_time', 'contract', 'temporary', 'internship', 'other'].includes(row.employment_type))
    )).length,
  },
  uniqueness: {
    jobsByNaturalKey: duplicates(rows('job'), (row) => `${row.source}:${row.external_id}`).length,
    matchesByOwnerAndJob: duplicates(rows('job_match'), (row) => `${row.user_id}:${row.job_id}`).length,
    analysesByJob: duplicates(rows('profile_analysis'), (row) => row.job_id).length,
    grantsByPaymentIntent: duplicates(rows('checkout_credit_grant'), (row) => row.payment_intent_id).length,
  },
  referentialIntegrity: {
    profilesWithoutUser: rows('profile').filter((row) => !userIds.has(row.user_id)).length,
    matchesWithoutUser: rows('job_match').filter((row) => !userIds.has(row.user_id)).length,
    matchesWithoutJob: rows('job_match').filter((row) => !jobIds.has(row.job_id)).length,
    savedJobsWithoutUser: rows('saved_job').filter((row) => !userIds.has(row.user_id)).length,
    analysisJobsWithoutUser: rows('profile_analysis_job').filter((row) => !userIds.has(row.user_id)).length,
    analysesWithoutJob: rows('profile_analysis').filter((row) => !analysisJobById.has(row.job_id)).length,
    analysisEventsWithoutJob: rows('profile_analysis_event').filter((row) => !analysisJobById.has(row.job_id)).length,
    ownershipIssues: ownershipIssues.length,
  },
  jobs: {
    activeByUserDuplicates: duplicates(activeJobs, (row) => row.user_id).length,
    malformedDocumentPaths: malformedDocumentPaths.length,
    staleRunning: staleRunning.length,
    status: countBy(rows('profile_analysis_job'), 'status'),
    terminalWithoutFinishedAt: terminalWithoutFinishedAt.length,
  },
  matches: {
    excluded: rows('job_match').filter((row) => row.excluded).length,
    rankDuplicatesPerUser: duplicates(
      rows('job_match').filter((row) => !row.excluded && row.rank !== null),
      (row) => `${row.user_id}:${row.rank}`,
    ).length,
    scoreOutsideRange: rows('job_match').filter(
      (row) => row.score !== null && (!Number.isFinite(row.score) || row.score < 0 || row.score > 100),
    ).length,
    unknownWorkplaceIncluded: rows('job_match').filter(
      (row) => !row.excluded && jobById.get(row.job_id)?.workplace_type === 'unknown',
    ).length,
  },
  usage: {
    duplicateMeterIdentifiers: duplicates(
      rows('ai_usage_event').flatMap((row) => Object.values(row.meter_identifiers ?? {}).map((identifier) => ({ identifier }))),
      (row) => row.identifier,
    ).length,
    settlementStatus: countBy(rows('ai_usage_event'), 'settlement_status'),
    tokenTotalMismatches: rows('ai_usage_event').filter((row) => (
      row.cached_tokens > row.input_tokens || row.total_tokens !== row.input_tokens + row.output_tokens
    )).length,
    customerMismatches: rows('ai_usage_event').filter((row) => (
      userById.get(row.user_id)?.stripe_customer_id !== row.stripe_customer_id
    )).length,
  },
  billing: {
    checkoutCustomerMismatches: rows('checkout_credit_grant').filter((row) => (
      userById.get(row.user_id)?.stripe_customer_id !== row.customer_id
    )).length,
  },
  storage: {
    allowedMimeTypes: profileBucket?.allowed_mime_types ?? null,
    fileSizeLimit: profileBucket?.file_size_limit ?? null,
    missingReferencedDocuments: [...referencedDocuments].filter((path) => !profileObjects.includes(path)).length,
    objectCount: profileObjects.length,
    orphanDocuments: profileObjects.filter((path) => !referencedDocuments.has(path)).length,
    profileDocumentsBucketExists: Boolean(profileBucket),
    profileDocumentsBucketPublic: profileBucket?.public ?? null,
  },
  api: {
    tables: tableNames.filter((table) => openApi.definitions?.[table]),
    functions: Object.keys(openApi.paths ?? {}).filter((path) => path.startsWith('/rpc/')).sort(),
    jobListSmoke,
  },
  anonymousAccess,
}

console.log(JSON.stringify(report, null, 2))
