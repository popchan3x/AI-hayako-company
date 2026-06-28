import { runDailyLearning } from "../src/learning.js";

const providerArg = process.argv.find((arg) => arg.startsWith("--provider="));
const provider = providerArg ? providerArg.split("=")[1] : "demo";
const summary = await runDailyLearning({ provider });
console.log(JSON.stringify(summary, null, 2));
