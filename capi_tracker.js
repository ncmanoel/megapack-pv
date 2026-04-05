/**
 * MegaPack CAPI Tracker V4
 * Gerencia a deduplicação de eventos (Browserside Pixel + Server-side CAPI)
 */

(function() {
  const CONFIG = {
    PIXEL_ID: '1438112951198337',
    SUPABASE_URL: 'https://ckwvvqqndafajlahngsh.supabase.co', // URL correta do projeto MegaPack
    TRACKER_FUNCTION: 'megapack-tracker'
  };

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  function generateEventId() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Recupera ou cria um event_id persistente para a sessão
  let eventId = localStorage.getItem('megapack_event_id');
  if (!eventId) {
    eventId = generateEventId();
    localStorage.setItem('megapack_event_id', eventId);
  }

  window.MegaTracker = {
    eventId: eventId,
    
    track: async function(eventName, customData = {}) {
      console.log(`[MegaTracker] Tracking: ${eventName}`, customData);

      // 1. Disparo via Pixel (Browser)
      if (window.fbq) {
        window.fbq('track', eventName, {
          ...customData,
          eventID: this.eventId
        });
      }

      // 2. Disparo via CAPI (Server Relay)
      try {
        const payload = {
          event_name: eventName,
          event_id: this.eventId,
          event_time: Math.floor(Date.now() / 1000),
          user_data: {
            client_ip_address: null, // O servidor pegará o IP
            client_user_agent: navigator.userAgent,
            fbp: getCookie('_fbp'),
            fbc: getCookie('_fbc')
          },
          custom_data: {
            currency: 'BRL',
            value: customData.value || 0,
            ...customData
          },
          source_url: window.location.href
        };

        fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${CONFIG.TRACKER_FUNCTION}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors' // Para não travar a UI se a função demorar
        });
      } catch (e) {
        console.error('[MegaTracker] CAPI Error:', e);
      }
    }
  };

  // Auto-track PageView se o Pixel ainda não disparou
  if (document.readyState === 'complete') {
    window.MegaTracker.track('PageView');
  } else {
    window.addEventListener('load', () => window.MegaTracker.track('PageView'));
  }

  // Interceptar cliques em botões de checkout
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('a');
    if (!btn) return;

    if (btn.href.includes('pay.celetus.com')) {
      const isPremium = btn.href.includes('NL9KO4PG') || btn.href.includes('PZL2DZN8');
      window.MegaTracker.track('InitiateCheckout', {
        content_name: isPremium ? 'MegaPack Premium' : 'MegaPack Basico',
        value: isPremium ? (btn.href.includes('PZL2DZN8') ? 10.99 : 15.99) : 5.99
      });
    } else if (btn.href.includes('upgrade.html')) {
      window.MegaTracker.track('InitiateCheckout', {
        content_name: 'Iniciou Fluxo Upgrade',
        value: 5.99
      });
    }
  });

})();
