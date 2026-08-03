import { ProfileOnboarding } from '@/components/ProfileOnboarding'
import { ProfileWorkbench } from '@/components/ProfileWorkbench'
import { getCanonicalProfile } from '@/lib/profile'

export default async function ProfilePage() {
  const profile = await getCanonicalProfile()
  if (!profile) return <ProfileOnboarding />
  return <ProfileWorkbench profile={profile} />
}
