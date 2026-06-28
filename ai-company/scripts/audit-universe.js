import { auditUniverse } from "../src/universeAudit.js";

const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 8;
const result = await auditUniverse({ concurrency });
console.log(JSON.stringify(result.summary, null, 2));
