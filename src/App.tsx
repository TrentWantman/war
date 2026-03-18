import { useGameStore } from './store/gameStore'
import { Lobby } from './components/layout/Lobby'
import { GameLayout } from './components/layout/GameLayout'

function App() {
  const game = useGameStore(s => s.game)
  return game ? <GameLayout /> : <Lobby />
}

export default App
