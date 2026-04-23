import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_BASE = "https://api.openai.com/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate caller and ensure admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    // Load the document and its model
    const { data: doc, error: docErr } = await supabase
      .from("pdf_documents")
      .select("id, model_id, storage_path, original_filename, mime_type, vector_store_document_id")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    if (doc.vector_store_document_id) {
      return new Response(
        JSON.stringify({ success: true, message: "Already indexed", fileId: doc.vector_store_document_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: model, error: modelErr } = await supabase
      .from("car_models")
      .select("id, display_name, vector_store_id, brand:car_brands(display_name)")
      .eq("id", doc.model_id)
      .single();
    if (modelErr || !model) throw new Error("Car model not found");

    // Ensure the model has its own vector store
    let vectorStoreId = model.vector_store_id;
    if (!vectorStoreId) {
      const vsName = `${(model as any).brand?.display_name ?? "Brand"} - ${model.display_name}`;
      const vsResp = await fetch(`${OPENAI_BASE}/vector_stores`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({ name: vsName }),
      });
      if (!vsResp.ok) {
        const errText = await vsResp.text();
        throw new Error(`Failed to create vector store: ${errText}`);
      }
      const vsJson = await vsResp.json();
      vectorStoreId = vsJson.id;
      const { error: updateErr } = await supabase
        .from("car_models")
        .update({ vector_store_id: vectorStoreId })
        .eq("id", model.id);
      if (updateErr) console.error("Failed to persist vector_store_id", updateErr);
    }

    // Download the PDF from Supabase Storage
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from("repair-manuals")
      .download(doc.storage_path);
    if (downloadErr || !fileBlob) {
      throw new Error(`Failed to download PDF from storage: ${downloadErr?.message}`);
    }

    // Upload to OpenAI Files
    const uploadForm = new FormData();
    uploadForm.append("purpose", "assistants");
    uploadForm.append(
      "file",
      new File([fileBlob], doc.original_filename, {
        type: doc.mime_type || "application/pdf",
      }),
    );

    const fileResp = await fetch(`${OPENAI_BASE}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: uploadForm,
    });
    if (!fileResp.ok) {
      const errText = await fileResp.text();
      throw new Error(`OpenAI file upload failed: ${errText}`);
    }
    const fileJson = await fileResp.json();
    const openaiFileId: string = fileJson.id;

    // Attach the file to the vector store
    const attachResp = await fetch(
      `${OPENAI_BASE}/vector_stores/${vectorStoreId}/files`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2",
        },
        body: JSON.stringify({ file_id: openaiFileId }),
      },
    );
    if (!attachResp.ok) {
      const errText = await attachResp.text();
      throw new Error(`Vector store attach failed: ${errText}`);
    }

    // Persist the OpenAI file id
    await supabase
      .from("pdf_documents")
      .update({ vector_store_document_id: openaiFileId })
      .eq("id", doc.id);

    return new Response(
      JSON.stringify({
        success: true,
        vectorStoreId,
        fileId: openaiFileId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("upload-pdf-to-vector-store error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
