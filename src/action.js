// @ts-check
import * as core from "@actions/core";
import main from "./main.js";

main().catch((reason) => core.setFailed(String(reason)));
