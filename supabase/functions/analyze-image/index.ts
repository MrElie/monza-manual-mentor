import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { image, modelId } = await req.json();

    if (!image) {
      throw new Error('No image provided');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Analyzing image for model:', modelId);

    // Analyze image with GPT-4 Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert automotive technician specializing in electric vehicles, particularly Voyah and Mhero models. 

Your task is to analyze automotive images and provide detailed technical analysis including:

1. **Component Identification**: Identify all visible automotive parts, components, and systems
2. **Condition Assessment**: Evaluate the condition of visible components (normal, worn, damaged, etc.)
3. **Diagnostic Insights**: Look for signs of wear, damage, corrosion, misalignment, or other issues
4. **Repair Recommendations**: Suggest appropriate repair procedures, replacement parts, or maintenance actions
5. **Safety Considerations**: Highlight any safety concerns or precautions
6. **Diagnostic Codes**: If relevant, mention potential diagnostic trouble codes (DTCs) that might be related
7. **Tools and Parts**: List required tools and parts for any recommended repairs

Focus on:
- Battery systems and high-voltage components
- Electric motor assemblies
- Charging systems
- Suspension components
- Brake systems
- Body panels and trim
- Interior components
- Wiring and connectors

Provide your analysis in a clear, structured format that a technician can easily follow. Be specific about part numbers, torque specifications, and safety procedures when applicable.

If the image shows diagnostic screens, error codes, or instrument cluster displays, interpret them in detail.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this automotive image and provide a comprehensive technical assessment.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('Image analysis completed successfully');

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-image function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze image' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});