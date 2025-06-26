import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Hash, 
  Lock, 
  Users, 
  Settings, 
  Search,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  Mic,
  MicOff,
  Circle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import CreateChannelModal from './CreateChannelModal';
import { io as socketIOClient } from 'socket.io-client';

interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'voice';
  memberCount: number;
  unreadCount?: number;
  categoryId: string;
  privacy: 'public' | 'private';
}

interface Message {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: Date;
  edited?: boolean;
  attachment?: {
    url: string;
    name: string;
    size: number;
    type: string;
  };
  reactions?: {
    emoji: string;
    userIds: string[];
  }[];
  replyTo?: string;
}

const CreateCategoryModal: React.FC<{ onClose: () => void; onCreate: (name: string) => void }> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Create Category</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">✕</button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); onClose(); } }}
          className="p-6 space-y-6"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="category-name"
              required
            />
          </div>
          <div className="flex items-center justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim()} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChatSystem: React.FC = () => {
  const { user } = useAuth();
  const { channels, categories, messages, fetchChannels, fetchMessages, sendMessage, createChannel, users, editMessage, deleteMessage, typingUsers, sendTyping, lastReadBy, markAsRead, reactToMessage, fetchCategories } = useApp();
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [message, setMessage] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiList = ['👍', '😂', '🎉', '❤️', '😮', '😢', '😡'];
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [joinedVoiceChannel, setJoinedVoiceChannel] = useState<string | null>(null);
  const [voiceUsers, setVoiceUsers] = useState<{ id: string; name: string; avatar?: string; socketId: string }[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [socketId: string]: RTCPeerConnection }>({});
  const socket = useRef<any>(null);
  const [localVolume, setLocalVolume] = useState(0);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<{ [catId: string]: boolean }>({});
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | null>(null);
  const [showMembersSidebar, setShowMembersSidebar] = useState(true);
  const [replyToMsg, setReplyToMsg] = useState<any>(null);
  const [mutedUsers, setMutedUsers] = useState<{ [socketId: string]: boolean }>({});
  const [pinnedMsgIds, setPinnedMsgIds] = useState<string[]>([]);
  const [lastUnreadMsgId, setLastUnreadMsgId] = useState<string | null>(null);
  const [showEditCategory, setShowEditCategory] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteCategory, setShowDeleteCategory] = useState<{ id: string; name: string } | null>(null);
  const [showEditChannel, setShowEditChannel] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteChannel, setShowDeleteChannel] = useState<{ id: string; name: string } | null>(null);
  const [remoteVolumes, setRemoteVolumes] = useState<{ [socketId: string]: number }>({});
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    fetchChannels();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel);
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedChannel && messages.length > 0 && user) {
      const lastMsg = messages[messages.length - 1];
      markAsRead(selectedChannel, lastMsg.id);
    }
  }, [selectedChannel, messages.length, user]);

  useEffect(() => {
    if (!socket.current) {
      socket.current = socketIOClient(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    }
    const s = socket.current;
    // Listen for voice users
    s.on('voice:users', (users: any[]) => {
      console.log('[voice:users] event received:', users);
      setVoiceUsers(users);
      // Attempt to connect to any new users
      if (localStream && joinedVoiceChannel) {
        users.forEach(u => {
          if (u.socketId !== s.id && !peers[u.socketId]) {
            connectToPeer(u.socketId, localStream);
          }
        });
      }
    });
    // Listen for WebRTC signals
    s.on('voice:signal', async ({ from, data }: { from: string; data: any }) => {
      console.log('[voice:signal] received from', from, data);
      if (!joinedVoiceChannel) return;
      let pc = peers[from];
      if (!pc) {
        pc = createPeerConnection(from);
        setPeers(prev => ({ ...prev, [from]: pc }));
      }
      if (data.sdp) {
        console.log('[voice:signal] SDP type:', data.sdp.type);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit('voice:signal', { channelId: joinedVoiceChannel, to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        console.log('[voice:signal] ICE candidate received');
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
    s.on('voice:mute', ({ socketId, muted }: { socketId: string; muted: boolean }) => {
      setMutedUsers(prev => ({ ...prev, [socketId]: muted }));
    });
    return () => {
      s.off('voice:users');
      s.off('voice:signal');
    };
  }, [joinedVoiceChannel, peers]);

  // Join/leave voice channel logic
  useEffect(() => {
    const s = socket.current;
    if (joinedVoiceChannel && user) {
      // Join voice channel
      s.emit('join_voice', { channelId: joinedVoiceChannel, user: { id: user.id, name: user.name, avatar: user.avatar } });
      // Get mic
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        console.log('[getUserMedia] Success, stream:', stream);
        setLocalStream(stream);
        // Debug: show local audio preview
        const localAudio = document.getElementById('audio-local') as HTMLAudioElement;
        if (localAudio) {
          localAudio.srcObject = stream;
          localAudio.muted = true;
          localAudio.play();
        }
        // Connect to existing users
        setTimeout(() => {
          voiceUsers.forEach(u => {
            if (u.socketId !== s.id) connectToPeer(u.socketId, stream);
          });
        }, 500);
      }).catch(err => {
        console.error('[getUserMedia] Error:', err);
        alert('Microphone access denied or not available.');
      });
    } else if (!joinedVoiceChannel && localStream) {
      // Leave voice channel
      s.emit('leave_voice', { channelId: joinedVoiceChannel });
      setVoiceUsers([]);
      setPeers({});
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    // Cleanup on unmount
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line
  }, [joinedVoiceChannel]);

  // WebRTC helpers
  function createPeerConnection(socketId: string) {
    const s = socket.current;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log('Adding local track to peer', socketId, track);
        pc.addTrack(track, localStream);
      });
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to', socketId);
        s.emit('voice:signal', { channelId: joinedVoiceChannel, to: socketId, data: { candidate: event.candidate } });
      }
    };
    pc.ontrack = (event) => {
      console.log('Received remote track from', socketId, event.streams);
      const audio = document.getElementById('audio-' + socketId) as HTMLAudioElement;
      if (audio) {
        audio.srcObject = event.streams[0];
        audio.muted = false;
        audio.volume = 1;
        console.log('Setting srcObject and playing audio for', socketId, audio);
        audio.play().then(() => {
          console.log('audio.play() succeeded for', socketId);
        }).catch(err => {
          console.error('audio.play() failed for', socketId, err);
        });
        // Speaking indicator
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = ctx.createAnalyser();
          const source = ctx.createMediaStreamSource(event.streams[0]);
          source.connect(analyser);
          analyser.fftSize = 256;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let running = true;
          function updateVolume() {
            if (!running) return;
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const val = (dataArray[i] - 128) / 128;
              sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setRemoteVolumes(prev => ({ ...prev, [socketId]: rms }));
            requestAnimationFrame(updateVolume);
          }
          updateVolume();
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
              running = false;
              source.disconnect();
              analyser.disconnect();
              ctx.close();
            }
          };
        } catch {}
      } else {
        console.warn('Audio element not found for', socketId);
      }
    };
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state with', socketId, pc.connectionState);
    };
    return pc;
  }
  async function connectToPeer(socketId: string, stream: MediaStream) {
    const s = socket.current;
    const pc = createPeerConnection(socketId);
    setPeers(prev => ({ ...prev, [socketId]: pc }));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('Sending offer to', socketId);
    s.emit('voice:signal', { channelId: joinedVoiceChannel, to: socketId, data: { sdp: pc.localDescription } });
  }
  // Mute/unmute
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
    }
  }, [isMuted, localStream]);

  // Ensure peer connections are made as soon as both localStream and voiceUsers are available
  useEffect(() => {
    const s = socket.current;
    if (localStream && joinedVoiceChannel && voiceUsers.length > 0) {
      voiceUsers.forEach(u => {
        if (u.socketId !== s.id && !peers[u.socketId]) {
          connectToPeer(u.socketId, localStream);
        }
      });
    }
    // eslint-disable-next-line
  }, [localStream, joinedVoiceChannel, voiceUsers]);

  useEffect(() => {
    if (localStream) {
      // Set up Web Audio API analyser for local audio level
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);
      localAnalyserRef.current = analyser;
      localAudioContextRef.current = audioContext;
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let running = true;
      function updateVolume() {
        if (!running) return;
        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS (root mean square) volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setLocalVolume(rms);
        requestAnimationFrame(updateVolume);
      }
      updateVolume();
      return () => {
        running = false;
        source.disconnect();
        analyser.disconnect();
        audioContext.close();
      };
    } else {
      setLocalVolume(0);
    }
  }, [localStream]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !attachment) || !selectedChannel) return;
    let attachmentData = null;
    if (attachment) {
      setUploading(true);
      const formData = new FormData();
      formData.append('attachment', attachment);
      const token = localStorage.getItem('frooxi_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload/attachment`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      } as any);
      if (res.ok) {
        const data = await res.json();
        attachmentData = {
          url: data.url,
          name: data.name,
          size: data.size,
          type: data.type,
        };
      }
      setUploading(false);
      setAttachment(null);
    }
    await sendMessage(selectedChannel, message, attachmentData, replyToMsg?.id || null);
    setMessage('');
    setReplyToMsg(null);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  const textChannels = channels.filter(c => c.type !== 'voice');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  // Test tone function
  function playTestTone() {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 440;
    g.gain.value = 0.2;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 600); // 600ms tone
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const picker = document.querySelector('.emoji-picker-popover');
      if (picker && !picker.contains(e.target as Node)) {
        setShowEmojiPickerFor(null);
      }
    }
    if (showEmojiPickerFor) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPickerFor]);

  const handleEditCategory = async (id: string, name: string) => {
    const token = localStorage.getItem('frooxi_token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    await fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const token = localStorage.getItem('frooxi_token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/categories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await fetchCategories();
  };

  const handleEditChannel = async (id: string, name: string) => {
    const token = localStorage.getItem('frooxi_token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    await fetchChannels();
  };

  const handleDeleteChannel = async (id: string) => {
    const token = localStorage.getItem('frooxi_token');
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/channels/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await fetchChannels();
  };

  // Draggable handlers
  const onPanelMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current && (e.target as HTMLElement).closest('.draggable-panel-header')) {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - panelPos.x,
        y: e.clientY - panelPos.y,
      };
      document.body.style.userSelect = 'none';
    }
  };
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPanelPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      }
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [panelPos]);

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar - Channels */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Server Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Frooxi Workspace Team</h2>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {/* Categories & Channels */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            {categories.sort((a, b) => a.order - b.order).map(category => (
              <div key={category.id} className="mb-2">
                <div className="flex items-center justify-between px-2 py-1 cursor-pointer group" onClick={() => setExpandedCategories(ec => ({ ...ec, [category.id]: !ec[category.id] }))}>
                  <div className="flex items-center space-x-2">
                    {expandedCategories[category.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{category.name}</span>
              {isAdmin && (
                      <div className="relative group">
                        <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-2" onClick={e => { e.stopPropagation(); setCreateChannelCategoryId(category.id); setShowCreateChannel(true); }} title="Add Channel"><Plus className="w-4 h-4" /></button>
                        <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1" onClick={e => { e.stopPropagation(); setShowEditCategory({ id: category.id, name: category.name }); }} title="Edit Category">✎</button>
                        <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1" onClick={e => { e.stopPropagation(); setShowDeleteCategory({ id: category.id, name: category.name }); }} title="Delete Category">🗑️</button>
                      </div>
              )}
            </div>
                </div>
                {expandedCategories[category.id] !== false && (
                  <div className="pl-6 space-y-1 mt-1">
                    {channels.filter(c => c.categoryId === category.id).map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors ${selectedChannel === channel.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'}`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                          {channel.type === 'voice' ? (
                            <Volume2 className="w-4 h-4 flex-shrink-0 text-blue-400" />
                    ) : (
                      <Hash className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate">{channel.name}</span>
                          {channel.privacy === 'private' && <Lock className="w-4 h-4 text-gray-500 ml-1" />}
                        </div>
                        {isAdmin && (
                          <div className="relative group">
                            <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1" onClick={e => { e.stopPropagation(); setShowEditChannel({ id: channel.id, name: channel.name }); }} title="Edit Channel">✎</button>
                            <button className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1" onClick={e => { e.stopPropagation(); setShowDeleteChannel({ id: channel.id, name: channel.name }); }} title="Delete Channel">🗑️</button>
                  </div>
                  )}
                </button>
              ))}
            </div>
                )}
              </div>
            ))}
            {/* Add Category Button */}
            <button
              onClick={() => setShowCreateCategory(true)}
              className="w-full flex items-center space-x-2 px-2 py-2 mt-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 justify-center"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Category</span>
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <img
              src={user?.avatar}
              alt={user?.name}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400">Online</p>
            </div>
            <button className="p-1 text-gray-400 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-row">
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
          <div className="flex items-center space-x-3">
              {selectedChannelData?.privacy === 'private' ? (
              <Lock className="w-5 h-5 text-gray-400" />
              ) : selectedChannelData?.type === 'voice' ? (
                <Volume2 className="w-5 h-5 text-blue-400" />
            ) : (
              <Hash className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <h3 className="font-semibold text-white">{selectedChannelData?.name}</h3>
              </div>
            </div>
          <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMembersSidebar(s => !s)}>
              <Users className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedChannelData?.type === 'voice' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-300">
                <Volume2 className="w-12 h-12 text-blue-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Voice Channel: {selectedChannelData?.name}</h2>
                <p className="mb-4">You are in a voice channel. Use the floating panel to mute/unmute and see who is connected.</p>
                <p className="text-sm text-gray-400">No text chat here. Join a text channel to send messages.</p>
              </div>
            ) : (
              <>
                {pinnedMsgIds.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs text-yellow-400 uppercase tracking-wide mb-1">Pinned</h4>
                    {pinnedMsgIds.map(pid => {
                      const pmsg = messages.find(m => m.id === pid);
                      if (!pmsg) return null;
                      return (
                        <div key={pmsg.id} className="flex items-center space-x-2 bg-yellow-900/30 border-l-4 border-yellow-400 px-3 py-2 rounded mb-1">
                          <span className="text-yellow-200 text-xs font-medium truncate">{pmsg.content.slice(0, 60) || 'Attachment'}</span>
                          <button className="ml-2 text-yellow-300 hover:text-yellow-100 text-xs" onClick={() => setPinnedMsgIds(ids => ids.filter(id => id !== pmsg.id))}>Unpin</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {replyToMsg && (
                  <div className="mb-2 flex items-center bg-gray-800 border-l-4 border-purple-500 px-3 py-2 rounded">
                    <span className="text-xs text-gray-400 mr-2">Replying to</span>
                    <span className="text-sm text-white font-medium truncate max-w-xs">{replyToMsg.content.slice(0, 60) || 'Attachment'}</span>
                    <button className="ml-2 text-gray-400 hover:text-white" onClick={() => setReplyToMsg(null)}>✕</button>
                  </div>
                )}
                {messages.map((msg) => {
                  const author = users.find(u => u.id === msg.authorId);
                  const isOwn = user?.id === msg.authorId;
                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex space-x-3 hover:bg-gray-800/30 p-2 rounded-lg transition-colors group relative${lastUnreadMsgId === msg.id ? ' border-l-4 border-purple-500' : ''}`}
                    >
                      <img
                        src={author?.avatar || 'https://ui-avatars.com/api/?name=U'}
                        alt={author?.name || 'Unknown'}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-white">{author?.name || 'Unknown'}</span>
                          <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.edited && (
                    <span className="text-xs text-gray-500">(edited)</span>
                  )}
                </div>
                        {editingMsgId === msg.id ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!editingContent.trim()) return;
                              await editMessage(msg.channelId, msg.id, editingContent);
                              setEditingMsgId(null);
                              setEditingContent('');
                            }}
                            className="flex items-center space-x-2"
                          >
                            <input
                              className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-white"
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              autoFocus
                            />
                            <button type="submit" className="text-green-400 hover:text-green-600 text-xs">Save</button>
                            <button type="button" className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => setEditingMsgId(null)}>Cancel</button>
                          </form>
                        ) :
                          <>
                            {msg.content && (
                <p className="text-gray-300 leading-relaxed">{msg.content}</p>
                            )}
                            {msg.attachment && (
                              <div className="mt-1 flex items-center space-x-2">
                                <Paperclip className="w-4 h-4 text-gray-400" />
                                <a
                                  href={msg.attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 underline"
                                >
                                  {msg.attachment.name}
                                </a>
                                <span className="text-xs text-gray-500">{(msg.attachment.size / 1024).toFixed(1)} KB</span>
                              </div>
                            )}
                            {/* Reactions */}
                            <div className="flex items-center space-x-1 mt-1 relative">
                              {msg.reactions && msg.reactions.map(r => {
                                const count = r.userIds.length;
                                const reacted = user && r.userIds.includes(user.id);
                                return (
                                  <button
                                    key={r.emoji}
                                    className={`px-2 py-1 rounded-full text-sm border ${reacted ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-800 text-gray-200 border-gray-700'} hover:bg-purple-700 transition`}
                                    onClick={() => reactToMessage(msg.channelId, msg.id, r.emoji)}
                                  >
                                    {r.emoji} {count}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Hover actions: reaction button and 3-dot menu */}
                            <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              {/* Reaction button */}
                              <button
                                className="p-1 rounded-full bg-gray-700 hover:bg-purple-600 text-gray-300 hover:text-white transition"
                                onClick={() => setShowEmojiPickerFor(msg.id)}
                                title="Add Reaction"
                              >
                                <Smile className="w-5 h-5" />
                              </button>
                              {/* 3-dot menu */}
                              <div className="relative">
                                <button
                                  className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition"
                                  onClick={() => setShowEmojiPickerFor(msg.id + '-menu')}
                                  title="More actions"
                                >
                                  <MoreVertical className="w-5 h-5" />
                                </button>
                                {showEmojiPickerFor === msg.id + '-menu' && (
                                  <div className="absolute right-0 mt-2 w-36 bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
                                    <button
                                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-t"
                                      onClick={() => { setReplyToMsg(msg); setShowEmojiPickerFor(null); }}
                                    >Reply</button>
                                    {isOwn && (
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                        onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); setShowEmojiPickerFor(null); }}
                                      >Edit</button>
                                    )}
                                    {isOwn && (
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                                        onClick={async () => { if (window.confirm('Delete this message?')) { await deleteMessage(msg.channelId, msg.id); setShowEmojiPickerFor(null); }}}
                                      >Delete</button>
                                    )}
                                    <button
                                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                      onClick={() => {
                                        navigator.clipboard.writeText(window.location.href.split('#')[0] + `#msg-${msg.id}`);
                                        setShowEmojiPickerFor(null);
                                      }}
                                    >Copy Link</button>
                                    <button
                                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                      onClick={() => {
                                        setPinnedMsgIds(ids => ids.includes(msg.id) ? ids.filter(id => id !== msg.id) : [...ids, msg.id]);
                                        setShowEmojiPickerFor(null);
                                      }}
                                    >{pinnedMsgIds.includes(msg.id) ? 'Unpin' : 'Pin'}</button>
                                    <button
                                      className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-b"
                                      onClick={() => {
                                        setLastUnreadMsgId(msg.id);
                                        setShowEmojiPickerFor(null);
                                      }}
                                    >Mark Unread</button>
                                  </div>
                                )}
              </div>
            </div>
                            {/* Emoji picker (inline, on reaction button click) */}
                            {showEmojiPickerFor === msg.id && (
                              <div className="emoji-picker-popover absolute z-50 mt-2 right-10 bg-gray-800 border border-gray-700 rounded shadow-lg p-2 flex space-x-1">
                                {emojiList.map(emoji => (
                                  <button
                                    key={emoji}
                                    className="text-xl hover:bg-gray-700 rounded p-1"
                                    onClick={() => {
                                      reactToMessage(msg.channelId, msg.id, emoji);
                                      setShowEmojiPickerFor(null);
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Read receipts */}
                            <div className="flex items-center mt-1 space-x-1">
                              {lastReadBy[selectedChannel]?.filter(r => r.lastReadMessageId === msg.id && r.userId !== user?.id).map(r => {
                                const u = users.find(u => u.id === r.userId);
                                return u ? (
                                  <img
                                    key={u.id}
                                    src={u.avatar || 'https://ui-avatars.com/api/?name=U'}
                                    alt={u.name}
                                    className="w-4 h-4 rounded-full border-2 border-gray-700"
                                    title={u.name}
                                  />
                                ) : null;
                              })}
                            </div>
                            {msg.replyTo && (
                              <div className="mb-1 flex items-center text-xs text-purple-400 cursor-pointer hover:underline" onClick={() => {
                                const el = document.getElementById('msg-' + msg.replyTo);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}>
                                Replying to: {(() => {
                                  const parent = messages.find(m => m.id === msg.replyTo);
                                  return parent ? (parent.content.slice(0, 40) || 'Attachment') : 'Message';
                                })()}
                              </div>
                            )}
                          </>
                        }
                      </div>
                    </div>
                  );
                })}
                {/* Typing indicator */}
                {selectedChannel && typingUsers[selectedChannel] && typingUsers[selectedChannel].length > 0 && (
                  <div className="text-xs text-gray-400 mt-2">
                    {typingUsers[selectedChannel]
                      .filter(u => u.userId !== user?.id)
                      .map(u => u.userName)
                      .join(', ') || ''}
                    {typingUsers[selectedChannel].filter(u => u.userId !== user?.id).length > 0 && ' is typing...'}
                  </div>
                )}
              </>
            )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-700">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (selectedChannel && user) {
                      sendTyping(selectedChannel, user.id, user.name);
                    }
                  }}
                placeholder={`Message #${selectedChannelData?.name}`}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-20"
              />
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setAttachment(e.target.files[0]);
                    }
                  }}
                  disabled={uploading}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              type="submit"
                disabled={(!message.trim() && !attachment) || uploading}
              className="p-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
            {attachment && (
              <div className="mt-2 text-xs text-gray-300 flex items-center space-x-2">
                <Paperclip className="w-4 h-4" />
                <span>{attachment.name}</span>
                <button className="text-red-400 hover:text-red-600 ml-2" onClick={() => setAttachment(null)}>Remove</button>
              </div>
            )}
          </div>
        </div>
        {/* Right Sidebar: Member List */}
        {showMembersSidebar && (
          <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col p-4 overflow-y-auto">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Members</h4>
            {selectedChannelData?.type === 'voice' && joinedVoiceChannel === selectedChannelData.id ? (
              <div className="space-y-2">
                {voiceUsers.map(u => (
                  <div key={u.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800 transition">
                    <img src={u.avatar || 'https://ui-avatars.com/api/?name=U'} alt={u.name} className="w-8 h-8 rounded-full border-2 border-gray-700" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm font-medium truncate">{u.name}</span>
                    </div>
                    {mutedUsers[u.socketId] ? <MicOff className="w-4 h-4 text-gray-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                    <div className="w-10 h-2 bg-gray-700 rounded overflow-hidden ml-1">
                      <div className="h-2 bg-green-400 transition-all duration-75" style={{ width: `${Math.min((remoteVolumes[u.socketId] || 0) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800 transition">
                    <img src={u.avatar || 'https://ui-avatars.com/api/?name=U'} alt={u.name} className="w-8 h-8 rounded-full border-2 border-gray-700" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm font-medium truncate">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.role}</span>
                    </div>
                    <Circle className="w-3 h-3 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => { setShowCreateChannel(false); setCreateChannelCategoryId(null); }}
          defaultCategoryId={createChannelCategoryId}
        />
      )}

      {/* Voice Channel Floating Panel */}
      {selectedChannelData?.type === 'voice' && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', bottom: undefined, right: undefined, left: panelPos.x, top: panelPos.y, zIndex: 50, minWidth: 260 }}
          className="bg-gray-900 border border-blue-700 rounded-2xl shadow-2xl p-4"
          onMouseDown={onPanelMouseDown}
        >
          <div className="flex items-center mb-2 draggable-panel-header cursor-move select-none">
            <Volume2 className="w-5 h-5 text-blue-400 mr-2" />
            <span className="text-white font-semibold">Voice: {selectedChannelData?.name}</span>
          </div>
          {joinedVoiceChannel === selectedChannelData.id ? (
            <>
              <div className="flex flex-col space-y-2 mb-2">
                {/* Local audio preview for debugging */}
                <div className="flex flex-col items-start space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-xs">(You)</span>
                    <audio id="audio-local" autoPlay playsInline muted />
                    <button
                      className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                      onClick={playTestTone}
                    >
                      Play Test Tone
                    </button>
                  </div>
                  {/* Audio level meter */}
                  <div className="w-32 h-2 bg-gray-700 rounded overflow-hidden">
                    <div
                      className="h-2 bg-green-400 transition-all duration-75"
                      style={{ width: `${Math.min(localVolume * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {voiceUsers.length === 0 && <span className="text-gray-400 text-sm">No one is connected</span>}
                {voiceUsers.map(u => (
                  <div key={u.id} className="flex items-center space-x-2">
                    <img src={u.avatar || 'https://ui-avatars.com/api/?name=U'} alt={u.name} className="w-7 h-7 rounded-full border-2 border-gray-700" />
                    <span className="text-white text-sm">{u.name}</span>
                    {mutedUsers[u.socketId] ? <MicOff className="w-4 h-4 text-gray-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                    <div className="w-10 h-2 bg-gray-700 rounded overflow-hidden ml-1">
                      <div className="h-2 bg-green-400 transition-all duration-75" style={{ width: `${Math.min((remoteVolumes[u.socketId] || 0) * 100, 100)}%` }} />
                    </div>
                    <audio id={`audio-${u.socketId}`} autoPlay playsInline />
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className={`px-4 py-2 ${isMuted ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium`}
                  onClick={() => {
                    setIsMuted(m => {
                      const newMuted = !m;
                      if (socket.current && joinedVoiceChannel) {
                        socket.current.emit('voice:mute', { channelId: joinedVoiceChannel, muted: newMuted });
                      }
                      return newMuted;
                    });
                  }}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-gray-200 rounded-lg font-medium" onClick={() => setJoinedVoiceChannel(null)}>Leave</button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <button
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg"
                onClick={() => setJoinedVoiceChannel(selectedChannelData.id)}
              >
                Join Voice
              </button>
              <p className="text-gray-400 text-xs mt-2">Click to join this voice channel</p>
            </div>
          )}
        </div>
      )}

      {/* Create Category Modal */}
      {showCreateCategory && (
        <CreateCategoryModal
          onClose={() => setShowCreateCategory(false)}
          onCreate={async (name) => {
            const token = localStorage.getItem('frooxi_token');
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/chat/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ name }),
            });
            await fetchCategories();
          }}
        />
      )}

      {/* Edit Category Modal */}
      {showEditCategory && (
        <CreateCategoryModal
          onClose={() => setShowEditCategory(null)}
          onCreate={async (name) => { await handleEditCategory(showEditCategory.id, name); setShowEditCategory(null); }}
        />
      )}

      {/* Delete Category Modal */}
      {showDeleteCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <p className="text-white mb-4">Delete category <b>{showDeleteCategory.name}</b>?</p>
            <div className="flex space-x-4">
              <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={() => setShowDeleteCategory(null)}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={async () => { await handleDeleteCategory(showDeleteCategory.id); setShowDeleteCategory(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Channel Modal */}
      {showEditChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <input className="w-full px-4 py-2 rounded bg-gray-800 border border-gray-600 text-white mb-4" value={showEditChannel.name} onChange={e => setShowEditChannel({ ...showEditChannel, name: e.target.value })} />
            <div className="flex space-x-4">
              <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={() => setShowEditChannel(null)}>Cancel</button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded" onClick={async () => { await handleEditChannel(showEditChannel.id, showEditChannel.name); setShowEditChannel(null); }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Modal */}
      {showDeleteChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <p className="text-white mb-4">Delete channel <b>{showDeleteChannel.name}</b>?</p>
            <div className="flex space-x-4">
              <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={() => setShowDeleteChannel(null)}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={async () => { await handleDeleteChannel(showDeleteChannel.id); setShowDeleteChannel(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSystem;