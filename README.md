# 🌸 TUN TEA - Ứng Dụng Gom Order Trà Sữa & Cà Phê Mừng 20-10 🌸

Ứng dụng web thời gian thực (Real-time Collaborative Ordering App) phục vụ văn phòng, nhóm bạn đặt nước tại quán **TUN TEA (Dĩ An, Bình Dương)** nhân dịp Ngày Phụ Nữ Việt Nam 20-10.

---

## 🌟 Tính Năng Nổi Bật

1. **Thực Đơn Đầy Đủ Quán TUN TEA**:
   - Cà Phê (Đen, Sữa, Cà phê muối, Sữa tươi, Bạc xỉu - Size M & L).
   - Trà Sữa 700ml (Truyền thống, Matcha, Socola, Kem muối, Cheese ball...).
   - Sữa Tươi 700ml (Matcha latte, Cacao latte, Sữa hồng, Đác rim, Đường đen...).
   - Trà Trái Cây 700ml (Trà đào cam sả, Trà mãng cầu, Trà ngũ vị, Hibiscus, Lucky tea...).
   - Nước Ép 700ml, Sữa Chua 700ml, Món Khác & Bánh Flan.
   - 13 loại Topping tùy chọn kèm giá rõ ràng.

2. **Tùy Chỉnh Thức Uống Đa Dạng**:
   - Chọn Size (M / L).
   - Chọn lượng đường (%: 100%, 70%, 50%, 30%, 0%).
   - Chọn lượng đá (100%, 70%, 50%, Không đá, Uống nóng).
   - Chọn Topping đa lựa chọn.
   - Gửi kèm lời chúc 20-10 ngọt ngào và phân loại giới tính (🌸 Phái đẹp / 🧔 Cánh mày râu).

3. **Đồng Bộ Thời Gian Thực (Real-time SSE)**:
   - Khi có bất kỳ ai đặt món hoặc sửa/xóa món, toàn bộ màn hình của mọi người (điện thoại, máy tính) cập nhật tức thì không cần tải lại trang.

4. **Theo Dõi Khuyến Mãi Quán TUN TEA Tự Động**:
   - Thanh tiến trình ưu đãi: **Đơn 10 ly TẶNG 1 LY** (tự động đếm số ly được tặng).
   - Đơn trên 3 ly: Tự động báo **Đạt điều kiện FREESHIP <2km**.

5. **Bảng Điều Khiển Chốt Đơn Cho Host (Chủ Xị)**:
   - **Tự động tổng hợp danh sách pha chế**: Gom các món cùng loại lại để quán làm nhanh nhất (VD: *3x Cà phê muối L: 2 ly 50% đường ít đá, 1 ly chuẩn vị*).
   - **1-Click "Sao chép đơn gửi Zalo cho Tun Tea"**: Sinh sẵn đoạn tin nhắn mẫu chuẩn chỉnh đầy đủ chi tiết, địa chỉ, tổng tiền để dán vào Zalo.
   - **Nút mở chat Zalo trực tiếp**: `https://zalo.me/0975270399` (Hotline quán).
   - **Mã VietQR thanh toán Vietcombank**: Tự động tạo mã QR quét chuyển khoản vào tài khoản quán `0411001079352` (NGUYEN THANH TUAN) kèm chính xác số tiền.
   - **Chia tiền linh hoạt (Split Bill)**:
     - 🌸 *Cánh mày râu bao phái đẹp*: Tự động miễn phí cho các chị em, chia đều tiền cho các bạn nam!
     - 🎉 *Bao toàn bộ*: Công ty / Mạnh thường quân tài trợ.
     - ⚖️ *Tự túc*: Tự tính đúng số tiền từng người đã đặt.
   - **Khóa Order (Chốt sổ)**: Ngăn không cho thêm bớt món khi đã chốt giờ gửi quán.
   - **Xuất Excel (CSV)** & **In phiếu order**.

6. **Chia Sẻ Nhanh Bằng Mã QR & Link**:
   - Nhấn nút **"Chia sẻ QR / Link"** để mở mã QR và link LAN (`http://10.18.12.81:3000`). Mọi người chỉ cần mở camera điện thoại quét mã là vào đặt món ngay.

---

## 🚀 Hướng Dẫn Khởi Động

### Cách 1: Chạy bằng file `start.bat` (Khuyên dùng trên Windows)
- Nhấp đúp chuột vào file `start.bat` trong thư mục dự án.

### Cách 2: Chạy bằng dòng lệnh Terminal
```bash
npm start
```

---

## 📱 Đường Dẫn Truy Cập
- **Trên máy tính của bạn**: `http://localhost:3000`
- **Gửi cho đồng nghiệp trong cùng mạng Wi-Fi/LAN**: `http://10.18.12.81:3000`
