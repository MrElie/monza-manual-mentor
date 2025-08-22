
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

    console.log('Found PDFs for model:', docs?.length || 0);

    let responseText: string | null = null;

    if (!docs || docs.length === 0) {
      responseText = "No repair manuals are available for this model yet. Please contact support to upload the PDFs for this vehicle.";
    } else {
      // Prepare content from PDFs for context
      let pdfContext = '';
      const availableManuals = docs.map(d => d.original_filename || 'Manual').join(', ');
      
      // Create a comprehensive system prompt
      const systemPrompt = `You are an expert automotive technician assistant specializing in ${carModel?.brand?.display_name} ${carModel?.display_name} vehicles. 

You have access to the following repair manuals: ${availableManuals}

IMPORTANT INSTRUCTIONS:
1. Only provide answers based on the repair manual content for this specific vehicle model
2. If you don't have specific information about the question in the manuals, clearly state that
3. Always be specific about which manual section or page you're referencing when possible
4. Provide detailed, step-by-step instructions when appropriate
5. Include safety warnings and precautions when relevant
6. Focus on practical repair and maintenance information

If the question is not related to vehicle repair or maintenance, politely redirect the conversation back to automotive topics.`;

      try {
        const vsId = carModel?.vector_store_id as string | undefined;

        if (vsId) {
          console.log('Using vector store for file_search:', vsId);
          // Use OpenAI Responses API with Vector Store via tool_resources for grounded answers
          const resp = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-5-mini-2025-08-07',
              // Use max_output_tokens for Responses API (not max_completion_tokens)
              max_output_tokens: 800,
              tools: [
                { type: 'file_search' }
              ],
              tool_resources: {
                file_search: {
                  vector_store_ids: [vsId]
                }
              },
              input: [
                {
                  role: 'system',
                  content: [
                    {
                      type: 'text',
                      text: `${systemPrompt}\n\nAlways cite the exact section/page when possible based on the retrieved passages. Answer in ${language}.`
                    }
                  ]
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Regarding ${carModel?.brand?.display_name} ${carModel?.display_name}: ${message}`
                    }
                  ]
                }
              ]
            }),
          });

          if (!resp.ok) {
            const err = await resp.text();
            console.error('OpenAI responses error:', err);
            responseText = "I'm currently unable to access the repair manual information. Please try again in a moment.";
          } else {
            const out = await resp.json();
            console.log('OpenAI response (responses API) received successfully');

            // Attempt to extract text from various possible response shapes
            let text: string | null = null;
            if (typeof out.output_text === 'string') {
              text = out.output_text;
            } else if (Array.isArray(out.output)) {
              try {
                const parts: string[] = [];
                for (const p of out.output) {
                  if (typeof p?.content === 'string') parts.push(p.content);
                  if (Array.isArray(p?.content)) {
                    for (const c of p.content) {
                      if (typeof c?.text === 'string') parts.push(c.text);
                    }
                  }
                  if (typeof p?.text === 'string') parts.push(p.text);
                }
                if (parts.length) text = parts.join('\n');
              } catch (_) { /* noop */ }
            }
            responseText = text || "I'm having trouble processing your question right now. Please try again.";
          }
        } else {
          // Fallback: no vector store available – use regular chat completions (legacy)
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Regarding ${carModel?.brand?.display_name} ${carModel?.display_name}: ${message}` }
              ],
              max_tokens: 800
            }),
          });

          if (!resp.ok) {
            const err = await resp.text();
            console.error('OpenAI chat completion error:', err);
            responseText = "I'm currently unable to access the repair manual information. Please try again in a moment.";
          } else {
            const out = await resp.json();
            console.log('OpenAI response (chat completions) received successfully');
            const aiMessage = out.choices?.[0]?.message;
            responseText = aiMessage?.content || "I'm having trouble processing your question right now. Please try again.";

            if (responseText && !responseText.includes("repair manual") && !responseText.includes("manual")) {
              responseText += `\n\n*This response is based on general automotive knowledge. For specific procedures, please refer to the ${carModel?.display_name} repair manuals.*`;
            }
          }
        }
      } catch (e) {
        console.error('Chat completion API exception', e);
        responseText = "I'm currently unable to process your question. Please try again in a moment.";
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
