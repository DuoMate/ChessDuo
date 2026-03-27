'use client'

import { useEffect, useRef } from 'react'
import { Chessboard, COLOR, INPUT_EVENT_TYPE } from 'cm-chessboard'

interface ChessBoardProps {
  fen: string
  onMove: (move: string) => void
  enabled?: boolean
  orientation?: 'white' | 'black'
}

export function ChessBoard({ fen, onMove, enabled = true, orientation = 'white' }: ChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Chessboard | null>(null)
  const onMoveRef = useRef(onMove)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    if (!containerRef.current) return

    boardRef.current = new Chessboard(containerRef.current, {
      position: fen,
      orientation: orientation === 'white' ? COLOR.white : COLOR.black,
      assetsUrl: '/cm-chessboard/'
    })

    return () => {
      boardRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.setPosition(fen)
    }
  }, [fen])

  useEffect(() => {
    if (!boardRef.current) return

    if (enabledRef.current) {
      boardRef.current.enableMoveInput((event: any) => {
        if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
          const { squareFrom, squareTo } = event
          if (squareFrom && squareTo) {
            const move = `${squareFrom}-${squareTo}`
            onMoveRef.current(move)
          }
        }
        return true
      }, orientation === 'white' ? COLOR.white : COLOR.black)
    } else {
      boardRef.current.disableMoveInput()
    }
  }, [orientation])

  return (
    <div 
      ref={containerRef} 
      className="w-full max-w-[500px] mx-auto"
    />
  )
}
