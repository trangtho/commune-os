#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Tải mô hình AI vào volume ai-models (dịch vụ ai-models, chạy một lần mỗi khi make up).
# Mô hình đã có thì bỏ qua, không cần mạng. Chưa có mà không tải được (máy không có Internet)
# thì báo rồi vẫn thoát 0: lõi vẫn chạy, trợ lý dùng tìm kiếm toàn văn cho đến khi có mô hình.
# Dịch vụ ai (chạy mô hình) nằm trong mạng nội bộ không ra Internet; chỉ dịch vụ này cần mạng, một lần.
set -u
CHAT="${AI_CHAT_MODEL:-qwen3:1.7b}"
EMBED="${AI_EMBED_MODEL:-bge-m3}"

ollama serve >/tmp/ollama.log 2>&1 &
SERVER=$!
i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then echo "Ollama không khởi động được"; cat /tmp/ollama.log; exit 1; fi
  sleep 1
done

for model in "$CHAT" "$EMBED"; do
  case "$model" in *:*) name="$model" ;; *) name="$model:latest" ;; esac
  if ollama list | awk 'NR > 1 { print $1 }' | grep -qx "$name"; then
    echo "Mô hình $name: đã có"
  else
    echo "Mô hình $name: đang tải (chỉ một lần)..."
    if ollama pull "$model"; then
      echo "Mô hình $name: đã tải xong"
    else
      echo "Mô hình $name: KHÔNG tải được (kiểm tra kết nối Internet). Trợ lý tạm dùng tìm kiếm toàn văn."
    fi
  fi
done

kill "$SERVER" 2>/dev/null
wait "$SERVER" 2>/dev/null
exit 0
