import { JobDetailWorkspace } from '@/components/JobDetailWorkspace'

export default async function JobPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params
  return <JobDetailWorkspace publicId={publicId} />
}
