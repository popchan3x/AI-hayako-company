import { runDailyLearning } from "../src/learning.js";

const providerArg = process.argv.find((arg) => arg.startsWith("--provider="));
const provider = providerArg ? providerArg.split("=")[1] : "demo";
const intervalsArg = process.argv.find((arg) => arg.startsWith("--intervals="));
const intervals = intervalsArg ? intervalsArg.split("=")[1].split(",").map((value) => value.trim()).filter(Boolean) : undefined;
const summary = await runDailyLearning({ provider, intervals });
console.log(JSON.stringify(summary, null, 2));
