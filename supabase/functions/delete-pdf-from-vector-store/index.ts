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

    // Authenticate + admin check
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userRes } = await supabase.auth.getUser(token);
    if (!userRes?.user) {
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

    const { data: doc } = await supabase
      .from("pdf_documents")
      .select("id, model_id, storage_path, vector_store_document_id")
      .eq("id", documentId)
      .single();
    if (!doc) throw new Error("Document not found");

    const { data: model } = await supabase
      .from("car_models")
      .select("vector_store_id")
      .eq("id", doc.model_id)
      .single();

    // Best-effort: detach from vector store + delete the file in OpenAI
    if (doc.vector_store_document_id) {
      if (model?.vector_store_id) {
        try {
          await fetch(
            `${OPENAI_BASE}/vector_stores/${model.vector_store_id}/files/${doc.vector_store_document_id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${openaiKey}`,
                "OpenAI-Beta": "assistants=v2",
              },
            },
          );
        } catch (e) {
          console.error("vector store detach failed", e);
        }
      }
      try {
        await fetch(`${OPENAI_BASE}/files/${doc.vector_store_document_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${openaiKey}` },
        });
      } catch (e) {
        console.error("file delete failed", e);
      }
    }

    // Remove the file from storage and DB
    if (doc.storage_path) {
      await supabase.storage.from("repair-manuals").remove([doc.storage_path]);
    }
    await supabase.from("pdf_documents").delete().eq("id", doc.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-pdf-from-vector-store error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
