import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const FB_PIXEL_ID = Deno.env.get('FB_PIXEL_ID');
  const FB_ACCESS_TOKEN = Deno.env.get('FB_ACCESS_TOKEN');

  try {
    const body = await req.json();
    const { event_name, event_id, event_time, user_data, custom_data, source_url } = body;

    // 1. EXTRAÇÃO SÊNIOR DE IDENTIDADE (IP E UA)
    const client_ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const client_ua = req.headers.get('user-agent') || user_data.client_user_agent;

    user_data.client_ip_address = client_ip;
    user_data.client_user_agent = client_ua;

    const eventData = {
      data: [{
        event_name: event_name,
        event_time: event_time || Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: event_id,
        event_source_url: source_url,
        user_data: user_data,
        custom_data: custom_data
      }]
    };

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });

    const result = await fbRes.json();
    console.log(`[CAPI] Evento ${event_name} enviado para o Meta. Resposta:`, JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    console.error('CAPI Relay Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
