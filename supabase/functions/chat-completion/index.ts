import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, modelId, language = 'en', sessionId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing chat completion for model:', modelId, 'language:', language);

    // Get car model info for context
    let carModel: any = null;
    if (modelId) {
      const { data } = await supabase
        .from('car_models')
        .select('*, brand:car_brands(*)')
        .eq('id', modelId)
        .single();
      carModel = data;
    }

    // Fetch PDFs for the model
    const { data: docs, error: docsErr } = await supabase
      .from('pdf_documents')
      .select('id, storage_path, original_filename, vector_store_document_id')
      .eq('model_id', modelId as string);

    if (docsErr) {
      console.error('Failed fetching pdf documents', docsErr);
    }

    // Prepare strict instruction: only answer from PDFs
    const strictInstruction = (carModel ? `Only answer using the provided PDF manuals for ${carModel.brand?.display_name} ${carModel.display_name}.` : 'Only answer using the provided PDF manuals for the selected car model.') +
      " If the answer is not found in the PDFs, reply exactly: 'I couldn't find this in the model\'s PDFs.' Include brief citations to the PDF filenames and page numbers when available.";

    let responseText: string | null = null;

    if (!docs || docs.length === 0) {
      responseText = "I couldn't find this in the model's PDFs.";
    } else {
      // Ensure an OpenAI vector store exists for this model
      let vectorStoreId = carModel?.vector_store_id || null;

      if (!vectorStoreId) {
        const vsRes = await fetch('https://api.openai.com/v1/vector_stores', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `${carModel?.brand?.display_name || 'Unknown'} ${carModel?.display_name || 'Model'} Manuals` }),
        });
        if (!vsRes.ok) {
          const err = await vsRes.text();
          console.error('Failed creating vector store', err);
        } else {
          const vsJson = await vsRes.json();
          vectorStoreId = vsJson.id;
          // Persist on the model
          if (vectorStoreId && carModel?.id) {
            await supabase.from('car_models').update({ vector_store_id: vectorStoreId }).eq('id', carModel.id);
          }
        }
      }

      // Upload missing PDFs to OpenAI and link to vector store
      if (vectorStoreId) {
        for (const d of docs) {
          if (d.vector_store_document_id) continue;
          try {
            const { data: signed } = await supabase.storage
              .from('repair-manuals')
              .createSignedUrl(d.storage_path, 60);

            if (!signed?.signedUrl) continue;
            const fileResp = await fetch(signed.signedUrl);
            if (!fileResp.ok) continue;
            const fileBlob = await fileResp.blob();

            const form = new FormData();
            form.append('purpose', 'assistants');
            form.append('file', fileBlob, d.original_filename || 'document.pdf');

            const uploadFile = await fetch('https://api.openai.com/v1/files', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${openAIApiKey}` },
              body: form,
            });
            if (!uploadFile.ok) {
              console.error('OpenAI file upload failed', await uploadFile.text());
              continue;
            }
            const fileJson = await uploadFile.json();

            const attachResp = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ file_id: fileJson.id }),
            });
            if (!attachResp.ok) {
              console.error('Attach file to vector store failed', await attachResp.text());
            } else {
              await supabase
                .from('pdf_documents')
                .update({ vector_store_document_id: fileJson.id })
                .eq('id', d.id);
            }
          } catch (e) {
            console.error('Error processing PDF for vector store', e);
          }
        }

        // Wait for vector store indexing to complete (best-effort)
        try {
          const waitForIndexing = async () => {
            for (let i = 0; i < 8; i++) { // ~8s max
              const list = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${openAIApiKey}` },
              });
              if (!list.ok) break;
              const lj = await list.json();
              const pending = (lj.data || []).some((f: any) => f.status && f.status !== 'completed');
              if (!pending) return true;
              await new Promise((r) => setTimeout(r, 1000));
            }
            return false;
          };
          await waitForIndexing();
        } catch (_) {
          // non-fatal
        }

        // Query strictly with file_search using the vector store
        try {
          const resp = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-2025-04-14',
              input: [
                { role: 'system', content: strictInstruction },
                { role: 'user', content: message }
              ],
              tools: [{ type: 'file_search' }],
              tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
              max_completion_tokens: 800
            }),
          });

          if (!resp.ok) {
            const err = await resp.text();
            console.error('OpenAI responses error:', err);
            responseText = "I couldn't find this in the model's PDFs.";
          } else {
            const out = await resp.json();
            // Extract answer text
            let text = out.output_text
              || out.output?.map((c: any) => (c.content?.map?.((p: any) => p.text?.value || p.text || p.content).filter(Boolean).join('\n'))).filter(Boolean).join('\n')
              || out.choices?.[0]?.message?.content
              || null;

            // Enforce RAG-only: require file citations in annotations
            const annotations = (out.output?.flatMap((c: any) =>
              (c.content || []).flatMap((p: any) => (p.text?.annotations || p.annotations || []))
            ) || []).filter(Boolean);
            const hasCitations = annotations.some((a: any) => a?.file_citation || a?.file_id || a?.type === 'file_citation');

            responseText = (hasCitations && text)
              ? text
              : "I couldn't find this in the model's PDFs.";
          }
        } catch (e) {
          console.error('Responses API exception', e);
          responseText = "I couldn't find this in the model's PDFs.";
        }
      } else {
        responseText = "I couldn't find this in the model's PDFs.";
      }
    }


    // Save to chat history if sessionId provided
    if (sessionId) {
      try {
        // Save user message
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'user',
          content: message
        });

        // Save assistant response
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: responseText
        });
      } catch (error) {
        console.error('Error saving chat messages:', error);
        // Continue without saving if there's an error
      }
    }

    // Log interaction for admins to review later
    try {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer', '').trim();

      let userId: string | null = null;
      let userEmail: string | null = null;

      if (token) {
        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (!userErr && userRes?.user) {
          userId = userRes.user.id;
          // deno-lint-ignore no-explicit-any
          userEmail = (userRes.user as any).email ?? null;
        }
      }

      // Fallback: infer user from session if needed
      if (!userId && sessionId) {
        const { data: sessionRow } = await supabase
          .from('chat_sessions')
          .select('user_id')
          .eq('id', sessionId)
          .maybeSingle();
        if (sessionRow?.user_id) {
          userId = sessionRow.user_id;
          // attempt to fetch email from profiles if available
          const { data: prof } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('user_id', userId)
            .maybeSingle();
          if (prof?.username) userEmail = prof.username;
        }
      }

      if (userId) {
        const ip = (req.headers.get('x-forwarded-for') || '')
          .split(',')[0]
          .trim() || req.headers.get('x-real-ip') || null;
        const userAgent = req.headers.get('user-agent') || null;

        await supabase.from('user_interaction_logs').insert({
          user_id: userId,
          user_email: userEmail,
          session_id: sessionId || null,
          message_content: message,
          ai_response: responseText,
          model_name: carModel?.display_name || null,
          interaction_type: 'chat',
          ip_address: ip,
          user_agent: userAgent,
        });
      }
    } catch (logErr) {
      console.error('Failed to log interaction:', logErr);
    }

    console.log('Chat completion generated successfully');

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-completion function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate response' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});