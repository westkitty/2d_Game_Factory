#!/usr/bin/env node
import { runCli } from './index.ts';

const exitCode = await runCli(process.argv.slice(2));
process.exitCode = exitCode;
