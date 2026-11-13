# SPDX-License-Identifier: Apache-2.0
"""Generate readable demo packs. Values are hypothetical, not legal requirements."""
import json
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]/'packs'
PACKS={
 'khai-sinh': ('Đăng ký khai sinh',8,[('to-khai','Tờ khai đăng ký khai sinh'),('giay-chung-sinh','Giấy chứng sinh')],
      [('ho_ten','Họ tên trẻ (mẫu)'),('nguoi_khai','Người khai (mẫu)'),('noi_sinh','Nơi sinh (mẫu)')],
      'Hồ sơ đăng ký khai sinh (mô phỏng)\n\nTài liệu demo bao gồm tờ khai đăng ký khai sinh và giấy chứng sinh. Cán bộ phải kiểm tra thành phần hồ sơ theo quy định hiện hành.\n\nTrình tự mẫu: tiếp nhận hồ sơ, chuyên viên thẩm định, trình lãnh đạo quyết định, trả kết quả.\n\nThời hạn xử lý minh họa 8 giờ, không phải cam kết pháp lý.'),
 'ho-kinh-doanh': ('Đăng ký hộ kinh doanh',72,[('to-khai','Giấy đề nghị đăng ký hộ kinh doanh'),('giay-to-chu-ho','Giấy tờ chứng minh chủ hộ (mẫu)')],
      [('ho_ten','Tên người đăng ký (mẫu)'),('ten_ho','Tên hộ kinh doanh'),('dia_chi','Địa chỉ kinh doanh (mẫu)')],
      'Đăng ký hộ kinh doanh (mô phỏng)\n\nTài liệu demo gồm giấy đề nghị đăng ký hộ kinh doanh và giấy tờ minh họa của chủ hộ. Kiểm tra hiệu lực pháp luật và thẩm quyền trước khi dùng thực tế.\n\nTrình tự mẫu: tiếp nhận, thẩm tra, trình duyệt, trả kết quả.\n\nThời hạn xử lý minh họa 72 giờ, không phải thời hạn pháp luật.'),
 'xac-nhan-cu-tru': ('Xác nhận cư trú',24,[('to-khai','Tờ khai xác nhận cư trú (mẫu)')],
      [('ho_ten','Họ tên người yêu cầu'),('dia_chi','Địa chỉ đề nghị xác nhận')],
      'Xác nhận thông tin cư trú (quy trình giả lập)\n\nTài liệu mô phỏng yêu cầu tờ khai xác nhận cư trú; việc xác minh thực tế có thể khác. Cần căn cứ văn bản chính thức mới nhất.\n\nTrình tự mẫu: tiếp nhận, thẩm tra, trình lãnh đạo phê duyệt, trả kết quả.\n\nThời hạn 24 giờ chỉ là dữ liệu trình diễn.'),
}
BPMN='''<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="http://communeos.example/bpmn">
 <process id="{key}" name="{name}" isExecutable="true">
  <startEvent id="start"/>
  <sequenceFlow id="f1" sourceRef="start" targetRef="review"/>
  <userTask id="review" name="Thẩm tra hồ sơ"/>
  <sequenceFlow id="f2" sourceRef="review" targetRef="approval"/>
  <userTask id="approval" name="Lãnh đạo phê duyệt"/>
  <sequenceFlow id="f3" sourceRef="approval" targetRef="delivery"/>
  <userTask id="delivery" name="Trả kết quả"/>
  <sequenceFlow id="f4" sourceRef="delivery" targetRef="end"/>
  <endEvent id="end"/>
 </process>
</definitions>
'''
DMN='''<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" namespace="http://communeos.example/dmn" name="checklist">
 <decision id="check" name="Đủ tài liệu tối thiểu">
  <decisionTable id="dt" hitPolicy="FIRST">
   <input id="input1"><inputExpression typeRef="boolean"><text>complete</text></inputExpression></input>
   <output id="output1" name="accepted" typeRef="boolean"/>
   <rule id="r1"><inputEntry id="i1"><text>true</text></inputEntry><outputEntry id="o1"><text>true</text></outputEntry></rule>
   <rule id="r2"><inputEntry id="i2"><text>-</text></inputEntry><outputEntry id="o2"><text>false</text></outputEntry></rule>
  </decisionTable>
 </decision>
</definitions>
'''
for code,(name,sla,docs,fields,wiki) in PACKS.items():
  folder=ROOT/code
  (folder/'wiki').mkdir(parents=True,exist_ok=True)
  (folder/'pack.yaml').write_text(yaml.safe_dump({'code':code,'name':name,'version':'1.0.0',
    'sla_hours':sla,'channels':['counter','online-demo'],
    'required_documents':[{'code':a,'name':b} for a,b in docs],
    'roles':{'receive':'receptionist','review':'officer','sign':'leader'}},allow_unicode=True,sort_keys=False),encoding='utf-8')
  schema={'$schema':'https://json-schema.org/draft/2020-12/schema','type':'object',
          'properties':{key:{'type':'string','minLength':2,'title':label} for key,label in fields},
          'required':[fields[0][0]],'additionalProperties':False}
  (folder/'form.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf-8')
  (folder/'process.bpmn').write_text(BPMN.format(key=code.replace('-','_'),name=name),encoding='utf-8')
  (folder/'checklist.dmn').write_text(DMN,encoding='utf-8')
  (folder/'wiki'/'huong-dan.md').write_text('# '+name+'\n\n'+wiki+'\n',encoding='utf-8')
print('Generated',len(PACKS),'procedure packs')
