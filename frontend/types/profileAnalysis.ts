export type ProfileAnalysisStatus = 'queued' | 'running' | 'cancel_requested' | 'cancelled' | 'succeeded' | 'failed'

export interface ProfileAnalysisPreferences {
  desiredSkills: Array<{ name: string; priority: 1 | 2 | 3 }>
  focus: 'backend' | 'frontend' | 'full_stack' | 'ai'
  language: 'pt' | 'en'
  markets: 'brazil' | 'international' | 'both'
  targetRoles: string[]
}

export interface ProfileAnalysisJob {
  id: string
  status: ProfileAnalysisStatus
  modelId: string
  documentName: string
  documentMimeType: string
  preferences: ProfileAnalysisPreferences
  progress: number
  currentStep: string | null
  attemptCount: number
  cancelRequestedAt: string | null
  retryOfJobId: string | null
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileAnalysis {
  id: string
  jobId: string
  modelId: string
  promptVersion: string
  canonicalProfileDraft: Record<string, unknown>
  cvAssessment: Record<string, unknown>
  sourceEvidence: unknown[]
  pendingQuestions: unknown[]
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileAnalysisDetail {
  analysis: ProfileAnalysis | null
  job: ProfileAnalysisJob
}
