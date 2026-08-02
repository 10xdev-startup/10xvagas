import { SourcesLedger } from '@/components/SourcesLedger'
import { getExperimentDashboardData } from '@/lib/experiment'

export default async function SourcesPage() {
  const data = await getExperimentDashboardData()
  return <SourcesLedger sources={data.sources} />
}
