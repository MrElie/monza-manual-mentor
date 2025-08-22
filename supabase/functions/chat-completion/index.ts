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
    let carModel = null;
    if (modelId) {
      const { data } = await supabase
        .from('car_models')
        .select('*, brand:car_brands(*)')
        .eq('id', modelId)
        .single();
      carModel = data;
    }

    // Build system prompt based on language and model
    const systemPromptEn = `You are an expert automotive technician and repair assistant specializing in electric vehicles, particularly Voyah and Mhero models.

${carModel ? `You are currently assisting with a ${carModel.brand?.display_name} ${carModel.display_name} vehicle.` : ''}

Your expertise includes:
- Electric vehicle systems (battery, motors, charging)
- Diagnostic trouble codes (DTCs) and their solutions
- Repair procedures and maintenance schedules
- Parts identification and replacement procedures
- Safety protocols for high-voltage systems
- Wiring diagrams and electrical troubleshooting
- Body work and interior repairs
- Software updates and calibrations

Guidelines:
1. Always prioritize safety, especially with high-voltage systems
2. Provide step-by-step repair instructions when appropriate
3. Include part numbers, torque specifications, and special tools when known
4. Explain diagnostic procedures clearly
5. Mention relevant safety precautions and warnings
6. If you need more information, ask specific diagnostic questions
7. Reference relevant service bulletins or technical updates when applicable

Respond in a professional, clear, and helpful manner. If asked about something outside automotive repair, politely redirect to vehicle-related topics.`;

    const systemPromptAr = `أنت فني سيارات خبير ومساعد إصلاح متخصص في المركبات الكهربائية، وخاصة موديلات فوياه ومهيرو.

${carModel ? `أنت تساعد حالياً في سيارة ${carModel.brand?.display_name} ${carModel.display_name}.` : ''}

خبرتك تشمل:
- أنظمة المركبات الكهربائية (البطارية، المحركات، الشحن)
- رموز اكتشاف الأعطال التشخيصية وحلولها
- إجراءات الإصلاح وجداول الصيانة
- تحديد القطع وإجراءات الاستبدال
- بروتوكولات السلامة لأنظمة الجهد العالي
- مخططات الأسلاك واستكشاف الأعطال الكهربائية
- أعمال الهيكل وإصلاحات الداخلية
- تحديثات البرامج والمعايرة

الإرشادات:
1. أعط الأولوية دائماً للسلامة، خاصة مع أنظمة الجهد العالي
2. قدم تعليمات الإصلاح خطوة بخطوة عند الاقتضاء
3. اذكر أرقام القطع ومواصفات عزم الدوران والأدوات الخاصة عند معرفتها
4. اشرح إجراءات التشخيص بوضوح
5. اذكر احتياطات السلامة والتحذيرات ذات الصلة
6. إذا كنت بحاجة لمزيد من المعلومات، اطرح أسئلة تشخيصية محددة
7. ارجع إلى نشرات الخدمة أو التحديثات التقنية ذات الصلة عند الاقتضاء

اجب بطريقة مهنية وواضحة ومفيدة. إذا سُئلت عن شيء خارج إصلاح السيارات، وجه بأدب نحو المواضيع المتعلقة بالمركبات.`;

    const systemPrompt = language === 'ar' ? systemPromptAr : systemPromptEn;

    // Get chat completion from OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;

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