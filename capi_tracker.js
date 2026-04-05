/**
 * MegaPack CAPI Tracker V4.2 — Edição Especial Sênior
 * Gerencia a deduplicação de eventos (Browserside Pixel + Server-side CAPI)
 * Correção de Funil: Diferencia cliques de navegação (5,99) de Inícios de Checkout Reais.
 */

(function() {
  const CONFIG = {
    PIXEL_ID: '1438112951198337',
    SUPABASE_URL: 'https://ckwvvqqndafajlahngsh.supabase.co',
    TRACKER_FUNCTION: 'megapack-tracker',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrd3Z2cXFuZGFmYWpsYWhuZ3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTcwNTMsImV4cCI6MjA5MDk5MzA1M30._CJOk6cWtJkwg7-sUbhuqB4FXWhzqtDe8rlo7_mZxTY'
  };

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function generateEventId() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  let eventId = localStorage.getItem('megapack_event_id');
  if (!eventId) {
    eventId = generateEventId();
    localStorage.setItem('megapack_event_id', eventId);
  }

  window.MegaTracker = {
    eventId: eventId,
    
    track: async function(eventName, customData = {}) {
      console.log(`[MegaTracker] Rastreando: ${eventName}`, customData);

      // Persiste o valor para recuperação na página de obrigado
      if (customData.value && eventName === 'InitiateCheckout') {
        localStorage.setItem('megapack_last_value', customData.value);
        localStorage.setItem('megapack_last_content', customData.content_name || '');
      }

      // 1. Pixel (Client)
      if (window.fbq) {
        window.fbq('track', eventName, {
          ...customData,
          eventID: this.eventId
        });
      }

      // 2. CAPI (Server Relay)
      try {
        const payload = {
          event_name: eventName,
          event_id: this.eventId,
          event_time: Math.floor(Date.now() / 1000),
          user_data: {
            client_user_agent: navigator.userAgent,
            fbp: getCookie('_fbp'),
            fbc: getCookie('_fbc')
          },
          custom_data: {
            currency: 'BRL',
            value: Number(customData.value) || 0,
            ...customData
          },
          source_url: window.location.href
        };

        fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${CONFIG.TRACKER_FUNCTION}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': CONFIG.ANON_KEY,
            'Authorization': `Bearer ${CONFIG.ANON_KEY.trim()}`
          },
          body: JSON.stringify(payload)
        }).catch(err => console.warn('[MegaTracker] CAPI Relay Offline', err));

      } catch (e) {
        console.error('[MegaTracker] CAPI Error:', e);
      }
    }
  };

  const trackInitialView = () => {
    if (!window._megapack_pv_fired) {
      window.MegaTracker.track('PageView');
      window._megapack_pv_fired = true;
    }
  };

  if (document.readyState === 'complete') trackInitialView();
  else window.addEventListener('load', trackInitialView);

  // LOGICA DO FUNIL V4.2
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const href = anchor.href;

    // Detectar Checkout Real (Celetus)
    if (href.includes('pay.celetus.com')) {
      let value = 15.99;
      let name = 'MegaPack Premium';

      if (href.includes('FCX8Z2KC')) { value = 5.99; name = 'MegaPack Basico (Oferta)'; }
      if (href.includes('PZL2DZN8')) { value = 10.99; name = 'MegaPack Upgrade Vitalicio'; }
      if (href.includes('NL9KO4PG')) { value = 15.99; name = 'MegaPack Premium Direto'; }

      window.MegaTracker.track('InitiateCheckout', { 
        content_name: name, 
        value: value,
        currency: 'BRL'
      });
    } 
    // Captura apenas navegação para a página de oferta (NÃO é InitiateCheckout ainda)
    else if (href.includes('upgrade.html')) {
       console.log('[MegaTracker] Navegação para Oferta Detectada (R$ 5,99)');
       // Opcional: track('ViewContent', { content_name: 'Lead interessado em 5,99' })
    }
  });

})();
