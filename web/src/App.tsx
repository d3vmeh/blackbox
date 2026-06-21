import { Landing } from './landing/Landing'
import { Dashboard } from './dashboard/Dashboard'

export default function App() {
  // Static SPA: no router. The dashboard lives at #dashboard.
  if (typeof window !== 'undefined' && window.location.hash === '#dashboard') {
    return <Dashboard />
  }
  return <Landing />
}
