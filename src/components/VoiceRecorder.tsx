import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Loader2, Volume2, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceRecorderProps {
  onTranscription?: (text: string) => void;
  onResponse?: (response: string) => void;
  modelId?: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscription, 
  onResponse, 
  modelId 
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm' 
        });
        
        // Create audio URL for playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Process the audio
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscript('');
      setResponse('');
      
      toast({
        title: t('voice.startRecording'),
        description: t('voice.speakNow')
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: t('common.error'),
        description: t('voice.micPermission'),
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          // Transcribe audio
          const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('voice-to-text', {
            body: { 
              audio: base64Audio,
              language: i18n.language 
            }
          });

          if (transcribeError) throw transcribeError;

          const transcriptText = transcribeData.text || '';
          setTranscript(transcriptText);
          onTranscription?.(transcriptText);

          if (transcriptText.trim()) {
            // Get AI response
            const { data: responseData, error: responseError } = await supabase.functions.invoke('chat-completion', {
              body: { 
                message: transcriptText,
                modelId,
                language: i18n.language
              }
            });

            if (responseError) throw responseError;

            const responseText = responseData.response || '';
            setResponse(responseText);
            onResponse?.(responseText);

            // Convert response to speech
            if (responseText.trim()) {
              const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                body: { 
                  text: responseText,
                  language: i18n.language
                }
              });

              if (!ttsError && ttsData.audioContent) {
                // Play the audio response
                const audioData = `data:audio/mpeg;base64,${ttsData.audioContent}`;
                const audio = new Audio(audioData);
                audio.play().catch(console.error);
              }
            }
          }

          toast({
            title: t('common.success'),
            description: 'Voice processed successfully'
          });
        } catch (error) {
          console.error('Error processing voice:', error);
          toast({
            title: t('common.error'),
            description: 'Failed to process voice',
            variant: 'destructive'
          });
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error in processAudio:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to process audio',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = () => {
    if (!audioUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onpause = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            {t('voice.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recording Control */}
          <div className="flex flex-col items-center space-y-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={isProcessing}
                size="lg"
                className="h-16 w-16 rounded-full bg-[var(--automotive-gradient)] p-0"
              >
                <Mic className="h-6 w-6" />
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="h-16 w-16 rounded-full animate-pulse p-0"
              >
                <MicOff className="h-6 w-6" />
              </Button>
            )}
            
            <div className="text-center">
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  {t('voice.startRecording')}...
                </Badge>
              )}
              {isProcessing && (
                <Badge variant="secondary">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {t('voice.processing')}
                </Badge>
              )}
              {!isRecording && !isProcessing && (
                <p className="text-sm text-muted-foreground">
                  {t('voice.speakNow')}
                </p>
              )}
            </div>
          </div>

          {/* Audio Playback */}
          {audioUrl && (
            <div className="flex justify-center">
              <Button
                onClick={playAudio}
                variant="outline"
                size="sm"
              >
                {isPlaying ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Play Recording
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      {transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">{t('voice.transcript')}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">{transcript}</p>
          </CardContent>
        </Card>
      )}

      {/* AI Response */}
      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">{t('voice.response')}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-wrap">{response}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VoiceRecorder;