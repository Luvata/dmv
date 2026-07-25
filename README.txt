ÔN THI DMV CALIFORNIA BẰNG TIẾNG VIỆT

PHIÊN BẢN

Xác minh nội dung: 2026-07-22
Sổ tay nền: DL 600 tiếng Việt, Revision 6/2025
Quy mô: 252 facts trọng tâm, 261 câu hỏi, 15 phần

CÁCH MỞ

Cách đơn giản nhất:
1. Giải nén toàn bộ thư mục.
2. Mở file index.html bằng Chrome, Edge, Firefox hoặc Safari.
3. Không di chuyển riêng index.html ra khỏi thư mục vì website cần app.js, data.js, styles.css và thư mục assets.

Cách mở bằng máy chủ cục bộ, phù hợp khi trình duyệt hạn chế file cục bộ:
1. Mở Terminal hoặc Command Prompt tại thư mục này.
2. Chạy: python -m http.server 8000
3. Truy cập localhost cổng 8000 trong trình duyệt.

TÍNH NĂNG

• Chọn từng phần để đọc facts, xem toàn văn trang nguồn, xem hình và luyện câu hỏi.
• Chế độ luyện thông minh, câu đến hạn, câu chưa học, câu từng làm sai, câu ngẫu nhiên và câu đã đánh dấu.
• Lặp lại ngắt quãng theo bốn mức Quên, Khó, Đúng và Dễ.
• Thi mô phỏng 10, 20, 36 hoặc 46 câu. Có 20 bộ đề cố định và chế độ tạo đề ngẫu nhiên.
• Kết quả chỉ hiện sau khi nộp bài trong chế độ thi. Có đồng hồ, bảng số câu, cờ đánh dấu và xem lại lời giải.
• Thống kê theo phần, lịch sử thi và tiến độ ôn.
• Tìm kiếm toàn bộ facts và câu hỏi.
• Xuất và nhập tiến độ bằng JSON. Dữ liệu học được lưu trong localStorage của trình duyệt.
• Chạy hoàn toàn tĩnh, không gửi tiến độ học lên máy chủ.

CÁCH HỌC ĐỀ XUẤT

1. Vào từng phần, đọc facts mức Cần nhớ trước.
2. Luyện từng phần ở chế độ Câu chưa học cho đến khi hết câu mới.
3. Mỗi ngày mở Ôn đến hạn và chấm đúng cảm nhận bằng Quên, Khó, Đúng hoặc Dễ.
4. Khi mỗi phần đạt ít nhất 80 phần trăm, chuyển sang thi mô phỏng 36 hoặc 46 câu.
5. Sau mỗi đề, vào chế độ Câu từng làm sai để sửa điểm yếu.
6. Trước ngày thi, làm nhiều đề liên tiếp và chỉ dừng khi điểm ổn định trên 85 phần trăm.

KIỂM SOÁT ĐỘ CHÍNH XÁC

• Mỗi câu có giải thích và số trang hoặc nguồn DMV web.
• Toàn văn 86 trang nội dung liên quan được nhúng theo từng phần để đối chiếu.
• Bản PDF tiếng Việt gốc nằm tại assets/so-tay-dmv-california-tieng-viet-2025.pdf.
• Điểm khác biệt giữa bản dịch và nguồn tiếng Anh chính thức được ghi trong mục Nguồn và hiệu chỉnh của website.
• Khoảng cách theo sau xe mô tô được hiệu chỉnh thành ít nhất 3 giây theo bản tiếng Anh chính thức.
• Quy tắc ghế trẻ em được đối chiếu thêm với Vehicle Code §27360, §27363 và hướng dẫn CHP để loại bỏ cách diễn đạt chồng lấn trong sổ tay hiện hành.
• Vấn đề thông báo gia hạn cho người từ 70 tuổi có hai trang DMV hiện hành ghi 60 và 90 ngày. Chi tiết này không được dùng làm câu tính điểm.
• Luật California năm 2026 được tách thành Phần 15.

GIỚI HẠN

DMV có thể thay đổi luật, quy trình, số câu và cách phân phối câu hỏi. Website không phải sản phẩm chính thức của DMV và không bảo đảm bạn sẽ gặp đúng các câu này trong bài thi. Mục tiêu là giúp bạn nắm chắc kiến thức công khai trong sổ tay và các cập nhật DMV hiện hành.

FILE HỮU ÍCH

• facts-by-chapter.md: toàn bộ 252 facts theo phần.
• question-bank.json: toàn bộ 261 câu hỏi, đáp án và lời giải ở định dạng JSON.
• qa-data-validation.json: kết quả kiểm tra cấu trúc dữ liệu.
• qa-browser-smoke.json: kết quả kiểm thử các luồng học và thi trên trình duyệt.
• QA_REPORT.txt: tóm tắt kiểm soát chất lượng.
• ATTRIBUTION.txt: nguồn và giấy phép.
