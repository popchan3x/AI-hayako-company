import { auditUniverse } from "../src/universeAudit.js";

const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 8;
const providerArg = process.argv.find((arg) => arg.startsWith("--provider="));
const provider = providerArg ? providerArg.split("=")[1] : "free-composite";
const result = await auditUniverse({ concurrency, provider });
console.log(JSON.stringify(result.summary, null, 2));
