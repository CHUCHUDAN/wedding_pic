import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 此端點現在用作 Vercel Blob「client upload」的 token 簽發 / 完成 callback。
// 真正寫入照片索引由前端在所有檔案上傳完成後呼叫 /api/admin/finalize 完成（原子寫一次）。
export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: '尚未設定 BLOB_READ_WRITE_TOKEN，請在 Vercel 專案 Storage 建立 Blob store。' },
      { status: 500 }
    );
  }
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname) => {
        // 進到這裡前，middleware 已驗過 cookie，所以可放心發 token
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/heic',
            'image/heif',
          ],
          addRandomSuffix: true,
          // 12 小時內可上傳；之後若被瀏覽器卡住會自動失效
          validUntil: Date.now() + 1000 * 60 * 60 * 12,
        };
      },
      // onUploadCompleted 在 Vercel 生產環境會用 webhook 觸發；
      // 為了本機開發與簡化流程，索引寫入改由前端呼叫 /api/admin/finalize 完成
      onUploadCompleted: async () => { /* noop */ },
    });
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload token failed' }, { status: 400 });
  }
}
