'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { sendMessage, getConversation, markMessagesAsRead, subscribeToMessages } from '@/lib/messages'
import { Message } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'
import { notifyChatMessage } from '@/features/push-notifications'

interface ChatPanelProps {
  currentUserId: string
  friendId: string
  friendName: string
  onClose: () => void
}

export function ChatPanel({ currentUserId, friendId, friendName, onClose }: ChatPanelProps) {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    getConversation(currentUserId, friendId).then(msgs => {
      setMessages(msgs)
      setLoading(false)
      scrollTimerRef.current = setTimeout(scrollToBottom, 100)
    }).catch(() => {
      setLoading(false)
    })

    markMessagesAsRead(currentUserId, friendId)

    unsubRef.current = subscribeToMessages(currentUserId, (msg) => {
      if (msg.sender_id === friendId || msg.receiver_id === friendId) {
        setMessages(prev => [...prev, msg])
        clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = setTimeout(scrollToBottom, 100)
        if (msg.sender_id === friendId) {
          markMessagesAsRead(currentUserId, friendId)
        }
      }
    })

    return () => {
      unsubRef.current?.()
      clearTimeout(scrollTimerRef.current)
    }
  }, [currentUserId, friendId, scrollToBottom])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const { data } = await sendMessage(currentUserId, friendId, input.trim())
    if (data) {
      setMessages(prev => [...prev, data])
      setInput('')
      clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(scrollToBottom, 100)
      notifyChatMessage(friendId, currentUserId, 'You', input.trim().slice(0, 100))
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex flex-col bg-gray-50 dark:bg-[#0a0e1a] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden ${isMobile ? 'fixed inset-0 z-[70] rounded-none' : ''}`} style={isMobile ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : { minHeight: '320px', maxHeight: '60vh' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/8 bg-gray-100 dark:bg-white/[0.03]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{friendName}</h3>
        <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-base min-w-[44px] min-h-[44px] flex items-center justify-center">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={isMobile ? undefined : { maxHeight: 'calc(60vh - 110px)' }}>
        {loading ? (
          <p className="text-gray-500 text-xs text-center py-4">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.sender_id === currentUserId
                    ? 'bg-yellow-500/20 text-yellow-100 border border-yellow-500/20'
                    : 'bg-gray-100 dark:bg-white/[0.05] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/8'
                }`}
              >
                <p className="break-words">{msg.content}</p>
                <p className="text-xs mt-1 opacity-50">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/[0.02]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 min-h-[44px] px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-white/8 focus:border-yellow-500/50 focus:outline-none text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="min-w-[44px] min-h-[44px] px-4 py-2 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-40 text-sm transition-colors flex items-center justify-center"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
