// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Gói nghiệp vụ, qua API lõi:
//   GET  /rest/modules                 gói đã cài (COMMUNEOS_MODULES)
//   GET  /rest/tenant_modules          gói bật cho từng đơn vị
//   POST /rest/rpc/set_tenant_module   bật / tắt một gói cho một đơn vị (tắt không xóa dữ liệu của gói)
import type { Module, TenantModule } from "~/types";

export function useModules() {
  const { api } = useApi();
  const modules = useState<Module[]>("modules", () => []);
  const tenantModules = useState<TenantModule[]>("tenant-modules", () => []);
  const error = ref<string | null>(null);

  async function load() {
    error.value = null;
    try {
      [modules.value, tenantModules.value] = await Promise.all([
        api<Module[]>("/modules"),
        api<TenantModule[]>("/tenant_modules"),
      ]);
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  const has = (code: string, module: string) =>
    tenantModules.value.some((m) => m.tenant_code === code && m.module === module);
  const modulesOf = (code: string) => tenantModules.value.filter((m) => m.tenant_code === code);
  /** Gói xã có được cài trên lõi không (để hiện phần thủ tục, hồ sơ). */
  const xaInstalled = computed(() => modules.value.some((m) => m.name === "xa"));

  async function setModule(code: string, module: string, enabled: boolean): Promise<string | null> {
    try {
      await api("/rpc/set_tenant_module", { method: "POST", body: { tenant_code: code, module, enabled } });
      await load();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return { modules, tenantModules, error, load, has, modulesOf, xaInstalled, setModule };
}
