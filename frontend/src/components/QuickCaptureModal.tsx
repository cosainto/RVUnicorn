import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Video, 
  Upload, 
  Globe, 
  Users, 
  Lock,
  Sparkles,
  Loader2,
  SwitchCamera,
  Circle,
  Square,
  RotateCcw,
  FolderOpen,
  FolderPlus,
  ChevronDown
} from 'lucide-react';
import api from '../services/api';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

interface Album {
  id: string;
  title: string;
}

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe },
  { value: 'FRIENDS', label: 'Friends', icon: Users },
  { value: 'PRIVATE', label: 'Private', icon: Lock },
];

export default function QuickCaptureModal({ isOpen, onClose, onUploadComplete }: QuickCaptureModalProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [postAsCreator, setPostAsCreator] = useState(false);
  const [creatorTitle, setCreatorTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  // Album state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
    } else {
      stopCamera();
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [mode, facingMode]);

  const loadAlbums = async () => {
    try {
      setLoadingAlbums(true);
      // Get current user ID first
      const userResponse = await api.get('/auth/me');
      const currentUserId = userResponse.data.id;
      const { data } = await api.get(`/media-albums?userId=${currentUserId}`);
      setAlbums(data || []);
      
      // Check if "Mobile Uploads" album exists
      const mobileUploads = data?.find((a: Album) => a.title === 'Mobile Uploads');
      if (mobileUploads) {
        setSelectedAlbumId(mobileUploads.id);
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const createMobileUploadsAlbum = async () => {
    try {
      const { data } = await api.post('/media-albums', {
        title: 'Mobile Uploads',
        description: 'Photos and videos from quick capture',
        defaultVisibility: 'PUBLIC'
      });
      setAlbums(prev => [data, ...prev]);
      setSelectedAlbumId(data.id);
      return data.id;
    } catch (err) {
      console.error('Failed to create album:', err);
      return null;
    }
  };

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode },
        audio: mediaType === 'video',
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please check permissions or use file upload.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetState = () => {
    setMode('select');
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setVisibility('PUBLIC');
    setPostAsCreator(false);
    setCreatorTitle('');
    setError('');
    setIsRecording(false);
    setRecordingTime(0);
    setShowAlbumDropdown(false);
    chunksRef.current = [];
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreview(canvas.toDataURL('image/jpeg'));
        setMode('preview');
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
      setSelectedFile(file);
      setPreview(URL.createObjectURL(blob));
      setMode('preview');
      stopCamera();
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(f => f === 'user' ? 'environment' : 'user');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File must be less than ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    setSelectedFile(file);
    setMediaType(isVideo ? 'video' : 'photo');
    setError('');
    setMode('preview');

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please capture or select a file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Ensure we have an album (create Mobile Uploads if needed)
      let albumId = selectedAlbumId;
      if (!albumId && !postAsCreator) {
        albumId = await createMobileUploadsAlbum() || '';
      }

      const formData = new FormData();
      
      if (postAsCreator) {
        formData.append(mediaType === 'video' ? 'video' : 'thumbnail', selectedFile);
        formData.append('contentType', mediaType === 'video' ? 'VIDEO' : 'PHOTO');
        formData.append('title', creatorTitle || caption || 'Quick capture');
        formData.append('description', caption);
        formData.append('status', 'PUBLISHED');
        
        await api.post('/creator-content', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        if (mediaType === 'photo') {
          // Use media-albums endpoint for proper album integration
          formData.append('files', selectedFile);
          formData.append('visibility', visibility);
          if (caption) formData.append('caption', caption);
          
          if (albumId) {
            // Upload to media album
            await api.post(`/media-albums/${albumId}/media`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } else {
            // Create default album first, then upload
            const albumResponse = await api.post('/media-albums', {
              title: 'Mobile Uploads',
              description: 'Quick captures from mobile',
              defaultVisibility: visibility
            });
            const newAlbumId = albumResponse.data.id;
            await api.post(`/media-albums/${newAlbumId}/media`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }
        } else {
          // Use media-albums endpoint for video too (same as photos)
          formData.append('files', selectedFile);
          formData.append('visibility', visibility);
          if (caption) formData.append('caption', caption);
          
          if (albumId) {
            // Upload to media album
            await api.post(`/media-albums/${albumId}/media`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } else {
            // Create default album first, then upload
            const albumResponse = await api.post('/media-albums', {
              title: 'Mobile Uploads',
              description: 'Quick captures from mobile',
              defaultVisibility: visibility
            });
            const newAlbumId = albumResponse.data.id;
            await api.post(`/media-albums/${newAlbumId}/media`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }
        }
      }

      onUploadComplete?.();
      handleClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    resetState();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Quick Capture
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {mode === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-center">What would you like to share?</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setMediaType('photo');
                    setMode('camera');
                  }}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-700">Take Photo</span>
                </button>

                <button
                  onClick={() => {
                    setMediaType('video');
                    setMode('camera');
                  }}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition"
                >
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <Video className="w-8 h-8 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-700">Record Video</span>
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 mx-auto"
                >
                  <FolderOpen className="w-4 h-4" />
                  Or upload from files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                  </div>
                )}

                <button
                  onClick={switchCamera}
                  className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setMode('select')}
                  className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full transition"
                >
                  <RotateCcw className="w-6 h-6 text-gray-700" />
                </button>

                {mediaType === 'photo' ? (
                  <button
                    onClick={takePhoto}
                    className="p-4 bg-white border-4 border-blue-500 hover:border-blue-600 rounded-full transition"
                  >
                    <Circle className="w-10 h-10 text-blue-500 fill-blue-500" />
                  </button>
                ) : (
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-4 border-4 rounded-full transition ${
                      isRecording 
                        ? 'bg-red-500 border-red-600 hover:border-red-700' 
                        : 'bg-white border-red-500 hover:border-red-600'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-10 h-10 text-white fill-white" />
                    ) : (
                      <Circle className="w-10 h-10 text-red-500 fill-red-500" />
                    )}
                  </button>
                )}

                <div className="w-12" />
              </div>
            </div>
          )}

          {mode === 'preview' && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-gray-100">
                {mediaType === 'photo' ? (
                  <img src={preview!} alt="Preview" className="w-full max-h-64 object-contain" />
                ) : (
                  <video src={preview!} controls className="w-full max-h-64" />
                )}
              </div>

              {/* Album Selection */}
              {!postAsCreator && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Save to Album</label>
                  <button
                    onClick={() => setShowAlbumDropdown(!showAlbumDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg hover:border-gray-400 transition"
                  >
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">
                        {selectedAlbum?.title || 'Mobile Uploads (Default)'}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition ${showAlbumDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showAlbumDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedAlbumId('');
                          setShowAlbumDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${!selectedAlbumId ? 'bg-blue-50 text-blue-700' : ''}`}
                      >
                        Mobile Uploads (Default)
                      </button>
                      {albums.map(album => (
                        <button
                          key={album.id}
                          onClick={() => {
                            setSelectedAlbumId(album.id);
                            setShowAlbumDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${selectedAlbumId === album.id ? 'bg-blue-50 text-blue-700' : ''}`}
                        >
                          {album.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What's happening?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-900">Post as Creator Content</p>
                    <p className="text-xs text-gray-500">Share on your creator page</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postAsCreator}
                    onChange={(e) => setPostAsCreator(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              {postAsCreator && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={creatorTitle}
                    onChange={(e) => setCreatorTitle(e.target.value)}
                    placeholder="Give your content a title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </div>
              )}

              {!postAsCreator && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Who can see this?</label>
                  <div className="flex gap-2">
                    {VISIBILITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setVisibility(opt.value)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition ${
                          visibility === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <opt.icon className="w-4 h-4" />
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setMode('select');
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Retake
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Share
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
