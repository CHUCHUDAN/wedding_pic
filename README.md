# 💍 婚紗照片網站 Wedding Gallery

一個優雅、極簡的婚紗照片網站，採用 Next.js 14 + Vercel Blob，含密碼保護的後台（上傳 / 刪除 / 拖曳排序）與分頁式相簿（每頁 10 張、點擊可彈出放大）。

---

## ✨ 功能

- **公開頁面**：以每頁 10 張、5×2 的小圖陳列，hover 微動、點擊燈箱放大（鍵盤 ← → ESC 操作）
- **後台 `/admin`**：密碼登入後可
  - 拖曳/點選上傳照片（支援多檔）
  - 刪除任一張
  - 拖曳卡片重新排序（即時儲存）
- **儲存**：圖片與排序索引皆存在 **Vercel Blob**（免費額度足夠個人婚紗用）
- **風格**：米白底 + Cormorant Garamond / Noto Serif TC 襯線字

---

## 🚀 部署（Vercel，5 分鐘上線）

### 1. 把專案推上 GitHub

```powershell
cd "C:\Users\wits.danielchu\Desktop\wedding_pic"
git init
git add .
git commit -m "init: wedding gallery"
# 到 github.com 建立新 repo 後：
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo>.git
git push -u origin main
```

### 2. 在 Vercel 匯入專案

1. 前往 https://vercel.com/new ，選擇剛剛的 repo → **Deploy**（用預設值即可，Vercel 會自動偵測 Next.js）。
2. 第一次 Deploy 完成後，到專案的 **Storage** 分頁 → **Create Database** → 選 **Blob** → **Continue** → **Create**。
3. 建好後 Vercel 會自動把 `BLOB_READ_WRITE_TOKEN` 注入到專案環境變數，**不需要手動填**。

### 3. 設定密碼與簽章金鑰

到專案 **Settings → Environment Variables**，新增：

| Key | Value | 環境 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 你自己取的後台密碼（請夠強） | Production / Preview / Development |
| `AUTH_SECRET` | 任何一串很長的亂碼（例：`openssl rand -hex 32` 產生） | Production / Preview / Development |

存好後到 **Deployments** → 最新一筆 → **Redeploy**（讓環境變數生效）。

### 4. 完成！

- 公開相簿：`https://<你的專案>.vercel.app/`
- 後台：`https://<你的專案>.vercel.app/admin` → 輸入 `ADMIN_PASSWORD`

要綁定自己的網域，到 **Settings → Domains** 加入即可。

---

## 🧑‍💻 本地開發

```powershell
cd "C:\Users\wits.danielchu\Desktop\wedding_pic"
pnpm install   # 或 npm install
Copy-Item .env.example .env.local
# 編輯 .env.local，填入：
#   ADMIN_PASSWORD=任意密碼
#   AUTH_SECRET=任意亂碼
#   BLOB_READ_WRITE_TOKEN=（Vercel 專案 Storage 頁的 ".env.local" 區可複製）
pnpm dev       # 或 npm run dev
```

打開 http://localhost:3000 ， 後台在 http://localhost:3000/admin

> 💡 若還不想接 Vercel Blob，沒填 `BLOB_READ_WRITE_TOKEN` 也可以啟動，只是上傳會失敗。

---

## 🗂 結構

```
src/
  app/
    page.tsx                  公開首頁（分頁＋燈箱）
    layout.tsx, globals.css   全站樣式
    admin/
      login/page.tsx          密碼登入
      page.tsx                後台主頁（伺服端撈資料）
    api/
      admin/
        login/route.ts        驗證密碼 → 簽 Cookie
        logout/route.ts
        upload/route.ts       簽發 Vercel Blob client upload token
        finalize/route.ts     client upload 完成後一次寫入照片索引（原子）
        delete/route.ts
        reorder/route.ts
  components/
    Gallery.tsx               前台網格＋燈箱
    AdminClient.tsx           後台 UI（上傳/刪除/拖曳排序）
  lib/
    auth.ts                   HMAC 簽 Cookie
    store.ts                  Blob 讀寫 + photos.json 索引
  middleware.ts               擋 /admin 與 /api/admin
```

照片索引（順序）儲存在 Blob 的 `index/photos.json`；圖片本體存在 `photos/<id>.<ext>`。

---

## 🔐 安全備註

- 後台採「單一密碼 + 簽章 Cookie」設計，最簡單但已足夠把陌生人擋在門外。請務必：
  - 設一組**強密碼**（12+ 字、混合英數符號）
  - `AUTH_SECRET` 不要外流；外流時請更換並重新部署，會自動讓所有舊登入失效
- 上傳的圖片網址是 Vercel Blob 的「公開」連結（任何知道網址者可看）。這對於婚紗分享通常是想要的；如需私密請另外加上短連結或密碼。
