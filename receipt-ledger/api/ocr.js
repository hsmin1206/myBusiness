// Vercel Serverless Function
// POST { image: "<base64, no data: prefix>" } -> { text: "<raw OCR text>" }
//
// Google Cloud Vision API 키는 절대 클라이언트에 노출하지 않고
// 이 서버 함수 안에서만 사용합니다. Vercel 프로젝트 설정 >
// Environment Variables 에 GOOGLE_VISION_API_KEY 를 등록하세요.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' });
    return;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 GOOGLE_VISION_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: '이미지 데이터(base64)가 필요합니다.' });
      return;
    }

    // 혹시 클라이언트가 data URL 전체를 보낸 경우 prefix 제거
    const base64 = image.includes(',') ? image.split(',')[1] : image;

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['ko'] },
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error('Vision API error:', errText);
      res.status(502).json({ error: 'OCR 요청이 실패했습니다.', detail: errText });
      return;
    }

    const data = await visionRes.json();
    const text =
      data?.responses?.[0]?.fullTextAnnotation?.text ??
      data?.responses?.[0]?.textAnnotations?.[0]?.description ??
      '';

    if (data?.responses?.[0]?.error) {
      res.status(502).json({ error: data.responses[0].error.message || 'OCR 처리 오류' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
