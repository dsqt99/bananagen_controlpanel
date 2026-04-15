# Banana Gen - Control Panel

Control panel cho việc quản lý pipeline tạo ảnh với Banana Gen AI.

## Tổng quan

Ứng dụng web cho phép quản lý quy trình tạo và biến đổi ảnh qua 6 bước (steps) sử dụng Gemini AI models. Dữ liệu được lưu trữ và đồng bộ với Supabase.

## Công nghệ sử dụng

- **Frontend**: Vanilla JavaScript + Vite
- **Database**: Supabase
- **AI Models**: Google Gemini (2.5-flash-image, 3.1-flash-image-preview)
- **Workflow**: n8n integration

## Cài đặt

### Yêu cầu

- Node.js (v16 trở lên)
- npm hoặc yarn
- Tài khoản Supabase
- Gemini API key

### Các bước cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd control_panel
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` và cấu hình các biến môi trường:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_N8N_DOMAIN=your_n8n_domain
VITE_GEMINI_API_KEY=your_gemini_api_key
```

4. Chạy development server:
```bash
npm run dev
```

5. Build cho production:
```bash
npm run build
```

## Cấu trúc dự án

```
control_panel/
├── src/
│   ├── main.js          # Logic chính của ứng dụng
│   ├── styles.css       # Styles
│   └── supabase.js      # Supabase client config
├── index.html           # HTML template
├── package.json
├── vite.config.js
└── .env                 # Environment variables
```

## Hướng dẫn sử dụng

### 1. Khởi tạo ảnh mới

- Nhập **Tên Ảnh** (Image Name) vào ô input ở header
- Hệ thống sẽ tự động kiểm tra trùng lặp với database
- Chọn **Model** muốn sử dụng (Nano Banana hoặc Nano Banana 2)

### 2. Pipeline Steps

Ứng dụng có 6 steps để xử lý ảnh:

#### Step 1 - Khởi tạo (Bắt buộc)
- **Input URL**: URL ảnh gốc (bắt buộc)
- **Prompt**: Mô tả yêu cầu biến đổi (bắt buộc)
- **Reference URL**: URL ảnh tham khảo (tùy chọn)
- Click **Run** để thực thi

#### Step 2-5 - Biến đổi/Tinh chỉnh/Nâng cấp/Hoàn thiện (Tùy chọn)
- **Auto Input**: Tự động lấy output từ step trước làm input
- Có thể nhập input URL thủ công nếu muốn
- Nhập prompt và reference URL nếu cần
- Click **Run** để thực thi

#### Step 6 - Tùy chỉnh (Tùy chọn)
- Cho phép tạo 7 biến thể (a-g) từ cùng 1 input
- Mỗi biến thể có prompt riêng
- Click **Run All** để chạy tất cả hoặc **Run** từng biến thể

### 3. Quản lý dữ liệu

- Xem danh sách tất cả ảnh đã xử lý trong bảng **Dữ liệu Supabase**
- Click **Refresh** để cập nhật dữ liệu mới nhất
- Click vào từng row để load dữ liệu vào pipeline và chỉnh sửa

### 4. Lưu và cập nhật

- Click **Save to Supabase** để lưu/cập nhật dữ liệu
- Hệ thống tự động kiểm tra:
  - Tên ảnh không được trống
  - Step 1 phải có output_url
  - Không trùng tên với ảnh khác (khi tạo mới)

## Tính năng chính

- ✅ Real-time connection status với Supabase
- ✅ Auto-fill input từ output của step trước
- ✅ Kiểm tra trùng lặp tên ảnh
- ✅ Progress tracking cho pipeline
- ✅ Toast notifications cho các actions
- ✅ Expand/collapse steps
- ✅ Load và edit dữ liệu có sẵn
- ✅ Responsive UI

## Supabase Schema

Table: `banana_gen_images`

```sql
{
  image_name: string (unique),
  model_id: string,
  run_1: {
    input_url: string,
    prompt: string,
    ref_url: string,
    output_url: string
  },
  run_2: { ... },
  run_3: { ... },
  run_4: { ... },
  run_5: { ... },
  run_6: {
    input_url: string,
    ref_url: string,
    prompts6: { a, b, c, d, e, f, g },
    outputs6: { a, b, c, d, e, f, g }
  },
  created_at: timestamp,
  updated_at: timestamp
}
```

## Scripts

```bash
npm run dev      # Chạy development server
npm run build    # Build production
npm run preview  # Preview production build
```

## Lưu ý

- Đảm bảo Supabase table đã được tạo với đúng schema
- Gemini API key cần có quyền truy cập image generation
- n8n domain phải accessible từ client
- Không commit file `.env` lên git

## Troubleshooting

### Không kết nối được Supabase
- Kiểm tra `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`
- Kiểm tra network và firewall

### Run step không hoạt động
- Kiểm tra `VITE_N8N_DOMAIN` và `VITE_GEMINI_API_KEY`
- Xem console log để debug

### Lỗi duplicate image name
- Tên ảnh đã tồn tại trong database
- Đổi tên hoặc load ảnh cũ để edit

## License

MIT
