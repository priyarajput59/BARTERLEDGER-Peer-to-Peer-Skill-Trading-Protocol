import Navigation from './components/Navigation'
import Notifications from './components/Notifications'
import Market from './pages/Market'
import Propose from './pages/Propose'
import MyTrades from './pages/MyTrades'
import Profile from './pages/Profile'
import { useBarterStore } from './lib/store'

export default function App() {
  const { activeTab } = useBarterStore()

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10">
        <Navigation />
        <main>
          {activeTab === 'market'   && <Market   />}
          {activeTab === 'propose'  && <Propose  />}
          {activeTab === 'mytrades' && <MyTrades />}
          {activeTab === 'profile'  && <Profile  />}
        </main>
      </div>
      <Notifications />
    </div>
  )
}
