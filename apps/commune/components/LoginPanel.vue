<script setup lang="ts">
import {ShieldCheck,Landmark,Users,ClipboardList,BookOpen,ArrowRight,LockKeyhole} from 'lucide-vue-next'
const {config,loginDemo,loginSSO,loading,error}=useCommune()
const options=[
  {role:'citizen',label:'Công dân',hint:'Nộp và tra cứu hồ sơ',icon:'◉'},
  {role:'receptionist',label:'Cán bộ tiếp nhận',hint:'Bộ phận Một cửa',icon:'▤'},
  {role:'officer',label:'Cán bộ xử lý',hint:'Thẩm định và trình ký',icon:'▥'},
  {role:'leader',label:'Lãnh đạo xã',hint:'Phê duyệt và điều hành',icon:'◇'},
  {role:'supervisor',label:'Cấp trên',hint:'Thống kê liên xã',icon:'▦'},
  {role:'sys_admin',label:'Quản trị viên',hint:'Nền tảng và phân quyền',icon:'⚙'},
]
</script>
<template>
<div class="login-view">
 <div class="login-hero">
  <div class="brand brand-large"><span class="brand-icon"><span class="leaf"></span></span><div><strong>CommuneOS</strong><small>Xã Thành Phú</small></div></div>
  <div class="hero-copy"><span class="hero-kicker">DX–OS OPEN CORE · H–P–D–I</span>
   <h1>Không gian làm việc số<br>cho chính quyền cơ sở.</h1>
   <p>Nền tảng dùng chung, vận hành hồ sơ minh bạch và bảo đảm quyền truy cập theo từng vai trò.</p>
   <div class="hero-highlights"><span><ShieldCheck :size="18"/> Phân quyền & nhật ký</span><span><ClipboardList :size="18"/> Quy trình điện tử</span><span><BookOpen :size="18"/> Tri thức có nguồn</span></div>
  </div>
  <small class="hero-foot">Phiên bản mô phỏng cho mục đích nghiên cứu · Không phải hệ thống dịch vụ công chính thức.</small>
 </div>
 <div class="login-form">
   <div class="login-form-inner"><div class="login-eyebrow"><LockKeyhole :size="16"/> TRUY CẬP HỆ THỐNG</div><h2>Chào mừng đến CommuneOS</h2>
   <p class="muted">{{String(config.public.demoMode)==='true'?'Chọn một vai trò để trải nghiệm hệ thống với dữ liệu giả lập.':'Đăng nhập bằng tài khoản định danh tổ chức (OIDC / Keycloak).'}}</p>
   <div v-if="String(config.public.demoMode)==='true'" class="role-chooser">
     <button v-for="item in options" :key="item.role" class="role-choice" :disabled="loading" @click="loginDemo(item.role)">
       <span class="role-symbol">{{item.icon}}</span><span class="role-desc"><strong>{{item.label}}</strong><small>{{item.hint}}</small></span><ArrowRight :size="17"/></button>
   </div>
   <button v-else class="btn primary wide" @click="loginSSO">Đăng nhập Keycloak <ArrowRight :size="17"/></button>
   <p v-if="error" class="error-block">{{error}}</p>
   <p class="login-note">Chỉ sử dụng thông tin và hồ sơ giả lập trong môi trường thử nghiệm. Không tải giấy tờ cá nhân thật.</p>
  </div>
 </div>
</div>
</template>
