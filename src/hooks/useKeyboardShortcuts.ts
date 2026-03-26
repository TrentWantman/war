import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

export function useKeyboardShortcuts() {
  const game = useGameStore(s => s.game)
  const rollDice = useGameStore(s => s.rollDice)
  const endTurn = useGameStore(s => s.endTurn)
  const toggleBuildMenu = useGameStore(s => s.toggleBuildMenu)
  const toggleTradeMenu = useGameStore(s => s.toggleTradeMenu)
  const toggleDevCardMenu = useGameStore(s => s.toggleDevCardMenu)
  const isMyTurn = useGameStore(s => s.isMyTurn)

  useEffect(() => {
    if (!game) return

    const currentPlayer = game.players[game.playerOrder[game.currentPlayerIndex]]
    if (currentPlayer.isAI) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (!isMyTurn()) return

      switch (e.key.toLowerCase()) {
        case 'r':
          if (game.phase === 'playing' && !game.hasRolled) {
            e.preventDefault()
            rollDice()
          }
          break
        case 'e':
          if (game.phase === 'playing' && game.hasRolled) {
            e.preventDefault()
            endTurn()
          }
          break
        case 'b':
          if (game.phase === 'playing' && game.hasRolled) {
            e.preventDefault()
            toggleBuildMenu()
          }
          break
        case 't':
          if (game.phase === 'playing' && game.hasRolled) {
            e.preventDefault()
            toggleTradeMenu()
          }
          break
        case 'd':
          if (game.phase === 'playing') {
            e.preventDefault()
            toggleDevCardMenu()
          }
          break
        case 'escape':
          toggleBuildMenu(false)
          toggleTradeMenu(false)
          toggleDevCardMenu(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [game, rollDice, endTurn, toggleBuildMenu, toggleTradeMenu, toggleDevCardMenu, isMyTurn])
}
