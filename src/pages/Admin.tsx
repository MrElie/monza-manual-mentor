import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CarModel, CarBrand, PdfDocument } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Settings, ArrowLeft, Trash2 } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isAdmin) {
      navigate('/');
      return;
    }
    
    fetchData();
  }, [user, isAdmin, navigate]);

  const fetchData = async () => {
    try {
      const [brandsData, modelsData, documentsData] = await Promise.all([
        supabase.from('car_brands').select('*').order('display_name'),
        supabase.from('car_models').select('*, brand:car_brands(*)').order('display_name'),
        supabase.from('pdf_documents').select('*, model:car_models(display_name)').order('created_at', { ascending: false })
      ]);

      if (brandsData.error) throw brandsData.error;
      if (modelsData.error) throw modelsData.error;
      if (documentsData.error) throw documentsData.error;

      setBrands(brandsData.data || []);
      setModels(modelsData.data || []);
      setDocuments(documentsData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedModel) {
      toast({
        title: "Error",
        description: "Please select a file and car model",
        variant: "destructive",
      });
      return;
    }

    if (file.type !== 'application/pdf') {
      toast({
        title: "Error",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
      return;
    }
    // Enforce client-side max size (50 MB) to avoid server rejection
    const MAX_SIZE_BYTES = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 50 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      // Sanitize filename by removing invalid characters for Supabase Storage
      const sanitizedFileName = file.name
        .replace(/[[\]{}()*+?.,\\^$|#\s]/g, '_') // Replace invalid chars with underscore
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
      
      // Upload to Supabase Storage
      const fileName = `${selectedModel}/${Date.now()}-${sanitizedFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('repair-manuals')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save document record
      const { error: insertError } = await supabase
        .from('pdf_documents')
        .insert({
          model_id: selectedModel,
          filename: fileName,
          original_filename: file.name,
          file_size: file.size,
          storage_path: uploadData.path,
          uploaded_by: user?.id
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "PDF uploaded successfully",
      });

      // Refresh documents list
      fetchData();
      
      // Reset form
      event.target.value = '';
      setSelectedModel('');
    } catch (error) {
      console.error('Upload error:', error);
      const anyErr: any = error as any;
      const statusCode = anyErr?.statusCode || anyErr?.status || anyErr?.value?.statusCode;
      const message: string = anyErr?.message || anyErr?.value?.message || 'Failed to upload PDF';

      if (statusCode === 413 || /exceeded the maximum allowed size/i.test(message)) {
        toast({
          title: "File too large",
          description: "Your PDF exceeds the maximum allowed size (50 MB). Please compress it and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('repair-manuals')
        .remove([storagePath]);

      // Delete record
      const { error } = await supabase
        .from('pdf_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              </div>
            </div>
            <Badge variant="secondary">
              {user.email}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload PDFs</TabsTrigger>
            <TabsTrigger value="manage">Manage Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Repair Manual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="model-select">Select Car Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a car model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.brand?.display_name} {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="pdf-upload">Upload PDF File</Label>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || !selectedModel}
                    />
                  </div>
                  
                  {uploading && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Library ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No documents uploaded yet
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">
                            {doc.original_filename}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Model: {(doc as any).model?.display_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB • 
                            Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.vector_store_document_id && (
                            <Badge variant="secondary">Vectorized</Badge>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;