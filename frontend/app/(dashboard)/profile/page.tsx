import { ProfileWorkbench } from '@/components/ProfileWorkbench'
import { getCanonicalProfile } from '@/lib/profile'

export default async function ProfilePage() {
  return <ProfileWorkbench profile={await getCanonicalProfile()} />
}
