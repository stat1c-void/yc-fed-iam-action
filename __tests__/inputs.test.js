import { afterAll, afterEach, expect, it, jest } from "@jest/globals";
import nock from "nock";
import { stubIdToken } from "./test_data.js";

const originalEnv = { ...process.env };

jest.unstable_mockModule("@actions/core", () => {
  /** @type {typeof import("@actions/core")} */
  const orgModule = jest.requireActual("@actions/core");
  return {
    __esModule: true,
    getInput: orgModule.getInput,
    isDebug: jest.fn().mockReturnValue(false),
    error: jest.fn(),
    setFailed: jest.fn(),
    getIDToken: jest.fn(),
    setOutput: jest.fn(),
    setSecret: jest.fn(),
  };
});
const core = await import("@actions/core");

// mock every IAM request in this file (persist)
nock.disableNetConnect();
nock("https://auth.yandex.cloud")
  .post("/oauth/token")
  .reply(200, {
    access_token: "stub-iam-token",
    token_type: "Bearer",
    expires_in: 43200,
  })
  .persist();

afterEach(() => {
  process.env = { ...originalEnv };
  jest.resetAllMocks();
});

afterAll(() => {
  // from nock readme (avoid memory issues)
  // https://github.com/nock/nock?tab=readme-ov-file#memory-issues-with-jest
  nock.restore();
});

const main = (await import("../src/main.js")).default;

it("sets failed on missing service-account", async () => {
  await main();

  expect(core.setFailed).toHaveBeenCalled();
  expect(core.setFailed.mock.lastCall[0]).toMatch(
    /Input required and not supplied: service-account/
  );
});

it("sets error and failed when token-id fails", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  core.getIDToken.mockImplementationOnce(() => {
    throw new Error("stub-error");
  });

  await main();

  expect(core.error).toHaveBeenCalled();
  expect(core.error.mock.lastCall[0]).toMatch(/Error getting GitHub ID-token/);
  expect(core.setFailed).toHaveBeenCalled();
  expect(core.setFailed.mock.lastCall[0]).toMatch(/stub-error/);
});

it("passes audience to getIDToken", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  process.env["INPUT_AUDIENCE"] = "stub-aud";
  core.getIDToken.mockImplementationOnce(() => {
    throw new Error("stub-error");
  });

  await main();

  expect(core.getIDToken).toHaveBeenCalledWith("stub-aud");
});

it("calls getYcIamToken and sets proper outputs", async () => {
  process.env["INPUT_SERVICE-ACCOUNT"] = "stub-sa";
  core.getIDToken.mockReturnValueOnce(stubIdToken);

  await main();

  expect(core.setFailed).not.toHaveBeenCalled();
  expect(core.setOutput).toHaveBeenNthCalledWith(1, "token", "stub-iam-token");
  expect(core.setOutput).toHaveBeenNthCalledWith(2, "expires-in", 43200);
  expect(core.setSecret).toHaveBeenCalledWith("stub-iam-token");
});
