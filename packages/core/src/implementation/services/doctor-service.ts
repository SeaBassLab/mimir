import { runDoctor } from "../doctor/evaluator";

export async function runDoctorAssessment(cwd: string) {
  return runDoctor(cwd);
}
