# SPDX-License-Identifier: Apache-2.0
"""Trace each requirement in the user-supplied 60-feature document."""
import csv,re
from pathlib import Path
from docx import Document
BASE=Path(__file__).resolve().parents[1]
doc=Document(BASE/'docs/CommuneOS_60_chuc_nang.docx')
found={}
for p in doc.paragraphs:
    text=p.text.strip()
    match=re.match(r'^([HPDI]\d{2})\s+\(gốc\s+#\d+\)\s+(.+)$',text)
    if match:found[match[1]]=match[2].strip().rstrip('.')
assert len(found)==60,('Expected 60 feature headers',len(found))
implemented={
 'H03':'Kho wiki từ gói thủ tục; tra cứu trong giao diện','H07':'API tạo/xem lịch hẹn','H09':'Gửi đánh giá, báo cáo tổng hợp',
 'P01':'Tạo/truy xuất hồ sơ điện tử theo quyền','P02':'JSON Schema + checklist bắt buộc, HTTP 422','P14':'Hồ sơ ghim mã và phiên bản gói',
 'D01':'PostgreSQL/SQLite + S3/local object store','D03':'Dashboard xã theo trạng thái và hạn','D04':'API thống kê liên xã không PII',
 'D05':'Nhật ký sự kiện, SHA-256 ledger và API verify'
}
partial={
 'H01':'Có cấu hình Keycloak OIDC/JWKS; chưa kiểm thử E2E','H02':'Chuyển nhiệm vụ theo vai và trạng thái; không có thuật toán cân tải',
 'H04':'CRUD tạo/khóa tenant; chưa quản lý tài khoản Keycloak qua UI','H08':'Lấy/gọi số thứ tự; chưa ước lượng chờ',
 'H10':'Giao diện responsive và nhãn; chưa kiểm thử WCAG',
 'P03':'Máy trạng thái chạy; adapter Flowable REST tùy chọn, chưa nghiệm thu BPMN/DMN',
 'P04':'Hạn mẫu và cảnh báo quá hạn; chưa có SLA lịch hành chính',
 'P05':'Yêu cầu và bổ sung tệp, ghi sự kiện; chưa hỗ trợ sửa từng trường có phiên bản',
 'P06':'Nạp pack ZIP và sinh biểu mẫu; chưa kiểm định toàn bộ BPMN/DMN',
 'P07':'FastAPI/OpenAPI; chưa hoàn tất adapter hệ thống ngoài',
 'P08':'Nộp online trong môi trường demo; kênh công khai mặc định tắt',
 'P11':'Thông báo trong dashboard; chưa email/escalation',
 'P20':'CI chạy unit test & build frontend; chưa quét bảo mật/license đầy đủ',
 'P21':'Kiểm tra cấu trúc/JSON Schema/ZIP; chưa phê duyệt/rollback gói',
 'D02':'Migrations RLS PostgreSQL + middleware tenant; kiểm thử PG integration cần Docker',
 'D06':'Phiên bản tài liệu; thiếu so sánh biểu mẫu',
 'D07':'Tìm theo mã/tên/trạng thái; chưa full text index',
 'D08':'Kiểm JSON Schema ở đầu vào; chưa dashboard chất lượng',
 'D12':'Xuất CSV thống kê đã loại PII; chưa có mẫu phân quyền phong phú',
 'D15':'Tệp có SHA-256, phiên bản và kiểm lúc tải; chưa quy trình đối chiếu định kỳ',
 'D16':'Trang trạng thái cấu hình; chưa đo uptime/độ trễ',
 'D17':'Lệnh pg_dump; chưa tự động sao lưu object store/restore drill',
 'D18':'Compose cục bộ; chưa kiểm tra máy sạch/offline image preload',
 'I02':'Tra cứu trích đoạn wiki có nguồn; chưa embedding/LLM RAG',
 'I03':'Dùng lại tìm kiếm wiki demo; chưa trợ lý chuyên biệt cho công dân',
 'I07':'Gợi ý trích đoạn wiki; chưa so khớp ngữ nghĩa phức tạp'
}
lines=['# Ma trận thực hiện 60 chức năng CommuneOS','',
 'Nguồn: `docs/CommuneOS_60_chuc_nang.docx` (danh mục đề xuất). Đây là **bảng đối soát mã nguồn**, không phải biên bản nghiệm thu.','',
 '| ID | Chức năng trong tài liệu | Trạng thái | Bằng chứng hoặc phần còn thiếu |','|---|---|---|---|']
rows=[]
for key in sorted(found, key=lambda x:'HPDI'.index(x[0])*100+int(x[1:])):
    if key in implemented:state='Có mã nguồn (cần nghiệm thu)';detail=implemented[key]
    elif key in partial:state='Một phần';detail=partial[key]
    else:state='Chưa triển khai';detail='Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog.'
    rows.append((key,found[key],state,detail))
    lines.append('| '+' | '.join(v.replace('|','/') for v in rows[-1])+' |')
counts={'Có mã nguồn (cần nghiệm thu)':len(implemented),'Một phần':len(partial),'Chưa triển khai':60-len(implemented)-len(partial)}
lines += ['',f"**Tổng:** {counts['Có mã nguồn (cần nghiệm thu)']} hạng mục có mã nguồn · {counts['Một phần']} hạng mục một phần · {counts['Chưa triển khai']} hạng mục chưa triển khai.", '',
 'Chú ý: Một tính năng có mã nguồn chỉ có nghĩa là có triển khai cơ bản; không đồng nghĩa đã sẵn sàng đưa vào phục vụ hành chính thật.']
(BASE/'docs/FEATURE_MATRIX.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
with (BASE/'docs/FEATURE_MATRIX.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['ID','Tên chức năng','Trạng thái','Ghi chú']);w.writerows(rows)
print(counts)
