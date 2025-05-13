import React from 'react'
import type { GameState } from '../../types/game'

interface HistoryListProps {
  history: GameState['history']
  expandedMap: Record<number, boolean>
  onToggle: (age: number) => void
}

export function HistoryList({ history, expandedMap, onToggle }: HistoryListProps) {
  if (history.length === 0) {
    return <div className="text-center text-gray-500 py-8">还没有历史记录</div>
  }

  return (
    <div className="space-y-4">
      {history.map(evt => {
        const expanded = expandedMap[evt.age]
        return (
          <div key={evt.age} className="border rounded-lg">
            <button
              onClick={() => onToggle(evt.age)}
              className="w-full flex justify-between items-center px-4 py-2 text-left"
            >
              <span className="flex items-center">
                {expanded ? '▼' : '▶'}&nbsp;
                <strong>{evt.age} 岁：</strong>
                <span className="ml-2 text-gray-700">
                  {expanded
                    ? evt.question
                    : evt.question.length > 30
                    ? evt.question.slice(0, 30) + '…'
                    : evt.question}
                </span>
              </span>
            </button>
            {expanded && (
              <div className="px-6 py-2 bg-gray-50 text-sm text-gray-600">
                <p><strong>Q:</strong> {evt.question}</p>
                <p><strong>你的选项:</strong> {evt.choice}</p>
                <p><strong>结果:</strong> {evt.outcome}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
} 