import { useEffect } from 'react'
import { useRouter } from 'next/router'

// /writing merged into /projects — keep old links working
export default function Writing() {
  const router = useRouter()
  useEffect(() => { router.replace('/projects') }, [router])
  return null
}
