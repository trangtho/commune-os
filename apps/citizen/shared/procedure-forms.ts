// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Configurable business-information capture for the six sample procedures.
// NOT an official government form. Source-of-truth templates must be approved by the service owner.
import { phoneIssue, emailIssue, identityIssue } from './identity-validation.ts'
export type ProcedureFieldType = 'text' | 'textarea' | 'date' | 'select' | 'number' | 'tel' | 'email' | 'citizenId'
export interface ProcedureFormField {
  key: string
  label: string
  type: ProcedureFieldType
  required?: boolean
  maxLength?: number
  minLength?: number
  placeholder?: string
  help?: string
  options?: string[]
  min?: number
  max?: number
  /** A field becomes required only if another field equals a specific value. */
  requiredWhen?: { field: string; equals: string }
}
export interface FormFieldIssue { key: string; message: string }
const forms: Record<string, ProcedureFormField[]> = {
  'khai-sinh': [
    { key: 'childName', label: 'Họ, chữ đệm và tên trẻ', type: 'text', required: true, minLength: 2, maxLength: 100 },
    { key: 'birthDate', label: 'Ngày, tháng, năm sinh', type: 'date', required: true },
    { key: 'gender', label: 'Giới tính', type: 'select', required: true, options: ['Nam', 'Nữ', 'Khác'] },
    { key: 'birthPlace', label: 'Nơi sinh', type: 'textarea', required: true, maxLength: 250 },
    { key: 'birthProvince', label: 'Tỉnh/thành phố nơi sinh', type: 'text', required: true, maxLength: 100 },
    { key: 'fatherName', label: 'Họ và tên cha (nếu có)', type: 'text', maxLength: 100 },
    { key: 'motherName', label: 'Họ và tên mẹ', type: 'text', required: true, maxLength: 100 },
    { key: 'motherId', label: 'Số định danh cá nhân của mẹ (nếu có)', type: 'citizenId' },
    { key: 'registrationRelation', label: 'Quan hệ người khai với trẻ', type: 'select', required: true, options: ['Cha', 'Mẹ', 'Người giám hộ', 'Người khác'] }
  ],
  'ho-kinh-doanh': [
    { key: 'businessName', label: 'Tên hộ kinh doanh dự kiến', type: 'text', required: true, minLength: 3, maxLength: 150 },
    { key: 'businessAddress', label: 'Địa điểm kinh doanh', type: 'textarea', required: true, minLength: 6, maxLength: 300 },
    { key: 'businessSector', label: 'Ngành, nghề dự kiến', type: 'textarea', required: true, maxLength: 300 },
    { key: 'businessOwner', label: 'Người đại diện hộ kinh doanh', type: 'text', required: true, maxLength: 100 },
    { key: 'ownerIdentifier', label: 'Số định danh cá nhân người đại diện', type: 'citizenId', required: true },
    { key: 'ownerPhone', label: 'Điện thoại liên hệ', type: 'tel', required: true },
    { key: 'businessCapital', label: 'Vốn kinh doanh dự kiến (VNĐ)', type: 'number', required: true, min: 1, max: 1000000000000 },
    { key: 'employeeCount', label: 'Số lao động dự kiến', type: 'number', required: true, min: 0, max: 9999 }
  ],
  'xac-nhan-cu-tru': [
    { key: 'residenceType', label: 'Loại thông tin cần xác nhận', type: 'select', required: true, options: ['Thường trú', 'Tạm trú', 'Thông tin cư trú khác'] },
    { key: 'residenceAddress', label: 'Địa chỉ cư trú đề nghị xác nhận', type: 'textarea', required: true, minLength: 6, maxLength: 300 },
    { key: 'confirmationPurpose', label: 'Mục đích đề nghị', type: 'textarea', required: true, minLength: 5, maxLength: 300 },
    { key: 'subjectName', label: 'Người đề nghị xác nhận', type: 'text', required: true, maxLength: 100 },
    { key: 'subjectIdentifier', label: 'Số định danh người đề nghị', type: 'citizenId', required: true },
    { key: 'requestedPeriod', label: 'Khoảng thời gian cần xác nhận (nếu có)', type: 'text', maxLength: 100 }
  ],
  'chung-thuc': [
    { key: 'documentType', label: 'Loại giấy tờ cần chứng thực', type: 'text', required: true, maxLength: 150 },
    { key: 'copyCount', label: 'Số bản cần chứng thực', type: 'number', required: true, min: 1, max: 20, help: 'Từ 1 đến 20 bản' },
    { key: 'certificationType', label: 'Nội dung đề nghị', type: 'select', required: true, options: ['Chứng thực bản sao từ bản chính', 'Chứng thực chữ ký'] },
    { key: 'documentOwner', label: 'Người đứng tên trên giấy tờ', type: 'text', required: true, maxLength: 100 },
    { key: 'certificationPurpose', label: 'Mục đích sử dụng', type: 'textarea', maxLength: 250 }
  ],
  'ket-hon': [
    { key: 'spouseName', label: 'Họ và tên người còn lại', type: 'text', required: true, minLength: 2, maxLength: 100 },
    { key: 'spouseBirthDate', label: 'Ngày sinh người còn lại', type: 'date', required: true },
    { key: 'marriageLocation', label: 'Nơi dự kiến đăng ký kết hôn', type: 'text', required: true, maxLength: 200 },
    { key: 'spouseIdentifier', label: 'Số định danh người còn lại', type: 'citizenId', required: true },
    { key: 'applicantBirthDate', label: 'Ngày sinh người nộp', type: 'date', required: true },
    { key: 'maritalStatus', label: 'Tình trạng hôn nhân hiện tại', type: 'select', required: true, options: ['Chưa từng kết hôn', 'Đã ly hôn', 'Vợ/chồng đã mất'] }
  ],
  'dat-dai': [
    { key: 'parcelLocation', label: 'Địa chỉ hoặc vị trí đất', type: 'textarea', required: true, minLength: 6, maxLength: 300 },
    { key: 'requestContent', label: 'Nội dung đề nghị', type: 'textarea', required: true, minLength: 8, maxLength: 400 },
    { key: 'parcelNumber', label: 'Số thửa đất (nếu biết)', type: 'text', maxLength: 50 },
    { key: 'mapSheet', label: 'Số tờ bản đồ (nếu biết)', type: 'text', maxLength: 50 },
    { key: 'landArea', label: 'Diện tích đất đề nghị (m²)', type: 'number', min: 1, max: 1000000000 },
    { key: 'ownerName', label: 'Người đứng tên giấy tờ về đất', type: 'text', required: true, maxLength: 100 }
  ]
}
const fallback: ProcedureFormField[] = [
  { key: 'subject', label: 'Nội dung / đối tượng thủ tục', type: 'textarea', required: true, minLength: 8, maxLength: 400 }
]
export function getProcedureFormFields(procedureId: string): ProcedureFormField[] { return forms[procedureId] ?? fallback }
function validDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const d = new Date(input + 'T00:00:00.000Z')
  const now = new Date()
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === input && input <= now.toISOString().slice(0, 10) && input >= '1900-01-01'
}
export function validateProcedureForm(procedureId: string, value: Record<string, unknown>): FormFieldIssue[] {
  const issues: FormFieldIssue[] = []
  for (const field of getProcedureFormFields(procedureId)) {
    const raw = value[field.key]
    const text = typeof raw === 'string' ? raw.trim() : ''
    const required = field.required || (field.requiredWhen && value[field.requiredWhen.field] === field.requiredWhen.equals)
    if (required && !text) { issues.push({ key: field.key, message: `${field.label}: không được để trống` }); continue }
    if (!text) continue
    if (field.minLength && text.length < field.minLength) issues.push({ key: field.key, message: `${field.label}: ít nhất ${field.minLength} ký tự` })
    if (field.maxLength && text.length > field.maxLength) issues.push({ key: field.key, message: `${field.label}: tối đa ${field.maxLength} ký tự` })
    if (field.type === 'select' && !field.options?.includes(text)) issues.push({ key: field.key, message: `${field.label}: giá trị không hợp lệ` })
    if (field.type === 'date' && !validDate(text)) issues.push({ key: field.key, message: `${field.label}: ngày không hợp lệ hoặc ở tương lai` })
    if (field.type === 'number' && (!/^(?:0|[1-9]\d*)$/.test(text) || Number(text) < (field.min ?? 0) || Number(text) > (field.max ?? Number.MAX_SAFE_INTEGER)))
      issues.push({ key: field.key, message: `${field.label}: phải từ ${field.min ?? 0} đến ${field.max ?? 'giới hạn cho phép'}` })
    const specialized = field.type === 'citizenId' ? identityIssue(text) : field.type === 'tel' ? phoneIssue(text) : field.type === 'email' ? emailIssue(text) : ''
    if (specialized) issues.push({ key: field.key, message: `${field.label}: ${specialized}` })
  }
  // Cross-field checks are additional hints; legal eligibility is determined by the competent authority.
  if (procedureId === 'ket-hon' && value.applicantBirthDate && value.spouseBirthDate && value.applicantBirthDate === value.spouseBirthDate && value.spouseIdentifier === value.applicantIdentifier)
    issues.push({ key: 'spouseIdentifier', message: 'Vui lòng kiểm tra lại thông tin của hai người' })
  return issues
}
export function sanitizeProcedureForm(procedureId: string, value: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const field of getProcedureFormFields(procedureId)) {
    const raw = value[field.key]
    if (typeof raw === 'string') result[field.key] = raw.trim()
  }
  return result
}
