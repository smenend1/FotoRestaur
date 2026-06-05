document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d');
  const processBtn = document.getElementById('process-btn');
  const downloadBtn = document.getElementById('download-btn');
  const emptyState = document.getElementById('empty-state');
  const loadingOverlay = document.getElementById('loading-overlay');
  const connectionStatus = document.getElementById('connection-status');
  const fileInput = document.getElementById('image-input');

  let currentBase64 = null;

  // REEMPLAZAR ESTA URL CON TU URL REAL DE VERCEL CUANDO HAGAS EL DEPLOY
  const VERCEL_BACKEND_URL = "https://TU_PROYECTO_DE_VERCEL.vercel.app/api/process-image";

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      currentBase64 = reader.result;
      
      const img = new Image();
      img.onload = () => {
        emptyState.classList.add('hidden');
        canvas.classList.remove('hidden');
        
        const targetResolutionLimit = 1024;
        let finalWidth = img.width;
        let finalHeight = img.height;

        if (finalWidth > targetResolutionLimit || finalHeight > targetResolutionLimit) {
          if (finalWidth > finalHeight) {
            finalHeight = Math.round((finalHeight * targetResolutionLimit) / finalWidth);
            finalWidth = targetResolutionLimit;
          } else {
            finalWidth = Math.round((finalWidth * targetResolutionLimit) / finalHeight);
            finalHeight = targetResolutionLimit;
          }
        }

        canvas.width = finalWidth;
        canvas.height = finalHeight;
        ctx.clearRect(0, 0, finalWidth, finalHeight);
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        
        processBtn.disabled = false;
        downloadBtn.disabled = true;
      };
      img.src = currentBase64;
    };
    reader.readAsDataURL(file);
  });

  processBtn.addEventListener('click', async () => {
    if (!currentBase64) return;

    loadingOverlay.classList.remove('hidden');
    processBtn.disabled = true;

    try {
      const networkResponse = await fetch(VERCEL_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: currentBase64 })
      });

      if (!networkResponse.ok) {
        const errorPayload = await networkResponse.json();
        throw new Error(errorPayload.error || 'Error en el servidor proxy de Vercel.');
      }

      const payloadData = await networkResponse.json();

      if (payloadData.processedImageUrl) {
        const remoteImage = new Image();
        remoteImage.crossOrigin = "anonymous"; 
        remoteImage.onload = () => {
          canvas.width = remoteImage.width;
          canvas.height = remoteImage.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(remoteImage, 0, 0);
          
          loadingOverlay.classList.add('hidden');
          downloadBtn.disabled = false; 
        };
        remoteImage.src = payloadData.processedImageUrl;
      } else {
        throw new Error('La respuesta no contiene una URL válida.');
      }

    } catch (error) {
      loadingOverlay.classList.add('hidden');
      processBtn.disabled = false;
      alert("Error al procesar la imagen: " + error.message);
    }
  });

  downloadBtn.addEventListener('click', () => {
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.download = `studio_cinematic_${Date.now()}.jpg`;
      downloadAnchor.href = dataUrl;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
    } catch (exportError) {
      alert("Error al exportar el archivo: " + exportError.message);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker activo: ', reg.scope))
        .catch(err => console.error('Fallo de SW: ', err));
    });
  }

  const updateNetworkInterfaceStatus = () => {
    if (navigator.onLine) {
      connectionStatus.textContent = "Online";
      connectionStatus.className = "status-badge status-online";
      if (currentBase64) processBtn.disabled = false;
    } else {
      connectionStatus.textContent = "Offline";
      connectionStatus.className = "status-badge status-offline";
      processBtn.disabled = true;
    }
  };
  window.addEventListener('online', updateNetworkInterfaceStatus);
  window.addEventListener('offline', updateNetworkInterfaceStatus);
  updateNetworkInterfaceStatus();
});
