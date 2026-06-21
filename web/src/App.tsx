import { useEffect, useState } from 'react'
import { Landing } from './landing/Landing'
import { Dashboard } from './dashboard/Dashboard'

export default function App() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''))
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash === '#dashboard' ? <Dashboard /> : <Landing />
}
