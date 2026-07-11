import { validateApsPackage } from "../validation-engine/validate-package";

export async function runValidation(cwd: string) {
  return validateApsPackage(cwd);
}
