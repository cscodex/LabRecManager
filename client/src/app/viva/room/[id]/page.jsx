'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Video, VideoOff, Mic, MicOff, Phone,
    MessageSquare, Clock, User, Send, AlertCircle,
    CheckCircle, XCircle, Maximize2, Minimize2, Circle, Square, Download, Save,
    Volume2, VolumeX, Settings, Sliders, PictureInPicture2, Pencil
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { vivaAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import Whiteboard from '@/components/Whiteboard';

export default function VivaRoomPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    // Session state
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionStatus, setSessionStatus] = useState('connecting');
    const [elapsedTime, setElapsedTime] = useState(0);

    // Video/Audio state - start with video/audio OFF initially
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [showRecordingOptions, setShowRecordingOptions] = useState(false);

    // Audio levels and controls state
    const [micLevel, setMicLevel] = useState(0);
    const [speakerVolume, setSpeakerVolume] = useState(100);
    const [micVolume, setMicVolume] = useState(100);
    const [showAudioSettings, setShowAudioSettings] = useState(false);

    // Picture-in-Picture state
    const [isPiPActive, setIsPiPActive] = useState(false);

    // Device settings state (camera/mic status like Zoom)
    const [showDeviceSettings, setShowDeviceSettings] = useState(false);
    const [availableDevices, setAvailableDevices] = useState({ cameras: [], microphones: [], speakers: [] });
    const [selectedCamera, setSelectedCamera] = useState('');
    const [selectedMicrophone, setSelectedMicrophone] = useState('');

    // Chat state
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    // Whiteboard state
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [whiteboardFullscreen, setWhiteboardFullscreen] = useState(false);
    const [savedWhiteboardImage, setSavedWhiteboardImage] = useState(null);

    // Grading state (for instructors)
    const [showGradingPanel, setShowGradingPanel] = useState(false);
    const [vivaMarks, setVivaMarks] = useState(0);
    const [remarks, setRemarks] = useState('');

    // Waiting room state
    const [participantStatus, setParticipantStatus] = useState('joining'); // joining, waiting, admitted, rejected
    const [waitingParticipants, setWaitingParticipants] = useState([]);
    const [admittedParticipants, setAdmittedParticipants] = useState([]);
    const [showWaitingRoom, setShowWaitingRoom] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const participantsIntervalRef = useRef(null);

    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const socketRef = useRef(null);
    const timerRef = useRef(null);
    const chatContainerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const micLevelIntervalRef = useRef(null);

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';

    // ICE server configuration
    const iceServers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ]
    };

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadSession();
        return () => cleanup();
    }, [isAuthenticated, params.id]);

    useEffect(() => {
        if (session && sessionStatus === 'active') {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => {
                    const newElapsed = prev + 1;
                    const maxDuration = session.durationMinutes * 60;
                    const timeRemaining = maxDuration - newElapsed;

                    // Warn 2 minutes before end
                    if (timeRemaining === 120) {
                        toast('⏰ 2 minutes remaining in this session', { icon: '⚠️' });
                    }

                    // Warn 30 seconds before end
                    if (timeRemaining === 30) {
                        toast('⏰ 30 seconds remaining!', { icon: '🚨', duration: 5000 });
                    }

                    // Auto-end when time expires
                    if (timeRemaining <= 0 && isInstructor) {
                        toast.error('Session time expired. Please complete the evaluation.');
                        // Don't auto-end, just warn - let instructor complete grading
                    }

                    return newElapsed;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session, sessionStatus]);

    // Scroll chat to bottom on new messages
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const cleanup = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (micLevelIntervalRef.current) clearInterval(micLevelIntervalRef.current);
        if (participantsIntervalRef.current) clearInterval(participantsIntervalRef.current);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };

    const loadSession = async () => {
        try {
            const res = await vivaAPI.getSession(params.id);
            const sessionData = res.data.data.session;
            setSession(sessionData);

            if (sessionData.status === 'completed') {
                toast.error('This viva session has already been completed');
                router.push('/viva');
                return;
            }

            if (sessionData.status === 'cancelled') {
                toast.error('This viva session has been cancelled');
                router.push('/viva');
                return;
            }

            // Join the session (waiting room)
            const joinRes = await vivaAPI.joinSession(params.id);
            const { participant, isHost: hostFlag } = joinRes.data.data;

            setIsHost(hostFlag);
            setParticipantStatus(participant.status);

            // Initialize media first
            await initializeMedia();

            // If host (examiner) or admitted, proceed to session
            if (hostFlag || participant.status === 'admitted') {
                setParticipantStatus('admitted');
                initializeSocket();

                // Check if session is already in_progress (resuming a session)
                if (sessionData.status === 'in_progress') {
                    setSessionStatus('active');
                    if (sessionData.actualStartTime) {
                        const startTime = new Date(sessionData.actualStartTime);
                        const elapsed = Math.floor((new Date() - startTime) / 1000);
                        setElapsedTime(elapsed);
                    }
                    toast.success('Rejoined active session');
                } else {
                    setSessionStatus('ready');
                }

                // If host, start polling for waiting participants
                if (hostFlag) {
                    startParticipantPolling();
                }
            } else {
                // Student in waiting room - poll for status changes
                setParticipantStatus('waiting');
                startStatusPolling();
            }
        } catch (error) {
            console.error('Load session error:', error);
            toast.error('Failed to load viva session');
            router.push('/viva');
        } finally {
            setLoading(false);
        }
    };

    // Poll for participant status (for students in waiting room)
    const startStatusPolling = () => {
        const poll = setInterval(async () => {
            try {
                const res = await vivaAPI.getMyStatus(params.id);
                const status = res.data.data.participant.status;

                if (status === 'admitted') {
                    clearInterval(poll);
                    setParticipantStatus('admitted');
                    initializeSocket();
                    setSessionStatus('ready');
                    toast.success('You have been admitted to the session!');
                } else if (status === 'rejected') {
                    clearInterval(poll);
                    setParticipantStatus('rejected');
                    toast.error('You were not admitted to this session');
                }
            } catch (error) {
                console.error('Status poll error:', error);
            }
        }, 2000);

        return () => clearInterval(poll);
    };

    // Poll for waiting participants (for examiners)
    const startParticipantPolling = () => {
        const poll = async () => {
            try {
                const res = await vivaAPI.getParticipants(params.id);
                setWaitingParticipants(res.data.data.waiting || []);
                setAdmittedParticipants(res.data.data.admitted || []);
            } catch (error) {
                console.error('Participants poll error:', error);
            }
        };

        // Initial fetch
        poll();

        // Poll every 3 seconds
        participantsIntervalRef.current = setInterval(poll, 3000);
    };

    const handleAdmitParticipant = async (participantId) => {
        try {
            await vivaAPI.admitParticipant(params.id, participantId);
            toast.success('Participant admitted');
            // Refresh participants list
            const res = await vivaAPI.getParticipants(params.id);
            setWaitingParticipants(res.data.data.waiting || []);
            setAdmittedParticipants(res.data.data.admitted || []);
        } catch (error) {
            toast.error('Failed to admit participant');
        }
    };

    const handleRejectParticipant = async (participantId) => {
        try {
            await vivaAPI.rejectParticipant(params.id, participantId);
            toast.success('Participant removed');
            const res = await vivaAPI.getParticipants(params.id);
            setWaitingParticipants(res.data.data.waiting || []);
        } catch (error) {
            toast.error('Failed to remove participant');
        }
    };

    const handleAdmitAll = async () => {
        try {
            await vivaAPI.admitAll(params.id);
            toast.success('All participants admitted');
            const res = await vivaAPI.getParticipants(params.id);
            setWaitingParticipants([]);
            setAdmittedParticipants(res.data.data.admitted || []);
        } catch (error) {
            toast.error('Failed to admit all');
        }
    };

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Disable video and audio tracks initially (users can enable when ready)
            stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            // Setup audio context for mic level monitoring
            setupAudioMonitoring(stream);
        } catch (error) {
            console.error('Error accessing media devices:', error);
            toast.error('Could not access camera/microphone. Please check permissions.');
        }
    };

    // Setup real-time audio level monitoring
    const setupAudioMonitoring = (stream) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            // Don't connect to destination to avoid feedback
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            // Update mic level every 50ms
            micLevelIntervalRef.current = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const level = Math.min(100, Math.round((average / 128) * 100));
                setMicLevel(level);
            }, 50);
        } catch (error) {
            console.error('Error setting up audio monitoring:', error);
        }
    };

    // Update speaker volume
    const updateSpeakerVolume = (volume) => {
        setSpeakerVolume(volume);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.volume = volume / 100;
        }
    };

    // Enumerate available devices
    const enumerateDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');
            const microphones = devices.filter(d => d.kind === 'audioinput');
            const speakers = devices.filter(d => d.kind === 'audiooutput');

            setAvailableDevices({ cameras, microphones, speakers });

            // Set default selections based on current stream
            if (localStreamRef.current) {
                const videoTrack = localStreamRef.current.getVideoTracks()[0];
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                if (videoTrack) setSelectedCamera(videoTrack.getSettings().deviceId || '');
                if (audioTrack) setSelectedMicrophone(audioTrack.getSettings().deviceId || '');
            }
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    };

    // Switch camera
    const switchCamera = async (deviceId) => {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];

            if (oldVideoTrack) {
                localStreamRef.current.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }

            if (localStreamRef.current) {
                localStreamRef.current.addTrack(newVideoTrack);
            }

            // Update video element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            // Replace track in peer connection
            if (peerConnectionRef.current) {
                const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

            setSelectedCamera(deviceId);
            newVideoTrack.enabled = isVideoEnabled;
            toast.success('Camera switched');
        } catch (error) {
            console.error('Error switching camera:', error);
            toast.error('Failed to switch camera');
        }
    };

    // Switch microphone
    const switchMicrophone = async (deviceId) => {
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: { deviceId: { exact: deviceId } }
            });

            const newAudioTrack = newStream.getAudioTracks()[0];
            const oldAudioTrack = localStreamRef.current?.getAudioTracks()[0];

            if (oldAudioTrack) {
                localStreamRef.current.removeTrack(oldAudioTrack);
                oldAudioTrack.stop();
            }

            if (localStreamRef.current) {
                localStreamRef.current.addTrack(newAudioTrack);
            }

            // Replace track in peer connection
            if (peerConnectionRef.current) {
                const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) {
                    await sender.replaceTrack(newAudioTrack);
                }
            }

            // Re-setup audio monitoring
            setupAudioMonitoring(localStreamRef.current);

            setSelectedMicrophone(deviceId);
            newAudioTrack.enabled = isAudioEnabled;
            toast.success('Microphone switched');
        } catch (error) {
            console.error('Error switching microphone:', error);
            toast.error('Failed to switch microphone');
        }
    };

    // Update mic gain (needs audio processing which is complex, so we'll track it for UI)
    const updateMicVolume = (volume) => {
        setMicVolume(volume);
        // Note: Actual mic gain control requires using GainNode in audio processing
        // For now, this controls the visual representation
    };

    // Toggle Picture-in-Picture mode
    const togglePictureInPicture = async () => {
        try {
            if (document.pictureInPictureElement) {
                // Exit PiP
                await document.exitPictureInPicture();
                setIsPiPActive(false);
            } else if (remoteVideoRef.current && document.pictureInPictureEnabled) {
                // Enter PiP for remote video
                await remoteVideoRef.current.requestPictureInPicture();
                setIsPiPActive(true);

                // Listen for PiP exit
                remoteVideoRef.current.addEventListener('leavepictureinpicture', () => {
                    setIsPiPActive(false);
                }, { once: true });
            } else if (localVideoRef.current && document.pictureInPictureEnabled) {
                // Fallback to local video if remote not available
                await localVideoRef.current.requestPictureInPicture();
                setIsPiPActive(true);

                localVideoRef.current.addEventListener('leavepictureinpicture', () => {
                    setIsPiPActive(false);
                }, { once: true });
            } else {
                toast.error('Picture-in-Picture is not supported in this browser');
            }
        } catch (error) {
            console.error('PiP error:', error);
            if (error.name === 'NotAllowedError') {
                toast.error('Please click on the video first, then try PiP again');
            } else {
                toast.error('Failed to enable Picture-in-Picture');
            }
        }
    };

    const initializeSocket = () => {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        socketRef.current = io(socketUrl, {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            socketRef.current.emit('join-room', {
                roomId: params.id,
                userId: user.id,
                role: user.role
            });
        });

        socketRef.current.on('user-joined', async (data) => {
            console.log('User joined:', data);
            setIsRemoteConnected(true);
            if (isInstructor) {
                await createOffer();
            }
        });

        socketRef.current.on('offer', async (offer) => {
            console.log('Received offer');
            await handleOffer(offer);
        });

        socketRef.current.on('answer', async (answer) => {
            console.log('Received answer');
            await handleAnswer(answer);
        });

        socketRef.current.on('ice-candidate', async (candidate) => {
            console.log('Received ICE candidate');
            await handleIceCandidate(candidate);
        });

        socketRef.current.on('user-left', () => {
            console.log('User left');
            setIsRemoteConnected(false);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
        });

        socketRef.current.on('chat-message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        socketRef.current.on('session-ended', () => {
            toast.success('Session has ended');
            router.push('/viva');
        });
    };

    const createPeerConnection = () => {
        peerConnectionRef.current = new RTCPeerConnection(iceServers);

        // Add local stream tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, localStreamRef.current);
            });
        }

        // Handle incoming remote stream
        peerConnectionRef.current.ontrack = (event) => {
            console.log('Received remote track');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        // Handle ICE candidates
        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit('ice-candidate', {
                    roomId: params.id,
                    candidate: event.candidate
                });
            }
        };

        peerConnectionRef.current.onconnectionstatechange = () => {
            const state = peerConnectionRef.current.connectionState;
            console.log('Connection state:', state);
            if (state === 'connected') {
                setSessionStatus('active');
            } else if (state === 'disconnected' || state === 'failed') {
                setSessionStatus('disconnected');
            }
        };
    };

    const createOffer = async () => {
        createPeerConnection();
        try {
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            socketRef.current.emit('offer', {
                roomId: params.id,
                offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    };

    const handleOffer = async (offer) => {
        createPeerConnection();
        try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            socketRef.current.emit('answer', {
                roomId: params.id,
                answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    };

    const handleAnswer = async (answer) => {
        try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    };

    const handleIceCandidate = async (candidate) => {
        try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Recording functions
    const startRecording = () => {
        if (!localStreamRef.current) {
            toast.error('No media stream available for recording');
            return;
        }

        try {
            // Create a combined stream with local video and potentially remote audio
            const recordStream = new MediaStream();

            // Add local video and audio tracks
            localStreamRef.current.getTracks().forEach(track => {
                recordStream.addTrack(track);
            });

            // Add remote audio if available
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
                const remoteAudioTracks = remoteVideoRef.current.srcObject.getAudioTracks();
                remoteAudioTracks.forEach(track => {
                    recordStream.addTrack(track.clone());
                });
            }

            const options = { mimeType: 'video/webm;codecs=vp9,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp8,opus';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                }
            }

            mediaRecorderRef.current = new MediaRecorder(recordStream, options);
            recordedChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                setRecordedBlob(blob);
                setShowRecordingOptions(true);
            };

            mediaRecorderRef.current.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingTime(0);

            // Start recording timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            toast.success('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            toast.error('Failed to start recording');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }

            toast.success('Recording stopped');
        }
    };

    const downloadRecording = () => {
        if (recordedBlob) {
            const url = URL.createObjectURL(recordedBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `viva_${session?.student?.lastName || 'session'}_${new Date().toISOString().split('T')[0]}.webm`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Recording downloaded');
        }
    };

    const uploadRecording = async () => {
        if (!recordedBlob || !session?.id) {
            toast.error('No recording to upload');
            return;
        }

        try {
            const file = new File([recordedBlob], `viva_${session.id}_${Date.now()}.webm`, { type: 'video/webm' });
            const res = await vivaAPI.uploadRecording(session.id, file, recordingTime);
            toast.success('Recording saved to database!');
            setShowRecordingOptions(false);
            setRecordedBlob(null);
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to save recording');
        }
    };

    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            const message = {
                id: Date.now(),
                text: newMessage,
                sender: `${user.firstName} ${user.lastName}`,
                senderId: user.id,
                timestamp: new Date().toISOString()
            };
            socketRef.current.emit('chat-message', {
                roomId: params.id,
                message
            });
            setMessages(prev => [...prev, message]);
            setNewMessage('');
        }
    };

    const handleStartSession = async () => {
        try {
            await vivaAPI.startSession(params.id);
            setSessionStatus('active');
            toast.success('Viva session started!');
            socketRef.current.emit('session-started', { roomId: params.id });

            // Auto-start recording for accountability
            setTimeout(() => {
                if (!isRecording) {
                    startRecording();
                    toast('📹 Session is being recorded for accountability', {
                        icon: '🔴',
                        duration: 4000
                    });
                }
            }, 1000); // Give time for streams to stabilize
        } catch (error) {
            toast.error('Failed to start session');
        }
    };

    const handleEndSession = async () => {
        try {
            // Stop recording and prepare for upload
            let recordingToUpload = null;
            if (isRecording && mediaRecorderRef.current) {
                // Stop recording and wait for blob
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                }

                // Wait for the recorded blob to be ready
                await new Promise(resolve => setTimeout(resolve, 500));

                if (recordedChunksRef.current.length > 0) {
                    recordingToUpload = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                }
            }

            // Get max marks from session or default to 20
            const maxMarks = session?.submission?.assignment?.vivaMarks || 20;

            await vivaAPI.completeSession(params.id, {
                marksObtained: parseFloat(vivaMarks) || 0,
                maxMarks: parseFloat(maxMarks),
                examinerRemarks: remarks || ''
            });
            socketRef.current?.emit('session-ended', { roomId: params.id });

            // Auto-upload recording to database for admin review
            if (recordingToUpload && recordingToUpload.size > 0) {
                toast.loading('Saving recording to database...');
                try {
                    const file = new File([recordingToUpload], `viva_${session.id}_${Date.now()}.webm`, { type: 'video/webm' });
                    await vivaAPI.uploadRecording(session.id, file, recordingTime);
                    toast.dismiss();
                    toast.success('Recording saved for admin review');
                } catch (uploadError) {
                    console.error('Failed to upload recording:', uploadError);
                    toast.dismiss();
                    toast.error('Failed to save recording, but session completed');
                }
            }

            // Cleanup media tracks and connections
            cleanup();

            toast.success('Session completed successfully!');
            router.push('/viva');
        } catch (error) {
            console.error('Failed to end session:', error);
            const errorMsg = error.response?.data?.message ||
                error.response?.data?.error ||
                error.response?.data?.errors?.[0]?.msg ||
                'Failed to end session';
            toast.error(errorMsg);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-white">Connecting to viva room...</p>
                </div>
            </div>
        );
    }

    // Waiting room for students
    if (participantStatus === 'waiting' && !isHost) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-10 h-10 text-primary-400 animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Waiting Room</h1>
                    <p className="text-slate-400 mb-6">
                        Please wait for the host to admit you to the session.
                    </p>

                    <div className="bg-slate-800 rounded-xl p-6 mb-6">
                        <h2 className="text-white font-medium mb-2">Session Details</h2>
                        <p className="text-slate-400 text-sm">
                            {session?.submission?.assignment?.title || 'Viva Session'}
                        </p>
                        <p className="text-slate-500 text-sm mt-1">
                            Examiner: {session?.examiner?.firstName} {session?.examiner?.lastName}
                        </p>
                    </div>

                    {/* Preview video */}
                    <div className="relative w-48 h-36 mx-auto rounded-xl overflow-hidden bg-slate-800 mb-6">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 right-2 flex gap-2 justify-center">
                            <button
                                onClick={toggleVideo}
                                className={`p-2 rounded-full ${isVideoEnabled ? 'bg-slate-700' : 'bg-red-500'}`}
                            >
                                {isVideoEnabled ? <Video className="w-4 h-4 text-white" /> : <VideoOff className="w-4 h-4 text-white" />}
                            </button>
                            <button
                                onClick={toggleAudio}
                                className={`p-2 rounded-full ${isAudioEnabled ? 'bg-slate-700' : 'bg-red-500'}`}
                            >
                                {isAudioEnabled ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-white" />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            cleanup();
                            router.push('/viva');
                        }}
                        className="text-slate-400 hover:text-white transition"
                    >
                        Leave Waiting Room
                    </button>
                </div>
            </div>
        );
    }

    // Rejected screen
    if (participantStatus === 'rejected') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Not Admitted</h1>
                    <p className="text-slate-400 mb-6">
                        The host has not admitted you to this session.
                    </p>
                    <button
                        onClick={() => router.push('/viva')}
                        className="btn btn-primary"
                    >
                        Back to Viva Sessions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 h-14 flex items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            cleanup();
                            router.push('/viva');
                        }}
                        className="text-slate-400 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-white font-medium">Viva Session</h1>
                        <p className="text-sm text-slate-400">
                            {session?.submission?.assignment?.title || 'Lab Assignment'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${sessionStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
                            sessionStatus === 'ready' ? 'bg-amber-500' :
                                sessionStatus === 'connecting' ? 'bg-blue-500' :
                                    'bg-red-500'
                            }`}></span>
                        <span className="text-sm text-slate-300 capitalize">{sessionStatus}</span>
                    </div>

                    {/* Timer with Countdown */}
                    {sessionStatus === 'active' && (
                        <div className="flex items-center gap-4">
                            {/* Elapsed Time */}
                            <div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-lg">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
                            </div>

                            {/* Remaining Time Countdown */}
                            {session?.durationMinutes && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${elapsedTime > session.durationMinutes * 60
                                    ? 'bg-red-500/20 text-red-400'
                                    : elapsedTime > session.durationMinutes * 60 * 0.8
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                    <span className="text-xs uppercase font-medium">
                                        {elapsedTime > session.durationMinutes * 60 ? 'Overtime' : 'Remaining'}
                                    </span>
                                    <span className="font-mono font-medium">
                                        {(() => {
                                            const totalSeconds = session.durationMinutes * 60;
                                            const remaining = totalSeconds - elapsedTime;
                                            if (remaining <= 0) {
                                                const overtime = Math.abs(remaining);
                                                const mins = Math.floor(overtime / 60);
                                                const secs = overtime % 60;
                                                return `+${mins}:${secs.toString().padStart(2, '0')}`;
                                            }
                                            const mins = Math.floor(remaining / 60);
                                            const secs = remaining % 60;
                                            return `${mins}:${secs.toString().padStart(2, '0')}`;
                                        })()}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Participant info */}
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">
                            {isInstructor
                                ? `${session?.student?.firstName} ${session?.student?.lastName}`
                                : `${session?.examiner?.firstName} ${session?.examiner?.lastName}`
                            }
                        </span>
                    </div>

                    {/* Waiting Room Toggle (for instructors) */}
                    {isHost && (
                        <button
                            onClick={() => setShowWaitingRoom(!showWaitingRoom)}
                            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${showWaitingRoom ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            <User className="w-4 h-4" />
                            <span className="text-sm font-medium">Waiting Room</span>
                            {waitingParticipants.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                                    {waitingParticipants.length}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex">
                {/* Video area */}
                <div className="flex-1 p-4 flex flex-col">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Remote video (large) */}
                        <div className="relative bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center lg:col-span-2 min-h-[400px]">
                            {isRemoteConnected ? (
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <User className="w-20 h-20 mx-auto mb-4 opacity-50" />
                                    <p>Waiting for {isInstructor ? 'student' : 'instructor'} to join...</p>
                                </div>
                            )}

                            {/* Remote participant name */}
                            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg">
                                <span className="text-white text-sm">
                                    {isInstructor
                                        ? `${session?.student?.firstName || 'Student'}`
                                        : `${session?.examiner?.firstName || 'Instructor'}`
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Local video (small, floating) */}
                    <div className="absolute bottom-28 right-8 w-48 h-36 bg-slate-800 rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`w-full h-full object-cover ${!isVideoEnabled && 'hidden'}`}
                        />
                        {!isVideoEnabled && (
                            <div className="w-full h-full flex items-center justify-center">
                                <VideoOff className="w-8 h-8 text-slate-500" />
                            </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                            You
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-4 flex items-center justify-center gap-4">
                        <button
                            onClick={toggleVideo}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isVideoEnabled
                                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                        >
                            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                        </button>

                        <button
                            onClick={toggleAudio}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition relative ${isAudioEnabled
                                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                        >
                            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                            {/* Mic level indicator */}
                            {isAudioEnabled && (
                                <div className="absolute -right-1 -top-1 w-4 h-4 flex items-center justify-center">
                                    <div
                                        className="w-full h-full rounded-full transition-all duration-75"
                                        style={{
                                            background: `conic-gradient(${micLevel > 70 ? '#ef4444' : micLevel > 40 ? '#f59e0b' : '#22c55e'} ${micLevel * 3.6}deg, #334155 0deg)`
                                        }}
                                    />
                                </div>
                            )}
                        </button>

                        {/* Audio Settings Button */}
                        <button
                            onClick={() => setShowAudioSettings(!showAudioSettings)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${showAudioSettings
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                            title="Audio Settings"
                        >
                            <Sliders className="w-6 h-6" />
                        </button>

                        {/* Device Settings Button */}
                        <button
                            onClick={() => {
                                enumerateDevices();
                                setShowDeviceSettings(!showDeviceSettings);
                            }}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${showDeviceSettings
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                            title="Device Settings"
                        >
                            <Settings className="w-6 h-6" />
                        </button>

                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${showChat
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                            title="Chat"
                        >
                            <MessageSquare className="w-6 h-6" />
                        </button>

                        {/* Whiteboard Toggle Button */}
                        <button
                            onClick={() => setShowWhiteboard(!showWhiteboard)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${showWhiteboard
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                            title="Whiteboard"
                        >
                            <Pencil className="w-6 h-6" />
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition"
                        >
                            {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
                        </button>

                        {/* Picture-in-Picture Button */}
                        <button
                            onClick={togglePictureInPicture}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isPiPActive
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                            title={isPiPActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture (navigate freely)'}
                        >
                            <PictureInPicture2 className="w-6 h-6" />
                        </button>

                        {/* Recording Button - Only for instructors */}
                        {isInstructor && (
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isRecording
                                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                                    }`}
                                title={isRecording ? 'Stop Recording' : 'Start Recording'}
                            >
                                {isRecording ? <Square className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                            </button>
                        )}

                        {/* Recording Timer */}
                        {isRecording && (
                            <div className="flex items-center gap-2 bg-red-500/30 border border-red-500/50 px-4 py-2 rounded-full">
                                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
                                <span className="text-red-400 font-mono text-sm">{formatRecordingTime(recordingTime)}</span>
                                <span className="text-red-300 text-xs hidden md:block">• Recording for Accountability</span>
                            </div>
                        )}

                        {isInstructor && sessionStatus === 'ready' && (
                            <button
                                onClick={handleStartSession}
                                className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium flex items-center gap-2 transition"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Start Session
                            </button>
                        )}

                        {isInstructor && sessionStatus === 'active' && (
                            <button
                                onClick={() => setShowGradingPanel(true)}
                                className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium flex items-center gap-2 transition"
                            >
                                <Phone className="w-5 h-5" />
                                End & Grade
                            </button>
                        )}

                        {!isInstructor && (
                            <button
                                onClick={() => {
                                    cleanup();
                                    router.push('/viva');
                                }}
                                className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium flex items-center gap-2 transition"
                            >
                                <Phone className="w-5 h-5" />
                                Leave
                            </button>
                        )}
                    </div>
                </div>

                {/* Chat Panel */}
                {showChat && (
                    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
                        <div className="p-4 border-b border-slate-700">
                            <h3 className="text-white font-medium">Chat</h3>
                        </div>

                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center">No messages yet</p>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`${msg.senderId === user.id ? 'ml-auto text-right' : ''}`}
                                    >
                                        <p className="text-xs text-slate-500 mb-1">{msg.sender}</p>
                                        <div className={`inline-block px-3 py-2 rounded-lg max-w-[220px] ${msg.senderId === user.id
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-slate-700 text-white'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={sendMessage} className="p-4 border-t border-slate-700">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-slate-700 border-none rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500"
                                />
                                <button
                                    type="submit"
                                    className="w-10 h-10 bg-primary-500 hover:bg-primary-600 rounded-lg flex items-center justify-center text-white transition"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Audio Settings Panel */}
            {showAudioSettings && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl z-40 w-80">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <Sliders className="w-5 h-5" />
                            Audio Settings
                        </h3>
                        <button
                            onClick={() => setShowAudioSettings(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mic Level Meter */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                <Mic className="w-4 h-4" />
                                Microphone Level
                            </span>
                            <span className={`text-sm font-mono ${micLevel > 70 ? 'text-red-400' : micLevel > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {micLevel}%
                            </span>
                        </div>
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-75 ${micLevel > 70 ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500' :
                                    micLevel > 40 ? 'bg-gradient-to-r from-emerald-500 to-amber-500' :
                                        'bg-emerald-500'
                                    }`}
                                style={{ width: `${micLevel}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {!isAudioEnabled ? 'Microphone is muted' : micLevel > 70 ? 'Too loud!' : micLevel < 10 ? 'Speak louder' : 'Good level'}
                        </p>
                    </div>

                    {/* Mic Volume Slider */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                <Mic className="w-4 h-4" />
                                Mic Sensitivity
                            </span>
                            <span className="text-sm text-white font-mono">{micVolume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={micVolume}
                            onChange={(e) => updateMicVolume(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
                        />
                    </div>

                    {/* Speaker Volume Slider */}
                    <div className="mb-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                {speakerVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                Speaker Volume
                            </span>
                            <span className="text-sm text-white font-mono">{speakerVolume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={speakerVolume}
                            onChange={(e) => updateSpeakerVolume(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
                        />
                    </div>

                    {/* Quick mute buttons */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                        <button
                            onClick={() => updateSpeakerVolume(speakerVolume === 0 ? 100 : 0)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${speakerVolume === 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600'
                                }`}
                        >
                            {speakerVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            {speakerVolume === 0 ? 'Unmute' : 'Mute'}
                        </button>
                        <button
                            onClick={toggleAudio}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition ${!isAudioEnabled ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-white hover:bg-slate-600'
                                }`}
                        >
                            {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            {isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
                        </button>
                    </div>
                </div>
            )}

            {/* Device Settings Panel */}
            {showDeviceSettings && (
                <div className="fixed bottom-32 right-8 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl z-40 w-96">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Device Settings
                        </h3>
                        <button
                            onClick={() => setShowDeviceSettings(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Camera Status */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                <Video className="w-4 h-4" />
                                Camera
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${isVideoEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isVideoEnabled ? 'ON' : 'OFF'}
                            </span>
                        </div>
                        <select
                            value={selectedCamera}
                            onChange={(e) => switchCamera(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            {availableDevices.cameras.length === 0 ? (
                                <option value="">No cameras found</option>
                            ) : (
                                availableDevices.cameras.map((camera) => (
                                    <option key={camera.deviceId} value={camera.deviceId}>
                                        {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                                    </option>
                                ))
                            )}
                        </select>
                        {/* Camera preview */}
                        <div className="mt-2 h-24 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                            {isVideoEnabled ? (
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-slate-500 text-sm flex items-center gap-2">
                                    <VideoOff className="w-4 h-4" />
                                    Camera is off
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Microphone Status */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-400 flex items-center gap-2">
                                <Mic className="w-4 h-4" />
                                Microphone
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${isAudioEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isAudioEnabled ? 'ON' : 'OFF'}
                            </span>
                        </div>
                        <select
                            value={selectedMicrophone}
                            onChange={(e) => switchMicrophone(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                            {availableDevices.microphones.length === 0 ? (
                                <option value="">No microphones found</option>
                            ) : (
                                availableDevices.microphones.map((mic) => (
                                    <option key={mic.deviceId} value={mic.deviceId}>
                                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                                    </option>
                                ))
                            )}
                        </select>
                        {/* Mic level indicator */}
                        <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">Input Level</span>
                                <span className="text-xs text-slate-500">{micLevel}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-75 ${micLevel > 70 ? 'bg-red-500' : micLevel > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${micLevel}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-400">Connection</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${isRemoteConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                {isRemoteConnected ? 'Connected' : 'Waiting...'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Session Status</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${sessionStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                                sessionStatus === 'ready' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                {sessionStatus}
                            </span>
                        </div>
                    </div>

                    {/* Refresh devices button */}
                    <button
                        onClick={enumerateDevices}
                        className="w-full mt-4 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition flex items-center justify-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        Refresh Devices
                    </button>
                </div>
            )}

            {/* Grading Modal */}
            {showGradingPanel && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">Complete Viva Session</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Viva Marks (out of {session?.submission?.assignment?.vivaMarks || 20})
                                </label>
                                <input
                                    type="number"
                                    value={vivaMarks}
                                    onChange={(e) => setVivaMarks(Number(e.target.value))}
                                    min="0"
                                    max={session?.submission?.assignment?.vivaMarks || 20}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Remarks
                                </label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    rows={3}
                                    placeholder="Add notes about the student's performance..."
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowGradingPanel(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEndSession}
                                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
                                >
                                    Complete Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recording Options Modal */}
            {showRecordingOptions && recordedBlob && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Video className="w-6 h-6 text-primary-500" />
                            Recording Complete
                        </h2>

                        <p className="text-slate-600 mb-6">
                            Your viva session recording is ready. You can save it to the database for later playback, download it, or discard it.
                        </p>

                        <div className="bg-slate-50 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">Viva Recording</p>
                                    <p className="text-sm text-slate-500">
                                        Duration: {formatRecordingTime(recordingTime)} •
                                        Size: {(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                                <Video className="w-8 h-8 text-slate-400" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* Save to Database - Primary Action */}
                            <button
                                onClick={uploadRecording}
                                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition flex items-center justify-center gap-2 font-medium shadow-lg"
                            >
                                <Save className="w-5 h-5" />
                                Save to Database (Can be replayed later)
                            </button>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowRecordingOptions(false);
                                        setRecordedBlob(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={() => {
                                        downloadRecording();
                                        setShowRecordingOptions(false);
                                    }}
                                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Waiting Room Panel (for instructors) */}
            {showWaitingRoom && isHost && (
                <div className="fixed right-4 top-20 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="text-white font-medium">Waiting Room</h3>
                        <button
                            onClick={() => setShowWaitingRoom(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {waitingParticipants.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No one in waiting room</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {/* Admit all button */}
                                <button
                                    onClick={handleAdmitAll}
                                    className="w-full mb-2 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition"
                                >
                                    Admit All ({waitingParticipants.length})
                                </button>

                                {/* List of waiting participants */}
                                <div className="space-y-2">
                                    {waitingParticipants.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-300" />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-white font-medium">
                                                        {p.user?.firstName} {p.user?.lastName}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {p.user?.studentId || p.user?.admissionNumber || p.user?.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleAdmitParticipant(p.id)}
                                                    className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                                                    title="Admit"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRejectParticipant(p.id)}
                                                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                                                    title="Remove"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Admitted participants */}
                    {admittedParticipants.length > 0 && (
                        <div className="border-t border-slate-700 p-4">
                            <h4 className="text-sm text-slate-400 mb-2">In Session ({admittedParticipants.length})</h4>
                            <div className="flex flex-wrap gap-2">
                                {admittedParticipants.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg text-xs">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        {p.user?.firstName} {p.user?.lastName?.charAt(0)}.
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Whiteboard Modal */}
            {showWhiteboard && (
                <div className={`fixed z-50 ${whiteboardFullscreen ? 'inset-0' : 'inset-4 md:inset-8 lg:inset-12'} flex items-center justify-center`}>
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => !whiteboardFullscreen && setShowWhiteboard(false)}
                    />
                    <div className={`relative z-10 ${whiteboardFullscreen ? 'w-full h-full' : 'w-full max-w-4xl max-h-[80vh]'}`}>
                        <Whiteboard
                            width={800}
                            height={500}
                            isFullscreen={whiteboardFullscreen}
                            onToggleFullscreen={() => setWhiteboardFullscreen(!whiteboardFullscreen)}
                            onClose={() => {
                                setShowWhiteboard(false);
                                setWhiteboardFullscreen(false);
                            }}
                            onSave={(imageData) => {
                                setSavedWhiteboardImage(imageData);
                                toast.success('Whiteboard saved! It will be included when session ends.');
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
