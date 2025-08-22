import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Camera as CameraIcon, Upload, Loader2, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CameraCaptureProps {
  onImageAnalysis?: (analysis: string) => void;
  modelId?: string;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageAnalysis, modelId }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const takePicture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        setImage(image.dataUrl);
        setAnalysis('');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      toast({
        title: t('common.error'),
        description: t('camera.cameraPermission'),
        variant: 'destructive'
      });
    }
  };

  const uploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImage(e.target.result as string);
          setAnalysis('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) {
      toast({
        title: t('common.error'),
        description: t('camera.noImageSelected'),
        variant: 'destructive'
      });
      return;
    }

    setAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-image', {
        body: { 
          image: image.split(',')[1], // Remove data URL prefix
          modelId 
        }
      });

      if (error) throw error;

      const analysisResult = data.analysis || 'No analysis available';
      setAnalysis(analysisResult);
      onImageAnalysis?.(analysisResult);
      
      toast({
        title: t('common.success'),
        description: 'Image analyzed successfully'
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to analyze image',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const retakePicture = () => {
    setImage(null);
    setAnalysis('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('camera.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Controls */}
          {!image && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={takePicture}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
                size="lg"
              >
                <CameraIcon className="mr-2 h-4 w-4" />
                {t('camera.takePicture')}
              </Button>
              <Button
                onClick={uploadImage}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Upload className="mr-2 h-4 w-4" />
                {t('camera.uploadImage')}
              </Button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Image Preview */}
          {image && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={image}
                  alt="Captured"
                  className="w-full h-auto max-h-96 object-contain bg-muted"
                />
              </div>

              {/* Image Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={analyzeImage}
                  disabled={analyzing}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                  size="lg"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('camera.analyzing')}
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('camera.analyze')}
                    </>
                  )}
                </Button>
                <Button
                  onClick={retakePicture}
                  variant="outline"
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('camera.retake')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">{t('camera.results')}</Badge>
              {t('camera.imageAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-wrap">{analysis}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CameraCapture;