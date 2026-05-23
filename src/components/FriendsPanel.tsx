'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  getFriendsList,
  getPendingRequests,
  getBlockedUsers,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  deleteFriendship,
  blockUser,
  unblockUser,
  getInviteLink,
} from '@/lib/friends'
import { FriendWithProfile } from '@/lib/friends'
import { FriendActionsMenu } from './FriendActionsMenu'
import { ChatPanel } from './ChatPanel'
import { ChallengePicker } from './ChallengePicker'
import { getUnreadChallenges, markChallengeAsRead } from '@/lib/messages'
import { supabase } from '@/lib/supabase'

interface FriendsPanelProps {
  playerId: string
  unreadBySender?: Record<string, number>
}

export function FriendsPanel({ playerId, unreadBySender = {} }: FriendsPanelProps) {
  const router = useRouter()
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [pending, setPending] = useState<{ incoming: FriendWithProfile[]; outgoing: FriendWithProfile[] }>({ incoming: [], outgoing: [] })
  const [blocked, setBlocked] = useState<FriendWithProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends')
  const [chatFriend, setChatFriend] = useState<{ id: string; name: string } | null>(null)
  const [challengeFriend, setChallengeFriend] = useState<{ id: string; name: string } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [pendingChallenges, setPendingChallenges] = useState<Map<string, { roomId: string; roomCode: string; time: number }>>(new Map())
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set())

  const loadChallenges = useCallback(async () => {
    const challenges = await getUnreadChallenges(playerId)
    const map = new Map<string, { roomId: string; roomCode: string; time: number }>()
    for (const c of challenges) {
      try {
        const parsed = JSON.parse(c.content)
        if (parsed.type === 'challenge' && parsed.roomId) {
          map.set(c.senderId, { roomId: parsed.roomId, roomCode: parsed.roomCode, time: parsed.time || 600 })
        }
      } catch {}
    }
    setPendingChallenges(map)
  }, [playerId])

  const mountedRef = useRef(true)

  const loadData = useCallback(async () => {
    const [f, p, b] = await Promise.all([
      getFriendsList(playerId),
      getPendingRequests(playerId),
      getBlockedUsers(playerId),
    ])
    if (!mountedRef.current) return
    setFriends(f)
    setPending(p)
    setBlocked(b)
    setLoading(false)
    loadChallenges()
  }, [playerId, loadChallenges])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    mountedRef.current = true
    loadData()
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { mountedRef.current = false }
  }, [loadData])

  useEffect(() => {
    if (!playerId) return

    const channel = supabase.channel('global-presence', {
      config: { presence: { key: playerId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const online = new Set(Object.keys(state))
        setOnlineFriends(online)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: playerId, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      if (!mountedRef.current) return
      setSearching(true)
      const results = await searchUsers(searchQuery, playerId)
      if (!mountedRef.current) return
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchQuery, playerId])

  const handleAddFriend = async (receiverId: string) => {
    const { error } = await sendFriendRequest(playerId, receiverId)
    if (!error) {
      setSearchQuery('')
      setSearchResults([])
      loadData()
    }
  }

  const handleAccept = async (senderId: string) => {
    await acceptFriendRequest(senderId, playerId)
    loadData()
  }

  const handleReject = async (senderId: string) => {
    await rejectFriendRequest(senderId, playerId)
    loadData()
  }

  const handleDelete = async (friendId: string) => {
    await deleteFriendship(playerId, friendId)
    loadData()
  }

  const handleAcceptChallenge = async (challenge: { roomId: string; roomCode: string; time: number }, senderId: string, senderName: string) => {
    await supabase
      .from('room_players')
      .upsert({ room_id: challenge.roomId, player_id: playerId, team: 'BLACK', slot: 0, status: 'ready' }, { onConflict: 'room_id,player_id' })
    await supabase
      .from('duel_games')
      .update({ player_black: playerId })
      .eq('room_id', challenge.roomId)
    await markChallengeAsRead(playerId, senderId)
    router.push(`/duel?room=${challenge.roomId}&code=${challenge.roomCode}&team=BLACK&playerId=${playerId}&time=${challenge.time}`)
  }

  const handleUnblock = async (userId: string) => {
    await unblockUser(playerId, userId)
    loadData()
  }

  const handleBlock = async (friendId: string) => {
    await blockUser(playerId, friendId)
    loadData()
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(getInviteLink(playerId))
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const totalRequests = pending.incoming.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="space-y-3 mb-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full min-h-[44px] px-4 py-2 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-yellow-400 focus:outline-none text-sm"
          />
          {searching && (
            <p className="text-gray-500 text-xs mt-1">Searching...</p>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl overflow-hidden z-20 shadow-lg">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAddFriend(user.id)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/[0.05] transition-colors flex items-center justify-between min-h-[44px]"
                >
                  <span>{user.username}</span>
                  <span className="text-yellow-400 text-xs">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={copyInviteLink}
          className="w-full min-h-[44px] px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-2"
        >
          📋 {inviteCopied ? 'Link copied!' : 'Copy invite link'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <TabButton active={tab === 'friends'} onClick={() => setTab('friends')}>
          Friends ({friends.length})
        </TabButton>
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests {totalRequests > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{totalRequests}</span>}
        </TabButton>
        <TabButton active={tab === 'blocked'} onClick={() => setTab('blocked')}>
          Blocked
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-gray-500 text-xs text-center py-4">Loading...</p>
        ) : (
          <>
            {tab === 'friends' && (
              <FriendList
                friends={friends}
                unreadBySender={unreadBySender}
                pendingChallenges={pendingChallenges}
                onlineFriends={onlineFriends}
                onMessage={(f) => setChatFriend({ id: f.friend_id, name: f.friend_username })}
                onChallenge={(f) => setChallengeFriend({ id: f.friend_id, name: f.friend_username })}
                onDelete={(f) => handleDelete(f.friend_id)}
                onBlock={(f) => handleBlock(f.friend_id)}
                onAcceptChallenge={(f) => {
                  const ch = pendingChallenges.get(f.friend_id)
                  if (ch) handleAcceptChallenge(ch, f.friend_id, f.friend_username)
                }}
              />
            )}

            {tab === 'requests' && (
              <div className="space-y-3">
                {pending.incoming.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Incoming</p>
                    {pending.incoming.map((req) => (
                      <div key={req.sender_id + req.receiver_id} className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-gray-200 text-sm">{req.friend_username}</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleAccept(req.sender_id)} className="min-h-[36px] min-w-[36px] px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500 transition-colors">Accept</button>
                          <button onClick={() => handleReject(req.sender_id)} className="min-h-[36px] min-w-[36px] px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 transition-colors">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pending.outgoing.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Outgoing</p>
                    {pending.outgoing.map((req) => (
                      <div key={req.sender_id + req.receiver_id} className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-gray-400 text-sm">{req.friend_username}</span>
                        <span className="text-gray-600 text-xs">Pending</span>
                      </div>
                    ))}
                  </div>
                )}

                {pending.incoming.length === 0 && pending.outgoing.length === 0 && (
                  <p className="text-gray-500 text-xs text-center py-4">No pending requests</p>
                )}
              </div>
            )}

            {tab === 'blocked' && (
              <div>
                {blocked.length === 0 ? (
                  <p className="text-gray-500 text-xs text-center py-4">No blocked users</p>
                ) : (
                  blocked.map((b) => (
                    <div key={b.receiver_id} className="flex items-center justify-between py-2 border-b border-white/5">
                      <span className="text-gray-400 text-sm">{b.friend_username}</span>
                      <button onClick={() => handleUnblock(b.receiver_id)} className="min-h-[36px] px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 transition-colors">Unblock</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat Panel Overlay */}
      {chatFriend && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setChatFriend(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <ChatPanel
              currentUserId={playerId}
              friendId={chatFriend.id}
              friendName={chatFriend.name}
              onClose={() => setChatFriend(null)}
            />
          </div>
        </div>
      )}

      {/* Challenge Picker Overlay */}
      {challengeFriend && (
        <ChallengePicker
          currentUserId={playerId}
          friendId={challengeFriend.id}
          friendName={challengeFriend.name}
          onClose={() => setChallengeFriend(null)}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-yellow-500/20 text-yellow-400'
          : 'text-gray-400 hover:text-gray-300 hover:bg-white/[0.03]'
      }`}
    >
      {children}
    </button>
  )
}

function FriendList({
  friends,
  unreadBySender = {},
  pendingChallenges,
  onlineFriends,
  onMessage,
  onChallenge,
  onDelete,
  onBlock,
  onAcceptChallenge,
}: {
  friends: FriendWithProfile[]
  unreadBySender: Record<string, number>
  pendingChallenges?: Map<string, { roomId: string; roomCode: string; time: number }>
  onlineFriends: Set<string>
  onMessage: (f: FriendWithProfile) => void
  onChallenge: (f: FriendWithProfile) => void
  onDelete: (f: FriendWithProfile) => void
  onBlock: (f: FriendWithProfile) => void
  onAcceptChallenge?: (f: FriendWithProfile) => void
}) {
  if (friends.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-3xl mb-2">👥</p>
        <p className="text-gray-500 text-sm mb-1">No friends yet</p>
        <p className="text-gray-600 text-xs">Search for players or share your invite link!</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {friends.map((friend) => (
        <div
          key={friend.friend_id}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <span className="text-xl">👤</span>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${onlineFriends.has(friend.friend_id) ? 'bg-green-500' : 'bg-gray-600'}`} />
            </div>
            <span className="text-gray-200 text-sm truncate">{friend.friend_username}</span>
            {unreadBySender[friend.friend_id] && (
              <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                {unreadBySender[friend.friend_id]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {pendingChallenges?.has(friend.friend_id) && onAcceptChallenge && (
              <button
                onClick={(e) => { e.stopPropagation(); onAcceptChallenge(friend) }}
                className="min-h-[36px] px-3 py-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-semibold rounded-lg hover:bg-yellow-500/25 transition-colors whitespace-nowrap"
              >
                ⚡ Accept
              </button>
            )}
            <FriendActionsMenu
              onDelete={() => onDelete(friend)}
              onMessage={() => onMessage(friend)}
              onChallenge={() => onChallenge(friend)}
              onBlock={() => onBlock(friend)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
