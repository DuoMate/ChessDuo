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
  cancelFriendRequest,
  deleteFriendship,
  blockUser,
  unblockUser,
  getInviteLink,
} from '@/lib/friends'
import { FriendWithProfile } from '@/lib/friends'
import { FriendActionsMenu } from './FriendActionsMenu'
import { notifyFriendRequest } from '@/features/push-notifications'
import { ChatPanel } from './ChatPanel'
import { ChallengePicker } from './ChallengePicker'
import { getUnreadChallenges, markChallengeAsRead } from '@/lib/messages'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { InitialsAvatar } from './InitialsAvatar'
import { Users, Search, SlidersHorizontal, Link2, Crown, MessageCircle, MoreVertical, Send, Paperclip } from 'lucide-react'

interface FriendsPanelProps {
  playerId: string
  unreadBySender?: Record<string, number>
  onClose?: () => void
}

export function FriendsPanel({ playerId, unreadBySender = {}, onClose }: FriendsPanelProps) {
  const router = useRouter()
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [pending, setPending] = useState<{ incoming: FriendWithProfile[]; outgoing: FriendWithProfile[] }>({ incoming: [], outgoing: [] })
  const [blocked, setBlocked] = useState<FriendWithProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; display_name: string | null }[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'friends' | 'requests' | 'blocked'>('friends')
  const [chatFriend, setChatFriend] = useState<{ id: string; name: string } | null>(null)
  const [challengeFriend, setChallengeFriend] = useState<{ id: string; name: string } | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      } catch { /* challenge content parse failed — skip */ }
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
    const channel = supabase
      .channel('friendship-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `sender_id=eq.${playerId}`,
        },
        () => { if (mountedRef.current) loadData() }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `receiver_id=eq.${playerId}`,
        },
        () => { if (mountedRef.current) loadData() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId, loadData])

  useEffect(() => {
    return () => clearTimeout(copiedTimerRef.current)
  }, [])

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
      const user = searchResults.find((u) => u.id === receiverId)
      const senderName = user?.display_name || user?.username || 'Someone'
      notifyFriendRequest(playerId, receiverId, senderName)
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

  const handleCancel = async (receiverId: string) => {
    await cancelFriendRequest(playerId, receiverId)
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
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setInviteCopied(false), 2000)
  }

  const totalRequests = pending.incoming.length

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Friends</h2>
            <p className="text-xs text-slate-400">Connect, play &amp; grow together</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <span className="text-slate-400 text-lg">&times;</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full min-h-[44px] pl-10 pr-12 py-2 bg-slate-800/50 text-white rounded-xl border border-white/5 focus:border-blue-500/50 focus:outline-none text-sm placeholder:text-slate-500"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
            <SlidersHorizontal size={16} />
          </button>
          {searching && (
            <p className="text-slate-500 text-xs mt-1">Searching...</p>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden z-20 shadow-lg">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAddFriend(user.id)}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors flex items-center justify-between min-h-[44px]"
                >
                  <span>{user.username}</span>
                  <span className="text-blue-400 text-xs">+ Invite</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Invite Link */}
        <button
          onClick={copyInviteLink}
          className="w-full min-h-[44px] px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-left hover:bg-amber-500/10 transition-colors flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Link2 size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-400">{inviteCopied ? 'Link copied!' : 'Copy invite link'}</p>
            <p className="text-xs text-slate-400">Invite your friends to ChessDuo</p>
          </div>
          <span className="text-slate-500">&rsaquo;</span>
        </button>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setTab('friends')}
            className={`flex-1 min-h-[44px] px-3 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'friends'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users size={14} />
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`flex-1 min-h-[44px] px-3 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'requests'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Send size={14} />
            Requests
            {totalRequests > 0 && (
              <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{totalRequests}</span>
            )}
          </button>
          <button
            onClick={() => setTab('blocked')}
            className={`flex-1 min-h-[44px] px-3 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'blocked'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="text-base">⊘</span>
            Blocked
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <p className="text-slate-500 text-xs text-center py-4">Loading...</p>
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
              <RequestsTab
                pending={pending}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
              />
            )}

            {tab === 'blocked' && (
              <BlockedTab
                blocked={blocked}
                onUnblock={handleUnblock}
              />
            )}
          </>
        )}
      </div>

      {/* Chat Panel Overlay */}
      <AnimatePresence>
        {chatFriend && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setChatFriend(null)}
          >
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <ChatPanel
                currentUserId={playerId}
                friendId={chatFriend.id}
                friendName={chatFriend.name}
                onClose={() => setChatFriend(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Users size={24} className="text-white" />
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">No friends yet</p>
        <p className="text-slate-500 text-xs">Search for players or share your invite link!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">Your Friends</p>
      {friends.map((friend) => (
        <div
          key={friend.friend_id}
          className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-2xl hover:bg-slate-800/70 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <InitialsAvatar
              username={friend.friend_username}
              size="md"
              src={friend.friend_avatar_url || null}
              online={onlineFriends.has(friend.friend_id)}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium truncate">{friend.friend_username}</span>
                {unreadBySender[friend.friend_id] && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {unreadBySender[friend.friend_id]}
                  </span>
                )}
              </div>
              {onlineFriends.has(friend.friend_id) && (
                <span className="text-emerald-400 text-xs">Online</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {pendingChallenges?.has(friend.friend_id) && onAcceptChallenge && (
              <button
                onClick={(e) => { e.stopPropagation(); onAcceptChallenge(friend) }}
                className="min-h-[44px] px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-lg hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                ⚡ Accept
              </button>
            )}
            <button
              onClick={() => onMessage(friend)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            >
              <MessageCircle size={16} />
            </button>
            <FriendActionsMenu
              onDelete={() => onDelete(friend)}
              onMessage={() => onMessage(friend)}
              onChallenge={() => onChallenge(friend)}
              onBlock={() => onBlock(friend)}
            />
          </div>
        </div>
      ))}

      {/* More Friends Card */}
      <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Crown size={20} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold mb-1">More friends, more fun!</p>
            <p className="text-slate-400 text-xs">Challenge your friends and climb the ranks together.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RequestsTab({
  pending,
  onAccept,
  onReject,
  onCancel,
}: {
  pending: { incoming: FriendWithProfile[]; outgoing: FriendWithProfile[] }
  onAccept: (senderId: string) => void
  onReject: (senderId: string) => void
  onCancel: (receiverId: string) => void
}) {
  return (
    <div className="space-y-4">
      {pending.incoming.length > 0 && (
        <div>
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Incoming</p>
          {pending.incoming.map((req) => (
            <div key={req.sender_id + req.receiver_id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <InitialsAvatar username={req.friend_username} size="md" src={req.friend_avatar_url || null} />
                <div>
                  <span className="text-white text-sm font-medium">{req.friend_username}</span>
                  <p className="text-slate-400 text-xs">Wants to be your friend</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onAccept(req.sender_id)} className="min-h-[44px] px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-500 transition-colors">Accept</button>
                <button onClick={() => onReject(req.sender_id)} className="min-h-[44px] px-4 py-2 bg-slate-700 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.outgoing.length > 0 && (
        <div>
          <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2">Outgoing Requests</p>
          {pending.outgoing.map((req) => (
            <div key={req.sender_id + req.receiver_id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <InitialsAvatar username={req.friend_username} size="md" src={req.friend_avatar_url || null} />
                <div>
                  <span className="text-white text-sm font-medium">{req.friend_username}</span>
                  <p className="text-slate-400 text-xs">Request sent</p>
                </div>
              </div>
              <button
                onClick={() => onCancel(req.receiver_id || req.sender_id)}
                className="px-3 py-1 min-h-[44px] min-w-[44px] bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs font-medium rounded-full transition-colors border border-slate-600/50 hover:border-red-500/30"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {pending.incoming.length === 0 && pending.outgoing.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Send size={24} className="text-blue-400" />
          </div>
          <p className="text-slate-300 text-sm font-medium mb-1">No pending requests</p>
          <p className="text-slate-500 text-xs">Your friend request is on its way!</p>
          <p className="text-slate-500 text-xs">You&apos;ll be notified when they accept.</p>
        </div>
      )}
    </div>
  )
}

function BlockedTab({
  blocked,
  onUnblock,
}: {
  blocked: FriendWithProfile[]
  onUnblock: (userId: string) => void
}) {
  if (blocked.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
          <span className="text-2xl">⊘</span>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">No blocked users</p>
        <p className="text-slate-500 text-xs">You haven&apos;t blocked anyone.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocked.map((b) => (
        <div key={b.receiver_id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <InitialsAvatar username={b.friend_username} size="md" src={b.friend_avatar_url || null} />
            <span className="text-white text-sm font-medium">{b.friend_username}</span>
          </div>
          <button onClick={() => onUnblock(b.receiver_id)} className="min-h-[44px] px-4 py-2 bg-slate-700 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors">Unblock</button>
        </div>
      ))}
    </div>
  )
}
