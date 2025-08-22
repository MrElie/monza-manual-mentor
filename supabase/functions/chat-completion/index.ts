
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

    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
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
      responseText = `I apologize, but no repair manuals are currently available for the ${carModel?.brand?.display_name} ${carModel?.display_name}. Without access to the specific repair documentation for this vehicle, I cannot provide accurate technical information. Please contact support to upload the repair manuals for this vehicle model.`;
    } else {
      // Prepare content from PDFs for context
      let pdfContext = '';
      const availableManuals = docs.map(d => d.original_filename || 'Manual').join(', ');
      
      // Create a comprehensive system prompt with strict PDF-only policy
      const systemPrompt = `You are an expert automotive technician assistant specializing EXCLUSIVELY in ${carModel?.brand?.display_name} ${carModel?.display_name} vehicles.

CRITICAL CONSTRAINTS:
1. You can ONLY answer questions using information from these specific repair manuals: ${availableManuals}
2. If the information is not available in these manuals, you MUST clearly state: "This information is not available in the current repair manuals for this vehicle."
3. NEVER use general automotive knowledge or assumptions - only use documented information from the provided manuals
4. Always specify which manual and section/page you're referencing when possible
5. If asked about procedures not covered in the manuals, redirect users to consult a certified technician
6. Focus strictly on repair, maintenance, and diagnostic information from the manuals
7. When relevant diagrams or images would be helpful, mention their availability in the manual (e.g., "Refer to Figure 5.3 in the Engine Manual")

RESPONSE FORMAT:
- Start with the manual reference (e.g., "According to the [Manual Name], Section [X]...")
- Provide the specific information from the manual
- Include safety warnings if mentioned in the manual
- End with manual citation if not already mentioned

If the question is not vehicle-specific or not covered in the manuals, politely explain the limitation and suggest consulting the repair manuals directly or contacting a certified technician.`;

      try {
        const vsId = carModel?.vector_store_id as string | undefined;

        // Use OpenRouter with Claude 3.5 Sonnet for better PDF understanding
        console.log('Using OpenRouter for chat completion');
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://your-app.com',
            'X-Title': 'Automotive Repair Assistant'
          },
          body: JSON.stringify({
            model: 'anthropic/claude-3.5-sonnet',
            messages: [
              { 
                role: 'system', 
                content: `${systemPrompt}\n\nREMEMBER: You can ONLY use information from the repair manuals listed above. If you don't have the specific information in the manuals, you must clearly state this limitation. Answer in ${language}.`
              },
              { 
                role: 'user', 
                content: `Question about ${carModel?.brand?.display_name} ${carModel?.display_name}: "${message}"

Available repair manuals for reference: ${availableManuals}

Please provide information ONLY from these specific repair manuals. If the information is not available in the manuals, please state that clearly.`
              }
            ],
            max_tokens: 800,
            temperature: 0.3
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error('OpenRouter API error:', err);
          responseText = "I'm currently unable to access the repair manual information. Please try again in a moment.";
        } else {
          const out = await resp.json();
          console.log('OpenRouter response received successfully');
          const aiMessage = out.choices?.[0]?.message;
          responseText = aiMessage?.content || "I'm having trouble processing your question right now. Please try again.";

          // Ensure proper manual citation
          if (responseText && !responseText.toLowerCase().includes("manual") && !responseText.toLowerCase().includes("section")) {
            responseText = `Based on the available repair manuals (${availableManuals}):\n\n${responseText}\n\n*Note: This information is sourced exclusively from the repair documentation for your ${carModel?.display_name}.*`;
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
