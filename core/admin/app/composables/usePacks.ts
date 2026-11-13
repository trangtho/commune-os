// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Nơi duy nhất lấy và nạp gói thủ tục. Hiện dùng dữ liệu giả; khi lõi có API,
// việc đọc và kiểm tệp pack.yaml sẽ do dịch vụ điều phối làm (POST /admin/packs).
import type { Channel, Pack, RequiredDocument } from "~/types";
import { mockPacks } from "~/mocks/packs";

function clean(value: string): string {
  return value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function field(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"));
  return match ? clean(match[1]!) : null;
}

/**
 * Đọc tạm các trường chính của pack.yaml để hiển thị. Đây không phải bộ đọc
 * YAML đầy đủ; nó chỉ phục vụ giao diện trong giai đoạn dùng dữ liệu giả.
 */
export function parsePackYaml(text: string): Pack | string {
  const code = field(text, "code");
  const name = field(text, "name");
  const version = field(text, "version");
  if (!code || !name || !version) {
    return "Tệp không hợp lệ: thiếu một trong các trường code, name, version.";
  }

  const documents: RequiredDocument[] = [];
  const docPattern = /-\s*code:\s*(.+)\n\s*name:\s*(.+)/g;
  for (const m of text.matchAll(docPattern)) {
    documents.push({ code: clean(m[1]!), name: clean(m[2]!) });
  }

  const channelMatch = text.match(/^channels:\s*\[(.*)\]/m);
  const channels = (channelMatch ? channelMatch[1]!.split(",") : ["counter"])
    .map((c) => clean(c))
    .filter((c): c is Channel => c === "counter" || c === "online");

  return {
    code,
    name,
    version,
    sla_hours: Number(field(text, "sla_hours") ?? 0),
    channels,
    required_documents: documents,
    roles: {
      receive: field(text, "receive") ?? "receptionist",
      review: field(text, "review") ?? "officer",
      sign: field(text, "sign") ?? "leader",
    },
    loaded_at: new Date().toISOString(),
  };
}

export function usePacks() {
  const packs = useState<Pack[]>("packs", () =>
    mockPacks.map((p) => ({ ...p })),
  );

  /** Nạp gói từ nội dung pack.yaml. Trả về thông báo lỗi, hoặc null nếu thành công. */
  function loadPack(yamlText: string): string | null {
    const parsed = parsePackYaml(yamlText);
    if (typeof parsed === "string") return parsed;
    const existing = packs.value.findIndex((p) => p.code === parsed.code);
    if (existing >= 0) {
      if (packs.value[existing]!.version === parsed.version) {
        return `Gói "${parsed.code}" phiên bản ${parsed.version} đã được nạp.`;
      }
      packs.value[existing] = parsed;
    } else {
      packs.value.push(parsed);
    }
    return null;
  }

  return { packs, loadPack };
}
