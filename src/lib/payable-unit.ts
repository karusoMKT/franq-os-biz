export function requirePayableUnit(unitId: string, units: readonly { id: string }[]): string {
  if (!unitId) throw new Error("Selecione a unidade");
  if (!units.some((unit) => unit.id === unitId)) {
    throw new Error("Selecione uma unidade da sua empresa");
  }
  return unitId;
}