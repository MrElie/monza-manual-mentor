import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CarBrand, CarModel, PdfDocument } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  Loader2,
  Database,
} from "lucide-react";

interface DocWithModel extends PdfDocument {
  model?: { display_name: string; brand?: { display_name: string } };
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const AdminManuals: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<(CarModel & { brand?: CarBrand })[]>([]);
  const [documents, setDocuments] = useState<DocWithModel[]>([]);

  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    state: "uploading" | "indexing" | "done" | "error";
    message?: string;
  } | null>(null);

  const fetchAll = useCallback(async () => {
    const [brandsRes, modelsRes, docsRes] = await Promise.all([
      supabase.from("car_brands").select("*").order("display_name"),
      supabase
        .from("car_models")
        .select("*, brand:car_brands(*)")
        .order("display_name"),
      supabase
        .from("pdf_documents")
        .select("*, model:car_models(display_name, brand:car_brands(display_name))")
        .order("created_at", { ascending: false }),
    ]);
    if (brandsRes.data) setBrands(brandsRes.data as CarBrand[]);
    if (modelsRes.data) setModels(modelsRes.data as any);
    if (docsRes.data) setDocuments(docsRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  const filteredModels = useMemo(
    () => (selectedBrand ? models.filter((m) => m.brand_id === selectedBrand) : models),
    [models, selectedBrand],
  );

  const docsForSelectedModel = useMemo(
    () => (selectedModel ? documents.filter((d) => d.model_id === selectedModel) : []),
    [documents, selectedModel],
  );

  const selectedModelObj = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

  const handleFiles = async (files: FileList | File[]) => {
    if (!selectedModel) {
      toast({
        title: "Pick a model first",
        description: "Select the brand and model these manuals belong to.",
        variant: "destructive",
      });
      return;
    }

    const list = Array.from(files);
    for (const file of list) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Unsupported file",
          description: `${file.name} is not a PDF.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 50 MB.`,
          variant: "destructive",
        });
        continue;
      }

      try {
        setUploadProgress({ name: file.name, state: "uploading" });

        // 1) Upload to Supabase storage under per-model folder
        const sanitized = file.name
          .replace(/[[\]{}()*+?.,\\^$|#\s]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        const storagePath = `${selectedModel}/${Date.now()}-${sanitized}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("repair-manuals")
          .upload(storagePath, file, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        // 2) Create the DB row
        const { data: inserted, error: insertError } = await supabase
          .from("pdf_documents")
          .insert({
            model_id: selectedModel,
            filename: storagePath,
            original_filename: file.name,
            file_size: file.size,
            mime_type: "application/pdf",
            storage_path: uploadData.path,
            uploaded_by: user?.id,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        // 3) Index into the model's OpenAI vector store
        setUploadProgress({ name: file.name, state: "indexing" });
        const { data: idxData, error: idxError } = await supabase.functions.invoke(
          "upload-pdf-to-vector-store",
          { body: { documentId: inserted.id } },
        );
        if (idxError || !idxData?.success) {
          throw new Error(idxError?.message || idxData?.error || "Indexing failed");
        }

        setUploadProgress({ name: file.name, state: "done" });
        toast({
          title: "Uploaded & indexed",
          description: `${file.name} is now searchable.`,
        });
      } catch (error: any) {
        console.error("Upload failed:", error);
        setUploadProgress({
          name: file.name,
          state: "error",
          message: error?.message || "Upload failed",
        });
        toast({
          title: "Upload failed",
          description: error?.message || "Something went wrong",
          variant: "destructive",
        });
      }
    }

    await fetchAll();
    setTimeout(() => setUploadProgress(null), 1500);
  };

  const handleDelete = async (doc: DocWithModel) => {
    if (!confirm(`Delete "${doc.original_filename}"? This cannot be undone.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-pdf-from-vector-store",
        { body: { documentId: doc.id } },
      );
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Delete failed");
      }
      toast({ title: "Deleted", description: `${doc.original_filename} removed.` });
      await fetchAll();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">PDF Manuals & Bulletins</h1>
            <p className="text-muted-foreground">
              Upload service documents — each model gets its own isolated vector store.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Link>
          </Button>
        </div>

        {/* Selectors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Target Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Brand
              </label>
              <Select
                value={selectedBrand}
                onValueChange={(v) => {
                  setSelectedBrand(v);
                  setSelectedModel("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Model
              </label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={!selectedBrand}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={selectedBrand ? "Select a model" : "Pick a brand first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedModelObj && (
              <div className="md:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Vector store:</span>
                {selectedModelObj.vector_store_id ? (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedModelObj.vector_store_id}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    Not yet created — will be auto-provisioned on first upload
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload PDFs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              } ${!selectedModel ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                disabled={!selectedModel || !!uploadProgress}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">
                Drop PDFs here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Up to 50 MB per file. Multiple files supported.
              </p>
            </label>

            {uploadProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {uploadProgress.state === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : uploadProgress.state === "error" ? (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <span className="font-medium">{uploadProgress.name}</span>
                  <span className="text-muted-foreground">
                    —{" "}
                    {uploadProgress.state === "uploading"
                      ? "Uploading to storage…"
                      : uploadProgress.state === "indexing"
                        ? "Indexing into vector store…"
                        : uploadProgress.state === "done"
                          ? "Done"
                          : uploadProgress.message || "Failed"}
                  </span>
                </div>
                <Progress
                  value={
                    uploadProgress.state === "uploading"
                      ? 35
                      : uploadProgress.state === "indexing"
                        ? 75
                        : uploadProgress.state === "done"
                          ? 100
                          : 100
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents for selected model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents{" "}
              {selectedModelObj ? `for ${selectedModelObj.display_name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : !selectedModel ? (
              <p className="text-muted-foreground">
                Select a model to view its uploaded manuals.
              </p>
            ) : docsForSelectedModel.length === 0 ? (
              <p className="text-muted-foreground">
                No manuals uploaded yet for this model.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {docsForSelectedModel.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between py-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.file_size / 1024 / 1024).toFixed(2)} MB •{" "}
                          {new Date(doc.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.vector_store_document_id ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Indexed
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not indexed</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminManuals;
