# Contributing

Mọi đóng góp phải đi kèm kiểm thử, mô tả thay đổi API và xác nhận không sử dụng dữ liệu công dân thật.

1. Tạo issue có cách tái hiện lỗi/đề xuất, không chứa PII.
2. Tạo nhánh; sửa mã trong `core/`, `apps/` hoặc `packs/` theo đúng phạm vi.
3. `make test` cho backend; `npm run build` trong `apps/commune` cho frontend; khi thay RLS phải chạy integration test PostgreSQL.
4. Cập nhật `docs/FEATURE_MATRIX.md` nếu chức năng thực sự được bổ sung và có bằng chứng.
5. Kiểm tra giấy phép của mọi phụ thuộc mới, không nhập tệp không rõ nguồn/bản quyền.

Các thay đổi xác thực, luồng xử lý, RLS, S3 và sổ cái cần được code-review chuyên biệt trước khi merge.
