export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no válido. Usa POST.' });

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Falta la imagen.' });

    const FAL_KEY = process.env.IMAGE_IA_API_KEY;
    if (!FAL_KEY) return res.status(500).json({ error: 'Clave API faltante en el backend.' });

    const promptText = "Apply a warm, cinematic music-video style with strong golden backlighting (rim light) behind the subject, creating a soft halo on hair and shoulders. Keep the face clearly and evenly lit with soft frontal light. Use a shallow depth of field with a blurred background and rich amber/gold tones for a moody atmosphere. Preserve the subject's original features, pose, outfit, background, and gender exactly. Enhance sharpness and skin detail with a realistic upscale, maintaining natural outdoor daylight and proper exposure.";

    const response = await fetch("https://queue.fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: imageBase64,
        prompt: promptText,
        strength: 0.42, // Repara las manos/movimientos manteniendo tus rasgos exactos
        guidance_scale: 7.5,
        num_inference_steps: 30,
        enable_safety_checker: true,
        sync_mode: false
      })
    });

    if (!response.ok) {
      const errPayload = await response.json();
      return res.status(response.status).json({ error: errPayload.detail || 'Fallo en los nodos de Fal.ai.' });
    }

    const queueData = await response.json();
    let statusUrl = queueData.status_url;
    let executionResult = queueData;

    if (statusUrl) {
      let loops = 0;
      while ((executionResult.status === "IN_QUEUE" || executionResult.status === "IN_PROGRESS") && loops < 45) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const poolResponse = await fetch(statusUrl, { headers: { "Authorization": `Key ${FAL_KEY}` } });
        executionResult = await poolResponse.json();
        loops++;
      }
    }

    let deliveryUrl = null;
    if (executionResult.image && executionResult.image.url) {
      deliveryUrl = executionResult.image.url;
    } else if (executionResult.images && executionResult.images[0] && executionResult.images[0].url) {
      deliveryUrl = executionResult.images[0].url;
    }

    if (!deliveryUrl) return res.status(500).json({ error: 'La IA no devolvió la imagen a tiempo.' });

    return res.status(200).json({ processedImageUrl: deliveryUrl });

  } catch (error) {
    return res.status(500).json({ error: 'Fallo crítico del backend: ' + error.message });
  }
}
